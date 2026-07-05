# Prompt for upstream Design Language v3 update

> **STATUS: RESOLVED.** Upstream landed every proposed change in bundle
> `HAV4UvY269z6gjqP37z3ow` on 2026-05-24. Local sync applied the same
> day; see `_sass/_theme.scss` for the post-sync state. The content
> below is preserved as the historical audit + proposal thread.
>
> Outcome at a glance:
> - **§5 separator migration:** all-dotted atomic segments adopted.
> - **§4 tab cleanup:** mono `tab`/`tab-active` deleted; tabs consume
>   `panel.title` directly with paper-inset bg + coral border on active.
> - **§3 new roles:** every proposed family accepted (control.\*,
>   step.\*, summary.\*, swimlane.\*, info.\*, stats.\*/stat.\*,
>   annotation.\*, config.grid, footnote, term.link, pill.row/mono).
> - **Naming overrides upstream chose:** `timeline.step/num` → `flow.step/num`
>   (timeline.entry reserved for about-page cards); `widget.section-*` →
>   `viz.section.heading` (no new `widget.*` namespace).
> - **Dropped:** `toggle.bar` / `toggle.btn` (no live consumer).
> - **viz.graphic.\*:** confirmed as class-based consumption. Local SVG
>   widgets still inline attributes; codemod deferred (see "remaining
>   work" in `.claude/plans/`).

---

> Generated from a delta audit of the local Jekyll site (`ranveerm.com`)
> against bundle `7ySOqBLCb-cM6lDCAhG4wA`. Send this verbatim to the
> upstream Design Language v3 author. The intent is to bring the two
> documents into perfect lockstep so future bundles can sync cleanly
> through `.claude/skills/sync-design`.

## Context

We have just finished consolidating every interactive-widget stylesheet
on the site into `_sass/_theme.scss`, mirroring the upstream `roles`
map as faithfully as possible. The audit ran a structural diff of the
upstream `FOUNDATION` and `roles` against the local SCSS. Findings
below, grouped by what action they imply.

## 1. Foundation tokens: no diff

Every upstream `light` and `dark` foundation token matches the local
`:root` and `_design-dark-palette` mixin **byte-for-byte**:

- Surfaces (paper, paperRaised, paperInset, codeInlineBg, paperSunk)
- Ink (inkPrimary, inkSecondary, inkMuted, inkFaint, line)
- Highlight (coral, coralStrong, coralWash)
- Syntax (sx_text, sx_keyword, sx_string, sx_comment, sx_path)
- Line highlights (hl_addBg/Rule, hl_delBg/Rule, hl_infoBg/Rule)
- Table surfaces (tableHead, tableBody, tableLine)

No action required.

Local also carries six **extension tokens** that don't have an upstream
counterpart but are intentionally local: `--sb-track`, `--sb-thumb`,
`--sb-thumb-hover`, `--sb-thumb-active` (Firefox/WebKit scrollbar
customisation, no upstream story), and `--color-tag-bg` / `--color-tag-ink`
(Minima backward-compat aliases). These don't need upstream attention.

## 2. Upstream roles we are NOT yet consuming locally

17 upstream roles have no consumer in the local site. Most are
trivially adoptable; surfacing here so upstream knows they don't
currently flow through to a rendered page.

### a. Useful, will add locally

- **`panel.title`** -- the architecture-description heading in the MCP
  widget currently uses an inline 22 px display recipe. We should
  switch to `role-panel-title` (upstream specifies 18 px serif/500).
  Visual delta: -4 px, +100 weight. Worth aligning.

### b. Convenience color-only roles, low priority

- `system.background`, `system.hairline`, `system.surface`,
  `system.surface-inset`, `system.surface-sunk` -- these are pure
  colour roles that just read a foundation token. Local consumers
  reference the tokens directly (`var(--paper)` etc.) instead. Not a
  gap, but happy to add the class wrappers for parity.

### c. Graphics primitives, currently inlined in SVG attributes

The `viz.graphic.*` family (11 roles: node, node-strong, node-circle,
node-outline, node-outline-clear, node-outline-solid, connector,
connector-thick, connector-strong, label, label-strong) is fully
specified upstream but local widgets (MCP architecture, LLM mindmap,
sensitivity dot grid) inline `font-family="var(--font-mono)"`,
`fill="var(--paper-inset)"`, `stroke="var(--line)"` directly on SVG
elements.

This is a tooling gap, not a design gap. Question: is the intended
usage `<rect class="role-viz-graphic-node">` (SVG element with class
attribute that consumes the role recipe)? If yes, we'll lift the
inline attribute styling to class references. If the upstream
exemplar treats these as guidance only (always inlined), say so and
we'll keep the inline attributes.

## 3. Roles we have invented locally, proposing for upstream

These patterns recur across two or more local widgets and are
currently sitting under a `// PROPOSED ROLES (pending upstream
Design Language v3 acceptance)` block in `_sass/_theme.scss` with
FIXME comments. Proposed names follow the existing dotted convention.
Please confirm naming, propose alternatives, or merge into existing
roles if there's overlap I've missed.

### `control.btn` / `control.btn-accent`

Secondary action button used in tab strips, step navigators, toggle
bars, configuration toolbars. Mono xs, line border, ink-muted text.
Accent variant uses coral border + coral text.

```
{ font:mono, size:xs, weight:400, color:inkMuted, border:line, radius:4 }
{ ...above, color:coral, border:coral }   // accent
```

### `control.bar`

Horizontal toolbar above a panel body. Paper-inset background, hair-
line divider, padded gap, flex-wrap row of controls. Hosts
`control.btn` instances.

### `step.strip` / `step.btn` / `step.card` / `steps.grid`

Numbered step indicators.
- `step.strip` -- horizontal row of `step.btn` controls below a swim-
  lane or timeline. Active step shifts from ink-faint to ink-primary.
- `steps.grid` -- four-up card grid of `step.card` boxes used to walk
  the reader through a process. Collapses to two columns under ~700 px.

### `summary.card` / `summary.grid`

Recap card grid at the foot of long-form posts. Two-up on desktop,
single column on narrow viewports. Each card is paper-raised, 1 px
line border, 8 px radius.

### `swimlane.frame` / `swimlane.lane` / `swimlane.label` / `swimlane.dot`

Horizontal sequence-diagram swimlanes (host-client-server message
flow, prompt-to-tool walkthrough). Frame holds the row; each lane is
a centred column with optional label and pulse dot indicator. Labels
are mono 9 px eyebrow-tracked. Dots are 8 px circles that pulse when
the lane is the active actor at the current step.

### `pill.row` / `pill.mono`

Extends the existing `pill.*` family.
- `pill.row` -- a horizontal flex-wrapped row of pills (e.g. server-
  name list along the top of a multi-server panel).
- `pill.mono` -- variant of `pill` with `border:line` (faint) instead
  of `border:inkMuted`, and an inline-flex layout that admits a
  leading icon.

### `info.panel` / `info.label` / `info.body`

Soft callout: paper-raised background, line border, mono eyebrow
label, body text in ink-muted. Distinct from `viz.callout` which uses
the coral wash for stronger emphasis; `info.panel` reads as a
side-note rather than a foreground call-to-attention.

### `stats.row` / `stat.cell` / `stat.label` / `stat.value`

Three-up stats strip at the foot of a panel. Each cell holds a mono
eyebrow label above a 28 px display-font value. Cells separated by
hairlines.

### `widget.section-eyebrow` / `widget.section-heading`

In-widget section header. Smaller than `post.section-heading` (page-
level h2 at 38 px); scaled to 24 px so it reads as a sub-heading
inside an embedded module. The eyebrow row reuses the existing
`post.section-rule` + `post.section-index` + `post.section-name`
triplet.

Naming question: should this sit under `viz.section-*` since these
only appear inside `viz.frame` host containers in practice?

### `section-tab.bar` / `section-tab` / `section-tab-active`

Big display-font content-switching tab. Distinct from the existing
`tab.bar` (mono micro caps); used when the tabs read as primary
navigation between content modes inside a section rather than a
micro toggle bar. Coral underline on active. Mobile collapses to
vertical segmented list with a 3 px coral leading bar on the active
row.

Naming question: could this replace `tab.bar` if mono-cased active
tabs are uncommon? We currently render the mcp-toggle-bar pattern in
mono and the §3/§4/§9 tabs in display.

### `toggle.bar` / `toggle.btn` (orphaned after the refactor)

Two-button mono toggle (e.g. "JSON / YAML"). Same recipe as `tab.*`
but flexes as a full-width segmented row. Currently has no live
consumers locally (the MCP §1 toggle was unified into `section-tab`).
**Open question for you: is this pattern useful enough upstream to
keep, or shall I drop the local definitions entirely?**

### `timeline.step` / `timeline.num`

Numbered step row used inside a panel: 32 px square number cell + body
text. Distinct from the existing `timeline.entry` (the about-page
card pattern). Useful when walking a reader through a sequence of
orchestrated actions.

Naming question: could be `flow.step` / `flow.num` if `timeline.*`
should stay reserved for the about-page card layout.

### `annotated` / `annotation.panel` / `annotation.title` / `annotation.body`

Hoverable inline span (token) paired with a sticky panel that
surfaces a description as the reader hovers. The panel is paper-
raised with `position:sticky`; title is 17 px display 500; body is
mono-friendly prose.

### `config.grid`

Two-column grid layout primitive (1fr + 260 px) for "configuration
source on the left, hovered annotation on the right". Collapses to
one column under ~700 px.

### `footnote`

Italic muted line under a panel. `{ font:text, size:md, italic:true,
color:inkMuted, lh:body }`.

### `term.link`

Dotted-underline reader-discoverable terminology link. Inline span
in body prose to mark a word as "click for definition" without the
heavier coral underline of `post.continue` or `link.mono`. Reader-
cue only; hover/click behaviour wired by the consumer.

## 4. Roles withdrawn

These were drafted earlier as local additions but withdrawn during
the consolidation because they duplicate existing upstream patterns
with a small contextual override:

- ~~`link.mono`~~ -- equivalent to `meta.label` with a coral colour
  override + interaction styling (cursor/underline). Not worth a
  dedicated role.
- ~~`eyebrow.accent`~~ -- numbered signal labels read better as the
  existing `post.section-index` + `post.section-name` pair (coral
  number + ink-faint name), which is already the canonical
  numbered-section visual.

## 5. Separator convention: switch to all-dotted with atomic segments

The current bundle uses **both** dots and hyphens in role keys:

- `.` separates namespace levels: `post.eyebrow`, `viz.graphic.node`
- `-` separates words **within** a single segment:
  `post.section-heading`, `viz.graphic.node-outline-clear`

This is internally consistent in JS (object keys are strings) but it
**doesn't round-trip to CSS**. When a downstream consumer flattens a
role key into a CSS class name, both `.` and `-` collapse to `-`:

| Upstream key                       | Local CSS class                           |
|------------------------------------|-------------------------------------------|
| `post.section-heading`             | `.role-post-section-heading`              |
| `viz.graphic.node-outline-clear`   | `.role-viz-graphic-node-outline-clear`    |

Reverse-mapping the CSS class back to the upstream key is **impossible
without the source**. `.role-post-section-heading` could be any of
`post.section-heading`, `post.section.heading`, or
`post-section.heading`. This bit our audit tooling on the present
sync (we had to heuristic our way to "all dashes" and accept false
positives).

**Recommendation: switch every role key to all-dotted with atomic
segments.** Compound segments get split at hyphens; each segment then
holds a single word.

| Current key                       | Proposed key                              |
|------------------------------------|------------------------------------------|
| `post.section-heading`            | `post.section.heading`                    |
| `post.section-index`              | `post.section.index`                      |
| `post.section-name`               | `post.section.name`                       |
| `post.section-rule`               | `post.section.rule`                       |
| `post.title-feed`                 | `post.title.feed`                         |
| `nav.link-current`                | `nav.link.current`                        |
| `panel.frame` / `panel.bar` / ...  | unchanged (already atomic)               |
| `tab.bar`                         | unchanged                                 |
| `code.hl-add` / `-del` / `-info`  | `code.hl.add` / `.del` / `.info`          |
| `code.prompt-glyph`               | `code.prompt.glyph`                       |
| `viz.frame-active`                | `viz.frame.active`                        |
| `viz.row-selected` / `-title` / `-sub` | `viz.row.selected` / `.title` / `.sub` |
| `viz.section-label`               | `viz.section.label`                       |
| `viz.callout-rule`                | `viz.callout.rule`                        |
| `viz.graphic.node-strong`         | `viz.graphic.node.strong`                 |
| `viz.graphic.node-circle`         | `viz.graphic.node.circle`                 |
| `viz.graphic.node-outline`        | `viz.graphic.node.outline`                |
| `viz.graphic.node-outline-clear`  | `viz.graphic.node.outline.clear`          |
| `viz.graphic.node-outline-solid`  | `viz.graphic.node.outline.solid`          |
| `viz.graphic.connector-thick` / `-strong` | `viz.graphic.connector.thick` / `.strong` |
| `viz.graphic.label-strong`        | `viz.graphic.label.strong`                |
| `table.head-cell`                 | `table.head.cell`                         |
| `table.cell-mono` / `-meta`       | `table.cell.mono` / `.meta`               |
| `toc.row-flash`                   | `toc.row.flash`                           |
| `system.highlight-strong`         | `system.highlight.strong`                 |
| `system.surface-inset` / `-sunk`  | `system.surface.inset` / `.sunk`          |

After the migration, the rule for downstream consumers becomes:
**replace every `.` with `-` to get the CSS class name.** Lossless and
trivial to codemod in either direction.

Two caveats to call out so they don't surprise reviewers:

- **`code.hl.add` reads as a sub-namespace.** It really is one ("hl"
  is a family of three: add, del, info), so the nested form arguably
  models the semantics better than the current hyphenated form.
- **`viz.graphic.node.outline.clear` is four levels deep.** That's
  the deepest leaf in the catalogue. Acceptable because `outline` is
  a meaningful sub-category of `node` (parallel to `circle`, the
  default `node`, and `strong`), and `clear` / `solid` are then
  variants of `outline`. The hierarchy is real.

This is the single highest-leverage cleanup for downstream tooling
(linters, sync scripts, codemods, the local audit that just bit on
this) and worth doing before the role catalogue grows further.

## 6. Open process question

The proposed names above largely follow the existing dotted
convention, but a few might fit better under existing namespaces
(noted inline). If you'd prefer to merge the proposed roles into the
existing `viz.*` / `panel.*` / `post.*` namespaces, please indicate
the merges and we'll rename locally to match.

Once a bundle revision lands with any/all of these accepted, we'll
bulk-rename in `_theme.scss`, drop the corresponding entries from
this document, and remove the `PROPOSED ROLES` section header.

---

**Generated:** 2026-05-24, against bundle
`7ySOqBLCb-cM6lDCAhG4wA?open_file=Design+Language+v3.html`
(byte-identical to the prior `vx4XEX_pZkQsz_g0OZlvzw` bundle; no
upstream changes detected between the two URLs).
