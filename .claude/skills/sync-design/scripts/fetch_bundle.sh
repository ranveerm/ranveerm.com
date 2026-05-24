#!/bin/bash
# fetch_bundle.sh: download and extract an upstream Design Language bundle.
# Usage: bash fetch_bundle.sh <bundle-url>
#
# After running, the new bundle is at /tmp/design-sync/current.html and the
# previous bundle (if there was one) at /tmp/design-sync/previous.html. The
# caller can then diff or grep them.
#
# Why curl, not WebFetch: bundles are 10MB+ gzipped, past WebFetch's cap.

set -euo pipefail

URL="${1:?usage: bash fetch_bundle.sh <bundle-url>}"
WORK="/tmp/design-sync"
mkdir -p "$WORK"

# Stage the new bundle under a separate name so a failed fetch never
# clobbers the previously cached current/previous pair.
BIN="$WORK/new.bin"
TAR="$WORK/new.tar"
NEW_HTML="$WORK/new.html"
HTML_REL="escape-horizons-revamp/project/Design Language v3.html"

trap 'rm -rf "$BIN" "$TAR" "$WORK/escape-horizons-revamp" "$NEW_HTML" 2>/dev/null || true' EXIT

echo "Downloading $URL" >&2
# --fail returns non-zero on HTTP 4xx/5xx so we do not save the error body
# as if it were the bundle. -L follows redirects. -sS keeps it quiet but
# still prints curl errors on failure.
if ! curl --fail -sSL "$URL" -o "$BIN"; then
  echo "ERROR: download failed (HTTP error or network problem)." >&2
  echo "Confirm the URL is current; bundle URLs are content-addressed and may stop resolving." >&2
  exit 1
fi

if ! file "$BIN" | grep -q 'gzip compressed'; then
  echo "ERROR: downloaded file is not gzip-compressed:" >&2
  file "$BIN" >&2
  echo "First bytes:" >&2
  head -c 200 "$BIN" >&2
  echo >&2
  exit 1
fi

gunzip -c "$BIN" > "$TAR"
if ! tar -xf "$TAR" -C "$WORK" "$HTML_REL" 2>/dev/null; then
  echo "ERROR: expected entry '$HTML_REL' not found in the tar archive." >&2
  echo "Available entries (first 20):" >&2
  tar -tf "$TAR" | head -20 >&2
  exit 1
fi
mv "$WORK/$HTML_REL" "$NEW_HTML"

# Only rotate after a fully successful extract.
if [ -f "$WORK/current.html" ]; then
  mv "$WORK/current.html" "$WORK/previous.html"
fi
mv "$NEW_HTML" "$WORK/current.html"

echo "Extracted: $WORK/current.html ($(wc -l < "$WORK/current.html") lines)"

if [ -f "$WORK/previous.html" ]; then
  CHANGED=$(diff "$WORK/previous.html" "$WORK/current.html" | wc -l | tr -d ' ')
  if [ "$CHANGED" = "0" ]; then
    echo "No changes vs previous bundle."
  else
    echo "Diff vs previous: $CHANGED diff lines."
    echo "Inspect with: diff -u $WORK/previous.html $WORK/current.html"
  fi
else
  echo "No previous bundle cached. Read $WORK/current.html directly to inspect FOUNDATION and roles."
fi
