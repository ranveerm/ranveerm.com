# Handoff prompt: viz.graphic.* SVG codemod

> Paste the section below into a fresh Claude session running in this
> repo. It briefs a cold session well enough to execute the codemod
> without needing the prior conversation thread.
>
> Project root: `/Users/ranveer/Developer/Web/Personal Websites/ranveerm/ranveerm.com`
> Repo: Jekyll static site (`ranveerm.com` / "Escape Horizon").
> Always read `CLAUDE.md` first; project prose rules apply (no em-dashes,
> stdlib-only Python, never commit unless asked).

---

## Task

Codemod every SVG diagram in the interactive widgets so that shapes,
connectors, and labels consume the upstream `viz.graphic.*` role family
via CSS classes instead of inlining `fill`, `stroke`, `stroke-width`,
`font-family`, `font-size` etc. as SVG presentation attributes. The
upstream Design Language v3 bundle (current cached at
`/tmp/design-sync/current.html`) shipped these roles as class-based on
2026-05-24; the local site adopted everything else from that sync but
deferred this codemod to its own session because it spans 30+ shape
templates across three widget files.

Result you should converge on: visual output identical to before, but
every `<rect>` / `<line>` / `<text>` / `<circle>` inside an SVG widget
either carries a `class="role-viz-graphic-*"` attribute that drives all
visual properties, or inlines only geometry (`x`, `y`, `width`,
`viewBox`, etc.).

## Read first

Before touching anything:

1. `CLAUDE.md` (project rules, prose style, language choices).
2. `_sass/_theme.scss` (single source of truth for every widget
   style). Confirm the existing layout: `:root` foundation tokens,
   `_design-dark-palette` mixin, then a long list of `.role-*` rules.
3. `_sass/_theme.scss` should NOT yet contain `.role-viz-graphic-*`
   classes when you start. You will be adding them.
4. The upstream role specs: extract from `/tmp/design-sync/current.html`
   by searching for `'viz.graphic.`. If the file isn't there, run:
   ```bash
   bash .claude/skills/sync-design/scripts/fetch_bundle.sh \
     "https://api.anthropic.com/v1/design/h/HAV4UvY269z6gjqP37z3ow?open_file=Design+Language+v3.html"
   ```
   That bundle hash may have rolled forward by the time you read this.
   If the user provides a new URL, use that. The role specs are stable
   across bundle revisions unless explicitly noted in the diff.

## What "class-based consumption" means here

The current pattern in the widgets is:

```html
<!-- mcp-exploration.js §3 architecture diagram, example -->
<rect x="40" y="60" width="100" height="36" rx="3"
      fill="var(--paper-inset)" stroke="var(--line)"/>
<text x="90" y="83" text-anchor="middle"
      font-family="var(--font-mono)" font-size="11"
      fill="var(--ink-secondary)">Host</text>
```

The target pattern is:

```html
<rect x="40" y="60" width="100" height="36" rx="3"
      class="role-viz-graphic-node"/>
<text x="90" y="83" text-anchor="middle"
      class="role-viz-graphic-label">Host</text>
```

The SCSS rule then carries `fill`, `stroke`, `stroke-width`,
`font-family`, `font-size`, `font-weight`, `letter-spacing`, and
`text-transform` (for labels). Geometry attributes (`x`, `y`, `rx`,
`width`, `height`, `text-anchor`, `viewBox`) **stay inline** because
they're shape-specific, not styling.

## Upstream role recipes

Map each `viz.graphic.*` role to a `.role-viz-graphic-*` CSS class.
These are the upstream specs verbatim (post-2026-05-24 sync, all-dotted
keys translated to all-dashes for CSS via the canonical rule):

