#!/usr/bin/env python3
"""
Generate Year-in-Review processed JSON + photo assets from the local Day One
SQLite database.

Usage:
    ./scripts/generate-year-in-review.py 2021
    ./scripts/generate-year-in-review.py 2021 --journals books movies

This reads the Day One SQLite database directly (no network, no LLM, fully
deterministic — safe for local CI / pre-commit hooks).

Output:
    _data/year-in-review/year-<YEAR>/<Category>-processed.json
    assets/images/posts/year-in-review/<YEAR>/day-one-exports/<md5>.<ext>
"""

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from pathlib import Path

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

DAY_ONE_DB = Path.home() / (
    "Library/Group Containers/5U8NS4GX82.dayoneapp2/Data/Documents/DayOne.sqlite"
)
DAY_ONE_PHOTOS = Path.home() / (
    "Library/Group Containers/5U8NS4GX82.dayoneapp2/Data/Documents/DayOnePhotos"
)

# Map output category name -> (Day One journal name, JSON filename)
# Journal name must match ZJOURNAL.ZNAME exactly.
CATEGORIES = {
    "books":     ("Books Read",        "Books-processed.json"),
    "movies":    ("Movies watched",    "Movies-processed.json"),
    "tv":        ("TV shows watched",  "TV-shows-processed.json"),
    "games":     ("Games Played",      "Games-processed.json"),
    "beverages": ("Alcohol",           "Beverages-processed.json"),
}

# Apple/Core Data epoch: seconds since 2001-01-01 00:00:00 UTC
APPLE_EPOCH_OFFSET = 978307200  # = unix timestamp of 2001-01-01 UTC

# ------------------------------------------------------------------
# Entry parsing
# ------------------------------------------------------------------

MOMENT_RE = re.compile(r"!\[[^\]]*\]\(dayone-moment://([A-Fa-f0-9]+)\)")
H1_RE     = re.compile(r"^#\s+(.+?)\s*$",     re.MULTILINE)
H3_RE     = re.compile(r"^###\s+(.+?)\s*$",   re.MULTILINE)
# A markdown horizontal rule: a line that is exactly `---` (with optional
# surrounding whitespace). Anything below such a rule in an entry is
# considered private notes and is not published.
HR_RE     = re.compile(r"^\s*-{3,}\s*$")


def unescape_md(text):
    """Day One escapes punctuation in markdown (e.g. `\\.`). Strip the backslashes."""
    # Remove backslash before any non-alphanumeric character (common markdown escapes).
    return re.sub(r"\\([^\w\s])", r"\1", text).strip()


def strip_below_hr(markdown):
    """Discard everything at or below the first markdown horizontal rule.

    Authors use `---` inside Day One entries to separate the public summary
    (title/subtitle/photo/description shown on the site) from private notes
    that should not be surfaced.
    """
    if not markdown:
        return markdown
    out = []
    for line in markdown.splitlines():
        if HR_RE.match(line):
            break
        out.append(line)
    return "\n".join(out)


def parse_entry(markdown):
    """Extract title, subtitle, description, moment_uuid from a Day One entry.

    Format (consistent across Year-in-Review journals):
        # Title
        ### Subtitle               (optional)
        ![](dayone-moment://UUID)  (optional)
        <description paragraphs>   (optional)

    Anything below a markdown horizontal rule (`---`) is treated as a
    private-notes section and stripped before parsing.
    """
    if not markdown:
        return {"title": "", "subtitle": "", "description": "", "moment_uuid": None}

    markdown = strip_below_hr(markdown)

    title = ""
    subtitle = ""
    moment_uuid = None

    m = H1_RE.search(markdown)
    if m:
        title = unescape_md(m.group(1))

    m = H3_RE.search(markdown)
    if m:
        subtitle = unescape_md(m.group(1))

    m = MOMENT_RE.search(markdown)
    if m:
        moment_uuid = m.group(1).upper()

    # Description: everything that's not a heading or an image reference.
    desc_lines = []
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if MOMENT_RE.match(stripped):
            continue
        desc_lines.append(stripped)
    description = unescape_md(" ".join(desc_lines)) if desc_lines else ""

    return {
        "title": title,
        "subtitle": subtitle,
        "description": description,
        "moment_uuid": moment_uuid,
    }


# ------------------------------------------------------------------
# Database queries
# ------------------------------------------------------------------

def get_journal_id(conn, name):
    row = conn.execute(
        "SELECT Z_PK FROM ZJOURNAL WHERE ZNAME = ?", (name,)
    ).fetchone()
    if not row:
        raise SystemExit(f"Journal not found in Day One: {name!r}")
    return row[0]


