---
name: sync-design
description: Syncs the local Jekyll site's design tokens and component recipes with an updated Claude Design "Design Language v3" bundle. Use whenever the user shares an upstream bundle URL (typically `https://api.anthropic.com/v1/design/h/<id>?open_file=Design+Language+v3.html`) and asks to adopt, apply, sync, pull in, or update the local design from it. Also use when the user wants to audit whether the local theme is still in step with a known upstream version. Takes one argument: the bundle URL.
---

# Sync Design

Diff-applies upstream design language changes to the local Jekyll site at the repository root (this skill lives inside that repo).

> **Provenance note (2026-05-24):** every widget style now lives in `_sass/_theme.scss`. JS files reference `.role-*` class names but no longer inject stylesheets at runtime. A small "Widget specifics: <name>" SCSS block remains per widget for genuinely page-scoped rules (SVG selectors, animation hooks, one-off layout). If you find a JS file still defining role-equivalent property bundles, that is a regression of the consolidation effort: flag it instead of editing it.

## Argument

`$1`: the upstream bundle URL.

If the user invokes the skill without a URL, ask for it before doing anything else. Do not guess from prior context: bundles are content-addressed and the URL changes with every revision.

## Why this skill exists

The upstream bundle is the source of truth, not the local CSS. Earlier sessions burned time concluding "the tabs are aligned with the design system" by reading only the local theme. The local theme had picked the nearest tokens during the previous migration (e.g. `var(--size-lg)` = 16px) when the upstream literal was 22, then 18. "Uses tokens" is not the same as "uses the right tokens". Always diff against the fetched bundle.

The bundle itself is a 10MB+ gzipped tar, past WebFetch's cap. `curl` is mandatory.

## Workflow

### 1. Fetch and extract

Run the bundled script:

```bash
bash .claude/skills/sync-design/scripts/fetch_bundle.sh "<URL>"
```

It downloads, decompresses, extracts `escape-horizons-revamp/project/Design Language v3.html`, and rotates any previously cached bundle to `previous.html`. Working files live in `/tmp/design-sync/`.

Report the diff size to the user. If there is no previous bundle the script says so.

### 2. Inspect the diff

If a previous bundle exists, start with the diff:

```bash
diff -u /tmp/design-sync/previous.html /tmp/design-sync/current.html
```

The bundle is a single React JSX file. Relevant landmarks (line numbers shift slightly between revisions, search by name):

- `const FONTS = { serif, sans, mono }`
- `const SIZE = { xs, sm, smd, md, lg, xl, h2, h2b, h2l, h1, h1l }`
- `const TRACK = { tight, snug, normal, loose, eyebrow }`
- `const LH = { tight, snug, normal, body, loose }`
- `const FOUNDATION = { light: {...}, dark: {...} }`: colour primitives, syntax colours, table surfaces, line-highlight washes.
- `roles` object: keyed by name (`system.primary`, `post.title`, `viz.row-title`, `panel.frame`, `panel.bar`, `panel.title`, `panel.body`, `tab`, `tab-active`, `code.block`, `code.inline`, `table.header`, etc.). Each role is a recipe of foundation tokens.
- Exemplar components further down (panel exemplar, tab exemplar, dropdown exemplar, code-block exemplar, etc.) that show how recipes get composed in real components and sometimes override one property inline.

If there is no previous bundle, read `current.html` directly and summarise FOUNDATION, FONTS / SIZE / TRACK / LH, and any roles whose names suggest they are likely consumed locally (panel.\*, tab.\*, code.\*, viz.\*).

### 3. Classify each change

Two flavours:

**Foundation token edits** (colour values, sizes, line-heights, font stacks). These propagate through the local site via CSS custom properties. Update `_sass/_theme.scss` only: `:root` for light values, and the `_design-dark-palette` mixin (referenced under `[data-theme="dark"]`) for dark values. Roles automatically inherit because they reference `var(--token)`.

**Role edits or new roles** (component recipes: which font/size/weight/colour bundle a tab title uses, what padding a panel bar gets, etc.). Post-consolidation, every consumer of a role lives in `_sass/_theme.scss` — either as a `.role-*` class definition or as a widget-specific rule under the per-widget "Widget specifics" SCSS block. JS files only reference class names; they do not redefine recipes.

### 4. Find local consumers

For each changed role or token, grep `_sass/_theme.scss` first; that is now the single source of truth for visual recipes:

```bash
rg '<token-or-recipe-signature>' _sass
```

Useful signatures:

- A foundation token rename: grep for the kebab-case name, e.g. `rg 'paper-raised' _sass`.
- A role recipe change: grep for the identifying property in the role, e.g. `rg 'font-size: 22px' _sass`.
- A new role: grep for the closest existing role name under `_sass/_theme.scss` and consider whether it should consolidate or coexist.

