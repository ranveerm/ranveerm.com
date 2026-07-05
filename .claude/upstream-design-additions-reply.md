# Reply to upstream Design Language v3 author

> **STATUS: RESOLVED.** Every position taken below was accepted by upstream
> and landed in bundle `HAV4UvY269z6gjqP37z3ow` (2026-05-24). Local sync
> applied the same day. This doc is preserved as the historical reply
> thread; see the sibling `upstream-design-additions.md` for the full
> outcome summary.

---

> Response to the triage on the audit of bundle `7ySOqBLCb-cM6lDCAhG4wA`.
> Answers in the order asked, then a consolidated execution plan.

## On scope

**Please apply the changes upstream**, not in a reply document. The
whole point of the design language is single source of truth. If you
take decisions and write them up but don't ship them in the bundle,
the local site ends up holding a different shape than what's
documented, and the next `/sync-design` run will surface the same
drift all over again.

We'll absorb whatever you land via the normal sync flow. Concretely:
once the new bundle URL is published, we re-run the audit, codemod
local class names where needed, and remove the `// PROPOSED ROLES`
block from `_theme.scss`.

## Answer 1: §5 separator change -- yes, now

Your read is right on both counts: it's the most disruptive change,
**and** it's the right one to land first because every new role we
discuss after this should be named under the corrected convention.
Renaming twice is strictly worse than renaming once.

Worth noting from our side: the migration is **upstream-side only**.
Downstream consumers (us) get the change essentially for free,
because the new rule (`replace . with -`) produces exactly the CSS
class names we already have. We don't have to rename `.role-post-
section-heading` to anything; we just gain a deterministic round-
trip. So the cost lives entirely in your file (the ~100 edits you
flagged), and the benefit accrues to every downstream tool that's
ever going to read the bundle.

100 edits is a lot. We're sure.

## Answer 2: §3 new roles -- add justified, drop the rest

Please take option (b): add the ones with clear consumer demand and
reject the rest with a short note inline so the reasoning is captured
in the bundle. Specifically:

### ADD (high confidence -- multi-widget consumers + token-only recipes)

- `control.btn` / `control.btn.accent`
- `control.bar`
- `step.strip` / `step.btn` / `step.card` / `steps.grid`
- `summary.card` / `summary.grid`
- `swimlane.frame` / `swimlane.lane` / `swimlane.label` / `swimlane.dot`
- `pill.row` / `pill.mono`
- `info.panel` / `info.label` / `info.body`
- `stats.row` / `stat.cell` / `stat.label` / `stat.value`
- `annotated` / `annotation.panel` / `annotation.title` / `annotation.body`
- `config.grid`
- `footnote`
- `term.link`
- `timeline.step` / `timeline.num` (or rename: see Answer 5)

### DROP

- **`toggle.bar` / `toggle.btn`** -- your instinct is right, let it
  die. We had a single MCP §1 consumer; that's now `section-tab` (or
  `tab`, post Answer 4 below). No mono full-width segmented toggle
  pattern exists elsewhere on the site, and if one shows up later we
  can revive it.

### MERGE / RENAME

- **`section-tab.*`** -- see Answer 4. After your `tab.*` cleanup,
  this just becomes the canonical `tab.*` family. No new namespace.

- **`widget.section-eyebrow` / `widget.section-heading`** -- you didn't
  call this one out, but the naming question I raised inline is real.
  Our preference: keep `widget.section-*` rather than nesting under
  `viz.section-*`, because the heading isn't always inside a `viz.frame`
  (some widgets render the eyebrow + h2 directly on the page surface,
  the panel comes below). But we'd accept `viz.section-*` if you'd
  rather not introduce a new `widget.*` namespace.

## Answer 3: viz.graphic.* -- class-based, please

Our widgets all inline their SVG (built via `innerHTML` from a JS
template), so class-based consumption works. Concretely we'd write:

```html
<rect class="role-viz-graphic-node" x="..." y="..." />
<text class="role-viz-graphic-label" ...>...</text>
```

and let the SCSS recipe pin `fill`, `stroke`, `stroke-width`,
`font-family` etc. This means:

- The same SVG re-themes automatically under `[data-theme="dark"]`
  via the foundation tokens, instead of us emitting two SVG strings.
- We can codemod the existing `font-family="var(--font-mono)"`
  attributes into `class="..."` in one pass.

If your exemplars in the bundle currently inline these as SVG
attributes, please flip them to classes too -- that way the exemplar
agrees with the consumption pattern and the audit doesn't flag the
exemplar as a regression next sync.

## Answer 4: tab.* -- yes, formalize as display-font

Confirmed from our side. We just audited locally:

- `.role-tab` (mono): **0 live consumers**. Only a stale comment in
  `llm-mindmap.js`.
- `.role-section-tab` (display): **10+ live consumers** across the
  MCP, git-merge, llm-mindmap widgets.

The mono recipe is genuinely dead, and our `section-tab.*` proposal
exists only because we read the bundle's `tab.*` as the mono variant.
If you formalize `tab.*` as display-font (the recipe we currently
call `section-tab.*`: display, size-lg, weight 400 inactive / 500
active, coral bottom-border on active, mobile-collapses to vertical
with coral left-border), then:

1. Our `section-tab.*` proposal is withdrawn.
2. Locally we delete `.role-tab` / `.role-tab-active` (the mono
   definitions) and rename `.role-section-tab*` -> `.role-tab*`.
3. The orphan-mono problem disappears from both sides.

Please go ahead with this formalization. If a mono segmented bar
pattern resurfaces later, we'll add `tab.mono` as a variant rather
than reviving the orphaned recipe.

## Answer 5: deferred naming questions

A few small ones for your call:

- **`widget.section-*` vs `viz.section-*`** -- preferred `widget.*`
  per Answer 2. Your call.
- **`timeline.step` / `timeline.num` vs `flow.step` / `flow.num`** --
  honestly either works. `timeline.entry` is already taken for the
  about-page card pattern; we'd lean `flow.*` to keep the semantic
  clean, but `timeline.step` is fine if you'd rather not introduce a
  new top-level namespace.
- **§2c (viz.graphic.* attribute vs class)** -- answered above.

## Consolidated execution order

Mirroring your triage, in dependency order:

1. **Answer the open naming questions** in the bundle (widget vs viz
   section, timeline vs flow). Pure decisions, no code.
2. **§5 separator migration** -- flip every existing role key to all-
   dotted atomic segments. ~25 keys per the audit's migration table.
3. **§4 tab.\* formalization** -- replace the current mono recipe with
   the display-font recipe. Delete the mono variant. (This is small
   and benefits from being on the corrected convention from step 2.)
4. **§3 additive roles** -- add the new roles listed under "ADD"
   above, using the all-dotted convention from step 2.
5. **§2a / §2c** -- confirm `panel.title` is still the correct
   architecture-heading role, and that `viz.graphic.*` is intended
   class-based.

Once steps 1-5 land in a new bundle URL, post it back here and we'll
sync immediately. Expect us to land the downstream changes within a
day.

## What we'll do on our side meanwhile

Nothing destructive. The local `// PROPOSED ROLES` block stays as-is
until the bundle revision lands; that's the entire point of marking
them with FIXME. If you decide partway through to drop a proposal,
we'll just remove the corresponding local stub in the sync pass.

---

**Generated:** 2026-05-24, in response to the upstream triage on
audit bundle `7ySOqBLCb-cM6lDCAhG4wA`.