| Role key (upstream)            | CSS class                              | Recipe |
|--------------------------------|----------------------------------------|--------|
| `viz.graphic.node`             | `.role-viz-graphic-node`               | `fill: var(--paper-raised); stroke: var(--line); stroke-width: 1; rx: 6;` + text inside uses `fill: var(--ink-secondary); font-family: var(--font-mono); font-size: 13px;` (size-smd) |
| `viz.graphic.node.strong`      | `.role-viz-graphic-node-strong`        | `fill: var(--paper-raised); stroke: var(--coral); stroke-width: 1.25; rx: 6;` + text `fill: var(--coral); font-weight: 500;` |
| `viz.graphic.node.circle`      | `.role-viz-graphic-node-circle`        | same fill/stroke as `node` but no radius (circle gets its `r` attribute inline) |
| `viz.graphic.node.outline`     | `.role-viz-graphic-node-outline`       | `fill: var(--paper-raised); stroke: var(--ink-muted); stroke-width: 1; rx: 6;` |
| `viz.graphic.node.outline.clear`| `.role-viz-graphic-node-outline-clear`| `fill: transparent; stroke: var(--ink-muted); stroke-width: 1; rx: 6;` |
| `viz.graphic.node.outline.solid`| `.role-viz-graphic-node-outline-solid`| `fill: var(--ink-muted); stroke: var(--ink-muted); stroke-width: 1; rx: 6;` + text `fill: var(--paper-raised); font-weight: 500;` |
| `viz.graphic.connector`        | `.role-viz-graphic-connector`          | `stroke: var(--ink-muted); stroke-width: 1; fill: none;` |
| `viz.graphic.connector.thick`  | `.role-viz-graphic-connector-thick`    | `stroke: var(--ink-muted); stroke-width: 1.5; fill: none;` |
| `viz.graphic.connector.strong` | `.role-viz-graphic-connector-strong`   | `stroke: var(--coral); stroke-width: 1.5; fill: none;` |
| `viz.graphic.label`            | `.role-viz-graphic-label`              | `fill: var(--ink-faint); font-family: var(--font-mono); font-size: 11px; (size-xs) letter-spacing: var(--track-eyebrow); text-transform: uppercase;` |
| `viz.graphic.label.strong`     | `.role-viz-graphic-label-strong`       | `fill: var(--coral); font-family: var(--font-mono); font-size: 12px; (size-sm)` |

**CSS gotcha:** SVG presentation attributes like `fill`, `stroke`, and
`stroke-width` are styleable via CSS but the property syntax is the
same as the attribute (no hyphens, e.g. `fill` not `background-color`).
`text-transform` and `font-family` work on SVG `<text>` elements.

## Widgets to codemod

Three files, plus a sanity-check on a fourth:

### 1. `scripts/mcp-exploration.js`

- **§1 (problem) M×N diagram** (around lines 200-260): host rects,
  system rects, connection lines, hub label rect, MCP label text,
  M HOSTS / N SYSTEMS eyebrow text. Roughly 12 inline-attribute groups.
- **§3 (architecture) diagram** (around lines 450-720): host group
  rect, client rects, server rects, LLM circle, user icon, process
  boundary line, REMOTE/LOCAL labels. Roughly 14 groups.
- **§6 (prompt flow) swimlane** (around lines 870-960): lane rects,
  dot circles, step labels. Mostly handled by the swimlane.* roles
  already, but a few inline `<text>` labels likely remain.

### 2. `scripts/git-merge.js`

- **§1 (merge base) commit graph**: commit circles (currently rendered
  as `<circle>` with inline `fill`/`stroke`), branch lines, HEAD/main/
  feature labels, Merge Base label (use `label.strong`).
- **§4 (inside a merge commit) parent-pointer diagram**: same shape
  inventory as §1.
- **§6 (rebase) diagram**: commit nodes split between original and
  rebased; coral connector for the rebased path (use
  `connector.strong`).

### 3. `scripts/llm-mindmap.js`

- The cluster mindmap canvas: 22 node circles (use `node.circle`), edge
  lines (`connector` neutral; `connector.strong` for the active
  selection's connections), cluster eyebrow labels (use `label`),
  active-state node (use `node.strong`).

### 4. `scripts/sensitivity-specificity.js` (sanity check only)

The population dot grid uses categorical hues (green/red/purple/blue)
that are explicitly excepted from token-only styling in CLAUDE.md.
**Do NOT touch this file.** The dots are not viz.graphic.* primitives;
they're statistical category markers. Confirm by scanning for `<circle>`
in this file and verifying the `fill` attribute uses a `COLORS[key]`
runtime value rather than a foundation token.

## Execution order

1. **Add the eleven `.role-viz-graphic-*` rules to `_sass/_theme.scss`.**
   Place them inside the existing block headed
   `// PROPOSED ROLES` if it still exists, or wherever the other
   `viz.*` roles live (search for `.role-viz-callout`). Each rule
   follows the recipe table above. Use `rx` as a CSS property on
   `<rect>` elements (CSS-level rx is supported in all modern browsers
   for SVG; if testing reveals an issue, fall back to leaving `rx` as
   an inline attribute on the element).

2. **Baseline screenshots.** Run `/preview` if no server is running.
   Visit each refactored page in turn, capture full-page screenshots
   in both light and dark mode. The pages are:
   - `/jekyll/update/2026/04/27/Exploring-Model-Context-Protocol-MCP.html`
   - `/jekyll/update/2026/05/06/The-Shape-of-a-Language-Model.html`
   - `/jekyll/update/2026/05/08/Exploring-Git-Merge.html`

   Save the screenshot paths or hashes; they'll be the comparison
   baseline.

3. **Codemod one widget at a time, in this order:**
   `mcp-exploration.js` → `llm-mindmap.js` → `git-merge.js`. After
   each file, reload preview and visual-diff. Don't move to the next
   file until the current one is verified.

   For each SVG template inside the file:
   - Identify the shape's role (rect with paper-raised fill + line stroke = `node`; line with inkMuted = `connector`; etc.).
   - Replace inline `fill="..."`, `stroke="..."`, `stroke-width="..."`,
     `font-family="..."`, `font-size="..."`, `fill="..."` (for text)
     attributes with a single `class="role-viz-graphic-..."` attribute.
   - Leave geometry attributes untouched: `x`, `y`, `width`, `height`,
     `cx`, `cy`, `r`, `rx`, `ry`, `viewBox`, `text-anchor`, `dy`,
     `transform`, `points`.
   - JS template literals: if the attribute was being built from a
     variable (e.g. `fill={someColor}`), check whether the variable was
     ever assigned a different colour at runtime. If it's always the
     same role colour, replace with the class. If it's dynamic (e.g.
     per-server accent), leave inline and note the exception.