Then sanity-check `scripts/` only for **class-name references** (no rule bodies should live there):

```bash
rg '\.role-[a-z-]+' scripts | head
```

If a JS file is still defining a role-equivalent property bundle (i.e. an `injectStyles` array, a `.cssText` assignment that duplicates a `.role-*` recipe, or a `<style>` element being created at runtime), that is a regression of the consolidation effort. Flag it to the user — do not silently edit it as part of a design sync.

Common consumer landmarks in `_sass/_theme.scss`:

- `:root` and `_design-dark-palette`: foundation tokens (the only place colours, sizes, fonts get declared).
- The block headed "PROPOSED ROLES": shared roles surfaced from the widget consolidation, pending upstream acceptance (see `.claude/upstream-design-additions.md`). Treat these as authoritative locally until upstream confirms canonical names.
- One "Widget specifics: <name>" block per widget (mcp, ce, gm, llmmap, sensspec, carousel) for genuinely page-scoped rules. These are short and well-isolated.

### 5. Apply changes

Mirror upstream literally. The upstream JSX often uses literal numbers (e.g. `fontSize: 18`) instead of token references because not every value has a token. If the bundle uses a literal, the local should use the same literal (e.g. `font-size: 18px`), not the nearest token. If the bundle uses a token, use the matching CSS variable.

Specific rules:

- **Foundation tokens**: edit the `--token-name` lines in `_sass/_theme.scss`. Light values live under `:root`; dark values live in `_design-dark-palette`. Do not add tokens that the upstream FOUNDATION does not have.
- **Role edit on an existing `.role-*` class**: update the property bundle in `_sass/_theme.scss`. Consumers (JS widgets) reference the class by name and pick up the change automatically.
- **Role edit on a class still under "Widget specifics"**: update the property bundle in the same SCSS block. If the change suggests the rule has become shareable (recurs in multiple widgets), promote it to a `.role-*` class under "PROPOSED ROLES" and update consumers.
- **New role accepted by upstream**: add a `.role-*` class to `_sass/_theme.scss` mirroring the recipe. If the upstream name corresponds to one already in `.claude/upstream-design-additions.md`, drop the FIXME comment and the entry from that scratch file.

Stay minimal. Touch only what the diff demands. Do not "tidy up" unrelated tokens or refactor consumers beyond the requested change. Earlier sessions left bespoke widget-specific recipes untouched for the right reasons until an explicit alignment request came in; do not preempt those decisions.

### 6. Verify

The Jekyll preview server is usually already running. List servers via the Claude Preview MCP:

```
mcp__Claude_Preview__preview_list
```

If nothing is running, invoke the `/preview` skill or start the `jekyll` entry from `.claude/launch.json`.

For each affected component, navigate the preview to the post that exercises it and read computed styles. Do not trust visual diff alone. For numeric properties (size, weight, padding, border width) read `getComputedStyle()` and assert exact match. Pattern:

```js
mcp__Claude_Preview__preview_eval({
  serverId: "<id>",
  expression: "Array.from(document.querySelectorAll('<selector>')).map(el => { var cs = getComputedStyle(el); return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, padding: cs.padding }; })"
})
```

If the upstream changed a recipe used across multiple posts (e.g. the Claude Code Environment post and the MCP post both use the same `panel.title` recipe), verify each independently.

Check `mcp__Claude_Preview__preview_console_logs` with `level: "error"` after the changes to catch script breakage.

### 7. Report

Close with a tight summary, not a wall of text:

- One line on what upstream changed (e.g. "New role `panel.title` shared by inspector, dropdown, and tab titles; recipe is serif/18/500/snug/inkPrimary").
- A short table or bullet list of files and rule names touched.
- Verified surfaces, and any surfaces still to verify (be explicit when something was not checked).
- Do not commit. Do not stage. Wait for the user to ask.

## Anti-patterns

- Inferring upstream from local CSS or from memory.
- Bulk renaming token references "while you're in there".
- Adding tokens or roles not present in upstream FOUNDATION.
- Skipping the `getComputedStyle` check because the screenshot looks fine.
- Picking the "nearest token" when the upstream uses a literal value. Mirror upstream exactly.
- Committing changes without the user's explicit instruction.

## Notes on the local theme

The local theme has consciously diverged from upstream on a few axes:

- `--font-display` and `--font-text` both map to `gill-sans-nova`. Upstream `FONTS.serif` (Source Serif 4) has no local equivalent. When upstream specifies `FONTS.serif`, the local mapping is `var(--font-display)`. Flag this for the user only if they ask why a serif recipe does not look serif.
- The local theme caches FOUNDATION values in `:root` (light) and re-maps them via `_design-dark-palette` (dark). Match the upstream split when applying changes.

Adopt new upstream values silently when they fit the local theme's structure. Do not invent a serif token or rename existing tokens unless the user asks for it explicitly.
