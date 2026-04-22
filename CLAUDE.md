# Repo-specific guidance for Claude

This is a Jekyll static site (`ranveerm.com` / "Escape Horizon").

## Language choice for new scripts

When introducing new tooling, pick the smallest viable option:

1. **Shell / `sqlite3` CLI** — preferred. Zero extra tooling.
2. **Python** — preferred when real code is needed, but **only with the
   Python 3 standard library**. No `pip install`, no `requirements.txt`,
   no virtualenv. The moment a third-party package would be required,
   stop and ask the user how to proceed. `python3` already ships with
   macOS, so stdlib-only Python adds no unintended dependencies.

### Languages to avoid

Do **not** reach for these without explicit user approval; instead, surface
the trade-off and communicate the alternative to the user:

- **Ruby** — even though Jekyll already requires it, new Ruby utilities or
  gems should not be added unilaterally.
- **JavaScript** — in-browser `/scripts/` code is fine for existing UI
  behaviour, but avoid introducing Node/npm/build tooling.
- **Liquid templating** — for new data-processing logic specifically. Liquid
  inside `.html`/`.md` for rendering is fine; do not invent new data pipelines
  expressed purely in Liquid.

If a task seems to genuinely need any of the above, explain the situation
and the available alternatives to the user and let them decide.

## Day One data extraction

`scripts/generate-year-in-review.py` reads the local Day One SQLite database
(stdlib-only Python) to generate `_data/year-in-review/year-<YEAR>/*.json`
and copy photo assets. It opens the database with `mode=ro&immutable=1` and
uses only `SELECT` statements — it must remain strictly read-only with respect
to Day One's data.

## Post excerpts

`_config.yml` sets `excerpt_separator: <!--end-excerpt-->`. Every post should
include this marker after its intro paragraph; otherwise the homepage will
render the entire post as its excerpt, which breaks the layout (especially
for posts containing carousels or image clouds).
