# Repo-specific guidance for Claude

This is a Jekyll static site (`ranveerm.com` / "Escape Horizon").

## Prose style

**Do not use em-dashes (`—`) anywhere.** This applies to post content, code
comments, commit messages, and this instructions file itself. Use a comma,
colon, semicolon, parentheses, or split into two sentences instead. The
right substitute depends on intent:

- introducing a list or clarification: colon (`: `)
- parenthetical aside: parentheses or commas
- two related independent clauses: semicolon or full stop

If you encounter an em-dash in existing content you're touching, replace it.

## Language choice for new scripts

When introducing new tooling, pick the smallest viable option:

1. **Shell / `sqlite3` CLI**: preferred. Zero extra tooling.
2. **Python**: preferred when real code is needed, but **only with the
   Python 3 standard library**. No `pip install`, no `requirements.txt`,
   no virtualenv. The moment a third-party package would be required,
   stop and ask the user how to proceed. `python3` already ships with
   macOS, so stdlib-only Python adds no unintended dependencies.

### Languages to avoid

Do **not** reach for these without explicit user approval; instead, surface
the trade-off and communicate the alternative to the user:

- **Ruby**: even though Jekyll already requires it, new Ruby utilities or
  gems should not be added unilaterally.
- **JavaScript**: in-browser `/scripts/` code is fine for existing UI
  behaviour, but avoid introducing Node/npm/build tooling.
- **Liquid templating**: for new data-processing logic specifically. Liquid
  inside `.html`/`.md` for rendering is fine; do not invent new data pipelines
  expressed purely in Liquid.

If a task seems to genuinely need any of the above, explain the situation
and the available alternatives to the user and let them decide.

## Day One data extraction

`scripts/generate-year-in-review.py` reads the local Day One SQLite database
(stdlib-only Python) to generate `_data/year-in-review/year-<YEAR>/*.json`
and copy photo assets. It opens the database with `mode=ro` and uses only
`SELECT` statements: it must remain strictly read-only with respect to Day
One's data. Note: `immutable=1` must NOT be added to the SQLite URI: that
flag tells SQLite to ignore the write-ahead log, causing the script to miss
any recent edits Day One hasn't yet checkpointed.

## Post excerpts

`_config.yml` sets `excerpt_separator: <!--end-excerpt-->`. Every post should
include this marker after its intro paragraph; otherwise the homepage will
render the entire post as its excerpt, which breaks the layout (especially
for posts containing carousels or image clouds).

## Design language

The site uses a two-layer design system, sourced from a `Design Language.html`
bundle authored in Claude Design (claude.ai/design):

- **Foundation tokens** -- colour, type stack, type scale, tracking,
  line-height. Live as CSS custom properties in `_sass/_theme.scss`,
  declared on `:root` for light and remapped on `[data-theme="dark"]`
  via the `_design-dark-palette` mixin.
- **Semantic role classes** -- `.role-system-*`, `.role-post-*`,
  `.role-nav-*`, `.role-footer-*`, `.role-viz-*`, `.role-code-*`. Each
  role is a recipe of foundation tokens; consumers either apply the
  class directly or inline the same property bundle.

**Always reach for tokens, never hard-code colours or font sizes.**
- Colour: `var(--paper)`, `var(--paper-raised)`, `var(--paper-inset)`,
  `var(--ink-primary)`, `var(--ink-secondary)`, `var(--ink-muted)`,
  `var(--ink-faint)`, `var(--line)`, `var(--coral)`, `var(--coral-strong)`,
  `var(--coral-wash)`, syntax `var(--sx-*)`.
- Type: `var(--font-display)` / `var(--font-text)` / `var(--font-mono)`,
  size scale `var(--size-xs)`..`var(--size-h1l)`, tracking `var(--track-*)`,
  line-height `var(--lh-*)`.
- Component recipe: pull a role class (e.g. `.role-viz-callout`) or
  inline the same property bundle so the theme can re-tune in one place.

When new visual surfaces appear (a widget, a layout, a post pattern),
reuse an existing role or propose a new one in `_sass/_theme.scss` --
do not introduce fresh ad-hoc colours or sizes. Categorical hues that
carry information (e.g. the green/orange/red/blue outcome classes in
the sensitivity widget) are the only acceptable exception.

### Where widget styles live

**Every widget rule belongs in `_sass/_theme.scss`. No exceptions.** JS
files in `/scripts/` may apply class names to DOM elements; they must
not inject `<style>` blocks, set `style.cssText` for typography, or
otherwise paint colour, size, font, border, or background properties
at runtime. Inline `style.X = Y` is acceptable only for genuinely
runtime values (layout/animation, dynamic colours computed from data,
positioning).

When adding a new widget script:

1. Apply existing `.role-*` classes from the upstream design language
   first. Most patterns (panels, tabs, code blocks, pills, eyebrows,
   metadata key/value pairs, etc.) already have a role.
2. For patterns the upstream design language does not cover yet, add a
   `.role-*` definition under the `// PROPOSED ROLES (pending upstream
   Design Language v3 acceptance)` section in `_sass/_theme.scss` and
   record it in `.claude/upstream-design-additions.md` so the proposal
   can be put to the upstream author.
3. For genuinely page-scoped rules that should not become shared roles
   (SVG selectors, animation keyframes, one-off layout primitives), add
   a `// Widget specifics: <name>` block at the bottom of
   `_sass/_theme.scss` with the original widget prefix retained (e.g.
   `.mcp-arch-desc`, `.gm-table`, `.sensspec-popgrid`).
4. The JS file should reference class names only. If you find yourself
   writing `el.style.color = 'var(--coral)'` or `el.style.cssText =
   'font-family:...; font-size:...'`, that is a regression: those
   values belong in the SCSS recipe.

A historical exception: `.claude/skills/sync-design` may still find
small stragglers of inline type-painting in scripts authored before
the consolidation. Replace them when touched; do not add new ones.

Design revisions arrive as new `Design Language.html` bundle URLs
(`https://api.anthropic.com/v1/design/h/<id>?open_file=Design+Language.html`).
On update, diff the new bundle's `FOUNDATION` map against the current
tokens in `_sass/_theme.scss` and apply only the changed values --
roles auto-update through the foundation.