4. **Verification per widget.** Use `mcp__Claude_Preview__preview_inspect`
   to read `getComputedStyle()` for representative shapes:
   - A `node` rect: expect `fill: rgb(255,255,255)` (light) / `rgb(47,47,51)` (dark), `stroke: rgb(232,230,225)` (light) / `rgb(58,58,62)` (dark), `stroke-width: 1`.
   - A `connector`: expect `stroke: rgb(110,110,115)` / `rgb(154,154,160)`, `stroke-width: 1`, `fill: none`.
   - A `label`: expect `fill: rgb(154,154,159)` / `rgb(110,110,116)`, `font-family: ui-monospace`, `font-size: 11px`, `text-transform: uppercase`.

   If the computed values don't match the recipe, the SCSS rule isn't
   winning over a more-specific selector. Debug by reading the cascade
   in `preview_eval`.

5. **Mobile check.** Resize to 375px and screenshot each page again.
   SVG viewBoxes already scale; this is just a sanity check that no
   inline attribute regression broke the responsive sizing.

6. **Final report.** A short table:
   - Files touched (SCSS rule additions + JS attribute removals)
   - Number of inline-attribute groups flipped per file
   - Computed-style verification results
   - Any shape that retained inline attributes (and why)

## Anti-patterns to avoid

- **Don't move `viewBox`, `x`, `y`, `width`, `height`, `cx`, `cy`, `r`,
  `rx`, or `transform` into CSS.** These are geometry, not styling.
- **Don't touch `sensitivity-specificity.js`.** The categorical dot
  colours are an explicit CLAUDE.md exception.
- **Don't introduce new role names.** Use only the eleven specs in
  the recipe table; if a shape doesn't fit any of them, flag it in the
  report rather than inventing.
- **Don't add `injectStyles` arrays or `<style>` element creation to
  any JS file.** That's the consolidation we just unwound. Class
  references only.
- **Don't commit.** The user runs `/commit` or `/ship` when ready.

## Project conventions reminder

- **No em-dashes** anywhere (post content, comments, commits, code
  strings). Use commas, colons, parentheses, or two sentences.
- **ASCII-only SCSS.** Jekyll's Ruby SCSS converter rejects non-ASCII
  characters. Replace any em-dash, en-dash, ellipsis, or smart-quote
  with the ASCII equivalent before saving.
- **All edits to `_theme.scss` should round-trip through the existing
  light/dark structure.** Foundation tokens live under `:root`; dark
  remapping lives in the `_design-dark-palette` mixin. Role classes
  reference tokens via `var(--*)`; they don't need duplication.
- **No new tokens.** This codemod only consumes existing foundation
  tokens through new `.role-viz-graphic-*` classes.

## Why this is worth doing

Two reasons:

1. **Centralisation.** A future upstream tweak (e.g. `viz.graphic.connector`
   `stroke-width` from 1 to 1.25) propagates by editing one SCSS rule
   instead of `git grep`-ing every inline attribute across three widget
   files.
2. **Cascade hygiene.** Inline SVG attributes have a different
   specificity story than CSS classes (attributes can only be
   overridden by `!important` rules or by other inline values). Moving
   to classes means every shape participates in the same cascade as
   the rest of the site, and theme overrides via `[data-theme="dark"]`
   propagate uniformly.

Roughly 30 to 45 minutes start-to-finish. Don't rush; the failure mode
is silent visual drift on shapes you skipped or miscategorised.

---

**Generated:** 2026-05-24, after upstream Design Language v3 bundle
`HAV4UvY269z6gjqP37z3ow` synced the class-based `viz.graphic.*`
family. The local site adopted every other role from that sync
immediately; this codemod is the one remaining piece.
