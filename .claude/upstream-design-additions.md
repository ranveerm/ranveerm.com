# Proposed additions to Design Language v3

> Send this to the upstream Design Language v3 author. The local Jekyll site
> has surfaced a set of recurring component patterns across its widgets that
> aren't yet expressed as roles in the bundle. Each is currently implemented
> in `_sass/_theme.scss` under a "PROPOSED ROLES" section with a FIXME pending
> upstream confirmation. We'd like canonical names so we can drop the FIXME
> comments and stay in lockstep with future bundle revisions.

## Context

We've just consolidated all widget-specific CSS (formerly injected per-widget
via JS) into the shared `_theme.scss`. While doing so, we discovered patterns
that recur across multiple widgets and deserve to be promoted into shared
roles. Naming follows the existing dotted convention (e.g. `panel.frame`,
`tab.bar`, `viz.callout`).

## Proposed roles

### `control.btn` / `control.btn-accent`

Secondary action button. Mono micro, line border, ink-muted text. Coral
border + coral text on the accent variant (e.g. "next step" affordances).
Used in tab strips, step navigators, toggle bars, control rows.

```
{ font:mono, size:xs, weight:400, color:inkMuted, border:line, radius:4 }
{ ...above, color:coral, border:coral }   // accent
```

### `step.strip` / `step.btn` / `step.card` / `steps.grid`

Numbered step indicators. A `step.strip` is a horizontal row of `step.btn`
controls sitting below a swimlane or timeline; on the active step the text
shifts from ink-faint to ink-primary. A `steps.grid` is a four-up card grid
of `step.card` boxes used to walk through a process; collapses to two
columns under ~700 px.

### `summary.card` / `summary.grid`

Recap card grid used at the foot of a long-form post. Two-up on desktop,
single column on narrow viewports. Each card is paper-raised with a 1 px
line border and 8 px radius.

### `swimlane.frame` / `swimlane.lane` / `swimlane.label` / `swimlane.dot`

Horizontal sequence-diagram swimlanes. The frame holds the row of lanes,
each lane is a centred column with optional label and pulse dot indicator,
labels are mono 9 px eyebrow-tracked, dots are 8 px circles that pulse
when the lane is the active actor in the current step.

### `pill.row` / `pill.mono`

A row of mono pills (e.g. a list of server names along the top of a
multi-server panel). Extends the existing `pill.*` family; `pill.mono`
differs from `pill` in using `border:line` (faint) instead of
`border:inkMuted` and adding an inline-flex layout for a leading icon.

### ~~`link.mono`~~ — withdrawn

Originally proposed for "subject" callouts in primitive lists. On review,
this is just `meta.label` with a coral colour override + interaction
properties. Not worth a dedicated role; the override stays in the consumer.

### ~~`eyebrow.accent`~~ — withdrawn

Originally proposed for coral signal-label eyebrows. On review, numbered
signal labels are better expressed using the existing
`post.section-index` + `post.section-name` pair, which reads as a
nested-section header without inventing a new role.

### `footnote`

Italic muted line under a panel. Mostly text-only: `{ font:text, size:md,
italic:true, color:inkMuted, lh:body }`.

### `info.panel` / `info.label` / `info.body`

Soft callout: paper-raised background, line border, mono eyebrow label,
text body in ink-muted. Distinct from `viz.callout` which uses the coral
wash for stronger emphasis; this one reads as a side-note rather than a
foreground call-to-attention.

### `stats.row` / `stat.cell` / `stat.label` / `stat.value`

Three-up stats strip at the foot of a panel. Each cell holds a mono eyebrow
label above a display-font value (28 px). Cells are divided by hairlines.

### `widget.section-eyebrow` / `widget.section-heading`

In-widget section header. Smaller than `post.section-heading` (which is
the page-level h2 at 38 px); scaled to 24 px so it reads as a sub-heading
inside an embedded module. The eyebrow row reuses the existing
`post.section-rule/index/name` triplet.

### `section-tab.bar` / `section-tab` / `section-tab-active`

Big display-font content-switching tab. Distinct from the existing `tab.*`
family (mono micro caps); used when the tabs read as primary navigation
between content modes inside a section rather than a micro toggle bar.
Coral underline on active. Mobile collapses to vertical segmented list
with a 3 px coral leading bar on the active row.

### `toggle.bar` / `toggle.btn`

Two-button mono toggle (e.g. "JSON / YAML"). Same recipe as `tab.*` but
flexes as a full-width segmented row with coral underline; the active button
also gets a paper-inset background.

### `timeline.step` / `timeline.num`

Numbered step row used inside a panel: 32 px square number cell + body
text. Distinct from `timeline.entry` (the about-page card pattern). Useful
when walking a reader through a sequence of orchestrated actions.

### `annotated` / `annotation.panel` / `annotation.title` / `annotation.body`

Hoverable inline span (token) paired with a sticky panel that surfaces a
description as the reader hovers. The annotation panel is paper-raised
with a sticky-top position; title is 17 px display, body is mono-friendly
prose.

### `config.grid` / `control.bar`

Layout primitives. `config.grid` is a two-column grid (1fr + 260 px) for
"configuration source on the left, hovered annotation on the right";
collapses to one column under ~700 px. `control.bar` is the top-strip
toolbar above a panel body, paper-inset with hairline divider and a
flex-wrap row of controls.

### `term.link`

Dotted-underline reader-discoverable terminology link. Used inline in body
text to mark a word as "click for definition" without the heavier coral
underline of `post.continue` or `link.mono`. Currently lives in a per-post
inline `<style>` block on the Claude Code Environment post; would prefer
to lift to the shared roles.

## Open questions

1. **Naming**: many of these could fit existing namespaces. Should `step.*`
   sit under `viz.*` instead? Is `widget.section-*` better named
   `viz.section-*` since these only appear inside `viz.frame` host
   containers in practice?

2. **Pulse animation**: the swimlane dots need a `@keyframes` rule
   (`role-pulse` locally). Should the design language specify animation
   tokens, or keep them out of scope?

3. **No naming changes requested for existing roles** — the upstream is
   correctly page-agnostic. If any of the above already exist under a
   name I missed, please point me to it.

## Local consumer map (for reference)

After this refactor, every widget consumes only `.role-*` classes (plus a
small "Widget specifics" block per widget in `_theme.scss`). The class
mapping for the MCP exploration widget (the pilot) is recorded in
`_sass/_theme.scss` under "PROPOSED ROLES" and at the top of
"WIDGET SPECIFICS: MCP". Subsequent widgets (claude-environment,
carousel, git-merge, llm-mindmap, sensitivity-specificity, year-in-review
posts) will follow the same playbook.