def fetch_entries(conn, journal_id, year):
    rows = conn.execute(
        """
        SELECT Z_PK, ZCREATIONDATE, ZMARKDOWNTEXT
        FROM ZENTRY
        WHERE ZJOURNAL = ? AND ZGREGORIANYEAR = ?
        ORDER BY ZCREATIONDATE
        """,
        (journal_id, year),
    ).fetchall()
    return rows


def fetch_attachment(conn, entry_pk, moment_uuid):
    """Return (md5, ext, has_data) or None."""
    if moment_uuid:
        row = conn.execute(
            "SELECT ZMD5, ZTYPE, ZHASDATA FROM ZATTACHMENT "
            "WHERE ZENTRY = ? AND UPPER(ZIDENTIFIER) = ?",
            (entry_pk, moment_uuid),
        ).fetchone()
        if row:
            return row
    # Fallback: first attachment for the entry.
    row = conn.execute(
        "SELECT ZMD5, ZTYPE, ZHASDATA FROM ZATTACHMENT "
        "WHERE ZENTRY = ? ORDER BY ZORDERINENTRY LIMIT 1",
        (entry_pk,),
    ).fetchone()
    return row


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("year", type=int, help="Gregorian year, e.g. 2021")
    parser.add_argument("--journals", nargs="*", choices=list(CATEGORIES.keys()),
                        help="Restrict to specific categories (default: all)")
    parser.add_argument("--repo-root", type=Path,
                        default=Path(__file__).resolve().parent.parent,
                        help="Repo root (defaults to parent of this script's dir)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would be written without touching disk")
    args = parser.parse_args()

    if not DAY_ONE_DB.exists():
        sys.exit(f"Day One database not found: {DAY_ONE_DB}")

    year = args.year
    selected = args.journals or list(CATEGORIES.keys())

    data_dir   = args.repo_root / "_data" / "year-in-review" / f"year-{year}"
    photos_dir = args.repo_root / "assets" / "images" / "posts" / "year-in-review" / str(year) / "day-one-exports"

    if not args.dry_run:
        data_dir.mkdir(parents=True, exist_ok=True)
        photos_dir.mkdir(parents=True, exist_ok=True)

    # Open read-only (`mode=ro`). We deliberately do NOT set `immutable=1`:
    # that flag tells SQLite to ignore the write-ahead log (`-wal`) file,
    # which would cause us to miss any entries Day One has written since its
    # last checkpoint — a real problem when the app is open on the desktop
    # while the script runs. `mode=ro` is sufficient for read-only safety.
    conn = sqlite3.connect(f"file:{DAY_ONE_DB}?mode=ro", uri=True)

    # Apple-epoch timestamp (matches the style used in the 2020 JSON).
    export_ts = time.time() - APPLE_EPOCH_OFFSET

    total_entries = 0
    total_photos_copied = 0
    total_photos_missing = 0

    for cat in selected:
        journal_name, out_filename = CATEGORIES[cat]
        try:
            jid = get_journal_id(conn, journal_name)
        except SystemExit as e:
            print(f"[skip {cat}] {e}")
            continue

        rows = fetch_entries(conn, jid, year)
        if not rows:
            print(f"[{cat}] 0 entries for {year} — skipped")
            continue

        entries_out = []
        for entry_pk, creation_date, markdown in rows:
            parsed = parse_entry(markdown or "")
            moment = parsed.pop("moment_uuid")

            photo_filename = ""
            attach = fetch_attachment(conn, entry_pk, moment)
            if attach:
                md5, ext, has_data = attach
                if md5 and ext:
                    photo_filename = f"{md5}.{ext}"
                    src = DAY_ONE_PHOTOS / photo_filename
                    dst = photos_dir / photo_filename
                    if src.exists():
                        if not args.dry_run and not dst.exists():
                            shutil.copy2(src, dst)
                        total_photos_copied += 1
                    else:
                        total_photos_missing += 1
                        print(f"  [warn] photo missing locally: {photo_filename} "
                              f"(entry {entry_pk}, {parsed['title']!r})")

            entries_out.append({
                "description": parsed["description"],
                "title":       parsed["title"],
                "subtitle":    parsed["subtitle"],
                "photo":       photo_filename,
                "date":        creation_date if creation_date is not None else export_ts,
            })
            total_entries += 1

        payload = {"entries": entries_out}
        out_path = data_dir / out_filename
        if args.dry_run:
            print(f"[{cat}] would write {out_path} ({len(entries_out)} entries)")
        else:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            print(f"[{cat}] wrote {out_path} ({len(entries_out)} entries)")

    conn.close()

    print("---")
    print(f"Entries processed: {total_entries}")
    print(f"Photos copied:     {total_photos_copied}")
    if total_photos_missing:
        print(f"Photos MISSING:    {total_photos_missing} "
              "(download them in Day One and re-run)")


if __name__ == "__main__":
    main()
