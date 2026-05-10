// Exploring Git Merge -- a six-chapter interactive primer.
//
// Vanilla JS. Builds the post body so each section reuses the same
// recipe as the MCP exploration widget, including the role-toc-* TOC
// frame and the .mcp-tabs / .mcp-arch-desc panel pattern.
//
// All visual styling comes from foundation tokens declared in
// _sass/_theme.scss (--paper-*, --ink-*, --line, --coral*, --font-*).
// The diagrams use --ink-secondary for the "established" line (main)
// and --coral for the "subject" line (feature, merge, cherry, rebase),
// matching the same two-colour convention used elsewhere on the site.
//
// Six sections:
//   01: The common base (merge base, three-way merge)
//   02: Merge vs. cherry-pick (tabbed)
//   03: How conflicts arise (file boxes + conflict markers)
//   04: Inside a merge commit + scenarios that touch one (tabbed)
//   05: "Merge X into Y" -- which side moves
//   06: Rebase (tabbed: before vs. after)
//
// Usage:  <div id="git-merge-demo"></div>
//         <script>createGitMergeExploration('git-merge-demo');</script>

(function () {

  // ------------------------------------------------------------------
  // Styles, injected once. Most classes are widget-local; the .mcp-*
  // names piggy-back on the recipes already defined by mcp-exploration.js
  // so the two posts read in the same rhythm. They are also redefined
  // here so the widget is self-contained on pages that do not load the
  // MCP script.
  // ------------------------------------------------------------------
  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      '.gm { font-family: var(--font-text); color: var(--ink-primary); padding: 8px 0 40px; }',

      /* Section header (mirrors mcp-eyebrow recipe). */
      '.gm-section { margin-bottom: 64px; }',
      '.gm-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }',
      '.gm-eyebrow .role-post-section-rule { flex: 1; }',
      '.gm-section-title { font-family: var(--font-display); font-size: var(--size-h2); color: var(--ink-primary); font-weight: 400; letter-spacing: var(--track-snug); line-height: var(--lh-snug); margin: 0 0 14px; }',
      '.gm-body { color: var(--ink-secondary); font-family: var(--font-display); font-size: 18px; font-weight: 400; line-height: var(--lh-loose); margin-bottom: 22px; }',
      '.gm-panel + .gm-body, .gm-panel + .gm-table-wrap { margin-top: 36px; }',
      '.gm-table-wrap + .gm-body, .gm-table-wrap + .gm-table-wrap { margin-top: 20px; }',
      '.gm-body em { color: var(--ink-primary); font-style: italic; }',
      '.gm-body strong { color: var(--ink-primary); font-weight: 500; }',

      /* Panel + frame (figure surface). */
      '.gm-panel { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }',
      '.gm-frame { background: var(--paper-inset); border: 1px solid var(--line); border-radius: 6px; padding: 24px 18px; display: flex; justify-content: center; align-items: center; margin: 4px 0 16px; }',
      '.gm-frame svg, .gm-svg-bg svg { width: 100%; height: auto; max-width: 640px; display: block; }',

      /* Tabs (reuses .mcp-tabs / .mcp-tab classes). Self-contained
         redeclaration so the widget works without mcp-exploration.js. */
      '.mcp-tabs { display: flex; border-bottom: 1px solid var(--line); overflow-x: auto; }',
      '.mcp-tab { padding: 14px 18px; background: transparent; border: none; border-right: 1px solid var(--line); cursor: pointer; font-family: var(--font-display); font-size: var(--size-lg); color: var(--ink-muted); border-bottom: 2px solid transparent; transition: color .15s, background .15s; white-space: nowrap; flex: 1; min-width: 90px; letter-spacing: var(--track-snug); }',
      '.mcp-tab:last-child { border-right: none; }',
      '.mcp-tab.active { color: var(--ink-primary); background: var(--paper-inset); border-bottom-color: var(--coral); }',
      '@media (max-width: 640px) {' +
        '.mcp-tabs { flex-direction: column; border-bottom: none; overflow-x: visible; }' +
        '.mcp-tab { border-right: none; border-bottom: 1px solid var(--line); border-left: 3px solid transparent; text-align: left; padding: 14px 18px 14px 17px; }' +
        '.mcp-tab:last-child { border-bottom: none; }' +
        '.mcp-tab.active { border-bottom-color: var(--line) !important; border-left-color: var(--coral) !important; }' +
      '}',

      /* SVG background inside a panel (paper-inset, mirrors §02 of MCP). */
      '.gm-svg-bg { padding: 22px 18px 14px; background: var(--paper-inset); display: flex; justify-content: center; }',

      /* Description area below tabs (paper-raised, top hairline,
         mirrors .mcp-arch-desc). */
      '.gm-arch-desc { border-top: 1px solid var(--line); padding: 20px; background: var(--paper-raised); }',
      '.gm-arch-desc h3 { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--ink-primary); margin: 0 0 10px; letter-spacing: var(--track-snug); }',
      '.gm-arch-desc p { font-family: var(--font-text); font-size: 15px; color: var(--ink-muted); line-height: var(--lh-body); margin: 0 0 10px; }',
      '.gm-arch-desc p:last-child { margin-bottom: 0; }',
      '.gm-arch-desc strong { color: var(--ink-primary); font-weight: 500; }',
      '.gm-arch-desc em { color: var(--ink-primary); font-style: italic; }',
      '.gm-arch-desc pre.role-code-block { margin: 8px 0 12px; font-size: 12.5px; }',

      /* Tables. Recipe mirrors .ce-instr-table from claude-environment.js
         so both posts read with the same surface: paper-table-body
         background, paper-table-head thead, rounded outer frame, inner
         hairline grid via per-cell top/right borders. The first block
         below neutralises minima's element-level defaults (zebra
         striping, header backgrounds) which bleed through in dark mode. */
      '.gm-table-wrap { margin: 16px 0; }',
      '.gm-table-wrap .role-table-frame { width: 100%; border: none; padding: 0; background: transparent; }',
      /* table-layout: fixed lets each <pre>\'s overflow-x: auto take effect
         per-cell instead of the longest line forcing the whole table to
         exceed the post width (which previously clipped "Theirs"). */
      '.gm-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 0; background: var(--table-body); border: 1px solid var(--table-line); border-radius: 14px; overflow: hidden; color: inherit; table-layout: fixed; font-family: var(--font-text); font-size: var(--size-smd); }',
      '.gm-table thead { background: var(--table-head); }',
      '.gm-table th { font-family: var(--font-text); font-size: var(--size-smd); font-weight: 600; letter-spacing: var(--track-snug); color: var(--ink-primary); padding: 14px 20px; text-align: left; vertical-align: top; border: none; border-right: 1px solid var(--table-line); border-bottom: 1px solid var(--table-line); background: transparent; }',
      '.gm-table th:last-child { border-right: none; }',
      '.gm-table tbody tr { background: transparent; }',
      '.gm-table td { padding: 16px 20px; color: var(--ink-secondary); border: none; border-top: 1px solid var(--table-line); border-right: 1px solid var(--table-line); vertical-align: top; line-height: var(--lh-normal); font-size: var(--size-md); background: transparent; min-width: 0; }',
      '.gm-table td:last-child { border-right: none; }',
      '.gm-table tr:first-child td { border-top: none; }',
      /* Cells that house a <pre> code block (sec 3 file-version table)
         drop their padding so the code block fills the cell flush.
         Cell carries the paper code-surface (matching the MCP
         Primitives recipe), and the pre is transparent + height 100%
         so the cell\'s background fills the row uniformly even when a
         column has fewer lines than the others. */
      '.gm-table td.gm-cell-pre { padding: 0; background: var(--paper); }',
      '.gm-table td.gm-cell-pre pre.role-code-block { background: transparent; border: none; border-radius: 0; height: 100%; box-sizing: border-box; }',
      '.gm-table tr:nth-child(even) { background: transparent; }',
      '.gm-table code { font-family: var(--font-mono); font-size: 0.86em; background: var(--paper-inset); border: 1px solid var(--line); color: var(--ink-primary); padding: 1px 6px; border-radius: 3px; }',
      '.gm-table strong { color: var(--ink-primary); font-weight: 500; }',
      /* Subtitle inside a header cell (e.g. "(c3)" beside "Merge Base"). */
      '.gm-table .gm-vershead-sub { color: var(--ink-faint); font-family: var(--font-mono); font-size: 11px; font-weight: 400; margin-left: 4px; }',
      /* Code block inside a cell. Uses .role-code-block from the design
         language for the surface; we just zero the margin and add padding
         so it sits flush inside the table cell. Each line is rendered as
         a .line block-span so newlines come from the layout, not from raw
         "\n" characters that would compound with display:block.
         white-space: pre-wrap lets a long line wrap onto a second visual
         row when the cell is narrow, so we never need a horizontal
         scrollbar (which previously appeared even when not strictly
         needed due to subpixel rounding). */
      '.gm .gm-table pre.role-code-block { margin: 0; padding: 12px 14px; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; line-height: 1.55; }',
      '.gm .gm-table pre.role-code-block .line { display: block; }',
      /* Conflict-line highlights inside the file-version table follow
         the same red/green semantic as the conflict block: the Ours
         column gets the del wash + rule, the Theirs column gets the
         add wash + rule. The padding compensates 14px to leave room
         for the 3px stem (-14 + 3 = -11 visual padding-left). */
      '.gm .gm-table td[data-gm-col="ours"]   pre.role-code-block .line.hl { background: var(--hl-del-bg); box-shadow: inset 3px 0 0 var(--hl-del-rule); margin: 0 -14px; padding: 0 14px 0 17px; color: var(--ink-primary); }',
      '.gm .gm-table td[data-gm-col="theirs"] pre.role-code-block .line.hl { background: var(--hl-add-bg); box-shadow: inset 3px 0 0 var(--hl-add-rule); margin: 0 -14px; padding: 0 14px 0 17px; color: var(--ink-primary); }',
      /* Fallback for any other .line.hl occurrence (e.g. base column
         if a future change introduces one). */
      '.gm .gm-table pre.role-code-block .line.hl { background: var(--hl-info-bg); box-shadow: inset 3px 0 0 var(--hl-info-rule); margin: 0 -14px; padding: 0 14px 0 17px; color: var(--ink-primary); }',

      /* Note callout */
      '.gm-note { background: var(--paper-raised); border: 1px solid var(--line); border-left: 3px solid var(--coral); border-radius: 4px; padding: 12px 16px; color: var(--ink-secondary); font-family: var(--font-text); font-size: var(--size-md); line-height: var(--lh-body); margin: 12px 0; }',
      '.gm-note + .gm-note { margin-top: 8px; }',

      /* Inline mono chip. */
      '.gm code, .gm-mono { font-family: var(--font-mono); font-size: 0.86em; background: var(--paper-inset); border: 1px solid var(--line); color: var(--ink-primary); padding: 1px 6px; border-radius: 3px; }',

      /* Block code listing. Type / colour come straight from the
         design-language .role-code-block recipe; we only set the
         margin / padding / line-height here. Per Design Language v3,
         the surface treatment depends on context:

           - Code that sits directly on the page background keeps the
             default .role-code-block (paper-inset bg + hairline).
           - Code that lives inside a panel (.gm-panel) gets the boxed
             variant: paper bg + no border, reading as an "inset hole"
             in the surrounding panel.body. This is implemented as a
             contextual override matching .role-code-block-inset. */
      '.gm pre.role-code-block { margin: 0 0 16px; padding: 14px 16px; line-height: 1.7; overflow: auto; }',
      '.gm-panel pre.role-code-block, .gm-table pre.role-code-block { background: var(--paper); border: none; }',
      '.gm pre.role-code-block .prompt { color: var(--coral); user-select: none; font-weight: 600; }',
      '.gm pre.role-code-block .cmd { color: var(--ink-primary); }',
      '.gm pre.role-code-block .cmt { color: var(--sx-comment); font-style: italic; }',

      /* Conflict marker block (§03 + §06). Body uses .role-code-block
         with block-display .line spans (no raw "\n", so highlighted
         lines do not introduce an extra newline). The .line / .gm-cm /
         .gm-cmt / .gm-ours / .gm-theirs helpers live at the widget root
         so they work inside any role-code-block: §03\'s table cells, §03\'s
         conflict block, §04\'s commit panel, §06\'s rebase-conflict panel. */
      '.gm-conflict-wrap { margin: 0 0 14px; }',
      '.gm-conflict-block { margin: 0; padding: 14px 16px; overflow-x: auto; }',
      '.gm pre.role-code-block .line { display: block; }',
      '.gm pre.role-code-block .gm-cm { color: var(--coral); font-weight: 600; }',
      '.gm pre.role-code-block .gm-cmt { color: var(--sx-comment); font-style: italic; }',
      /* Conflict halves use the v3 line-highlight roles: ours sits on
         the del wash (red, the "kept-or-lost" side), theirs on the
         add wash (green, the incoming change). Each carries the role\'s
         3px leading rule via inset box-shadow. The negative horizontal
         margin / padding lets the wash bleed to the block edges. */
      '.gm pre.role-code-block .gm-ours { background: var(--hl-del-bg); box-shadow: inset 3px 0 0 var(--hl-del-rule); margin: 0 -16px; padding: 0 16px 0 19px; color: var(--ink-primary); }',
      '.gm pre.role-code-block .gm-theirs { background: var(--hl-add-bg); box-shadow: inset 3px 0 0 var(--hl-add-rule); margin: 0 -16px; padding: 0 16px 0 19px; color: var(--ink-primary); }',
      '.gm-conflict-foot { color: var(--ink-muted); font-family: var(--font-text); font-size: var(--size-md); line-height: var(--lh-body); margin: 10px 0 0; }',
      /* Syntax helpers reusing the design language\'s sx-* tokens. */
      '.gm-kw { color: var(--sx-keyword); font-weight: 500; }',
      '.gm-str { color: var(--sx-string); }',

      /* Merge-commit variants (§04). Tabbed code block with a fixed
         min-height so the panel doesn\'t jump as the user switches
         tabs. The wrapper carries the paper code-surface itself
         (matching .mcp-code from the MCP Primitives recipe), so the
         tabs sit on the paper-raised panel above and the commit log
         reads as a darker "inset" beneath. The inner pre is
         transparent so the wrapper\'s background fills uniformly. */
      '.gm-commit-area { background: var(--paper); padding: 14px 16px; min-height: 270px; box-sizing: border-box; }',
      '.gm-commit-area pre { margin: 0; overflow-x: auto; background: transparent; border: none; border-radius: 0; padding: 0; }',
      '.gm-commit-area .line { display: block; }',
      '.gm-commit-area .gm-cmt { color: var(--sx-comment); font-style: italic; }',
      '.gm-commit-area .gm-key { color: var(--ink-faint); }',
      '.gm-commit-area .gm-add { color: var(--hl-add-rule); }',
      '.gm-commit-area .gm-msg { color: var(--ink-primary); }',

      /* Key points list (§05). Plain <ul> with default markers, sized
         so it sits in the post\'s body type rhythm. */
      '.gm-keys { color: var(--ink-secondary); font-family: var(--font-text); font-size: var(--size-md); line-height: var(--lh-body); margin: 14px 0 14px 22px; padding: 0; }',
      '.gm-keys li + li { margin-top: 6px; }',
      '.gm-keys code { font-family: var(--font-mono); font-size: 0.86em; background: var(--paper-inset); border: 1px solid var(--line); color: var(--ink-primary); padding: 1px 6px; border-radius: 3px; }',
      '.gm-keys em { color: var(--ink-primary); font-style: italic; }',

      /* TOC hover (mirrors mcp-exploration.js). */
      '.gm-toc-row { transition: background 0.15s, color 0.15s; }',
      '.gm-toc-row:hover { background: var(--paper-inset); }',
      '.gm-toc-row:hover .role-toc-title,',
      '.gm-toc-row:hover .role-toc-row { color: var(--ink-primary); }',

      /* Internal link: prose anchor that triggers a widget-local effect
         (highlight, pulse). Solid underline in the surrounding text
         colour so it follows the site\'s link convention rather than
         competing with it. */
      '.gm-ilink { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; cursor: pointer; }',
      '.gm-ilink:hover { color: var(--coral); }',

      /* Radial pulse (§01 merge-base highlight). The ping circle scales
         outward from the commit centre and fades. Using transform:scale()
         with transform-box:fill-box keeps the geometric centre fixed
         across all browsers (animating SVG r in keyframes is not
         supported on iOS Safari). */
      '@keyframes gm-radial-ping { 0% { transform: scale(1); opacity: 0.85; } 100% { transform: scale(3.5); opacity: 0; } }',
      '.gm-radial-pulse { animation: gm-radial-ping 1.2s ease-out 2; opacity: 0; transform-box: fill-box; transform-origin: center; }',

      /* Pulse animation (§04 parent-pointer highlight). */
      '@keyframes gm-pulse { 0% { stroke-width: 1.5; } 25% { stroke: var(--coral-strong); stroke-width: 3.5; } 50% { stroke-width: 1.5; } 75% { stroke: var(--coral-strong); stroke-width: 3.5; } 100% { stroke-width: 1.5; } }',
      '.gm-pulse { animation: gm-pulse 1.6s ease-in-out 2; }',

      /* Parent-SHA inline highlight: a coral wash with a brief flash
         used by the §04 "parent pointers" / "Parents" internal links. */
      '.gm-parent-sha { color: var(--ink-faint); padding: 1px 3px; border-radius: 3px; transition: background 0.2s, color 0.2s; }',
      '@keyframes gm-sha-pulse { 0% { background: transparent; color: var(--ink-faint); } 20% { background: var(--coral); color: var(--paper-raised); } 50% { background: transparent; color: var(--ink-faint); } 70% { background: var(--coral); color: var(--paper-raised); } 100% { background: transparent; color: var(--ink-faint); } }',
      '.gm-parent-sha.gm-sha-pulse { animation: gm-sha-pulse 1.6s ease-in-out forwards; }',

      /* Line highlight (§02 "line 1 vs line 3" reveal). Consumes the
         v3 info wash + rule (the same colours used wherever blue is
         needed across the design language) and pulses on once via the
         hold-step in the keyframes. The 17px left padding clears the
         3px stem applied through box-shadow during the lit phases. */
      '@keyframes gm-line-flash { 0% { background: transparent; box-shadow: none; } 15%, 70% { background: var(--hl-info-bg); box-shadow: inset 3px 0 0 var(--hl-info-rule); } 100% { background: transparent; box-shadow: none; } }',
      '.gm pre.role-code-block .line.gm-line-flash { animation: gm-line-flash 1.8s ease-in-out forwards; margin: 0 -14px; padding: 0 14px 0 17px; }'
    ].join('\n');
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function div(cls, html) { return el('div', cls, html); }

  function sectionHeader(num, title) {
    var wrap = div('');
    var id = 'sec-' + String(num).padStart(2, '0');
    wrap.innerHTML =
      '<div class="gm-eyebrow" id="' + id + '">' +
        '<span class="role-post-section-index">' + String(num).padStart(2, '0') + '</span>' +
        '<div class="role-post-section-rule"></div>' +
      '</div>' +
      '<h2 class="gm-section-title">' + title + '</h2>';
    return wrap;
  }

  // ------------------------------------------------------------------
  // SVG primitives. Lines and dots all resolve to either
  // var(--ink-secondary) (the "default" line, e.g. main) or
  // var(--coral) (the "subject" line, e.g. feature/merge/rebase),
  // both of which are foundation tokens.
  // ------------------------------------------------------------------
  function svgEdge(x1, y1, x2, y2, color, opts) {
    opts = opts || {};
    var r = 16;                      // commit circle radius (matches svgCommit)
    var sameRow = Math.abs(y1 - y2) < 2;
    var dir = (x2 >= x1) ? 1 : -1;
    var sx = x1 + r * dir;           // attach on the circle equator,
    var ex = x2 - r * dir;           // same point a horizontal stroke uses
    var d;
    if (sameRow) {
      d = 'M ' + sx + ' ' + y1 + ' L ' + ex + ' ' + y2;
    } else {
      // Both endpoints sit on the equator; the bezier uses horizontal
      // tangents at start and end so the curve leaves and arrives at
      // the circle exactly like a horizontal line would, just bending
      // through the middle to span the row gap. ctrlOffset scales with
      // the horizontal travel so longer spans stay smooth.
      var ctrlOffset = Math.max(20, Math.abs(ex - sx) * 0.45);
      d = 'M ' + sx + ' ' + y1 +
          ' C ' + (sx + ctrlOffset * dir) + ' ' + y1 +
          ', ' + (ex - ctrlOffset * dir) + ' ' + y2 +
          ', ' + ex + ' ' + y2;
    }
    var dash = opts.dashed ? ' stroke-dasharray="4 4"' : '';
    var op   = opts.opacity != null ? ' stroke-opacity="' + opts.opacity + '"' : '';
    return '<path d="' + d + '" stroke="' + color + '" stroke-width="' + (opts.width || 1.5) + '" fill="none"' + dash + op + '/>';
  }

  function svgCommit(x, y, color, label, opts) {
    opts = opts || {};
    // No dashed/dotted rings around commits. Merge commits read as
    // "merges" via two incoming edges (each painted in its source
    // branch's colour) plus a contrast fill: outline and label stay
    // HEAD is rendered by svgBranchLabel as part of the pointer chain.
    var fill = 'var(--paper-inset)';
    var inner = '<circle cx="' + x + '" cy="' + y + '" r="16" fill="' + fill + '" stroke="' + color + '" stroke-width="1.5"/>';
    var labelEl = label
      ? '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="14" font-weight="600" fill="' + color + '">' + label + '</text>'
      : '';
    var op = opts.dim ? ' opacity="0.35"' : '';
    var idAttr = opts.id ? ' data-commit-id="' + opts.id + '"' : '';
    return '<g' + op + idAttr + '>' + inner + labelEl + '</g>';
  }

  // Branch pointer: branches are pointers to commits, so we render
  // them as a rectangle stacked vertically above or below the commit
  // with a small grey line + arrowhead pointing from the rectangle
  // toward the commit. If opts.head is true, HEAD is rendered further
  // out in the same direction with the same line+arrow idiom (HEAD ->
  // branch -> commit, mirroring Git's actual reference chain).
  //
  // Arguments are the COMMIT centre coordinates (cx, cy); the helper
  // computes rectangle and arrow positions from there.
  function svgBranchLabel(cx, cy, label, color, opts) {
    opts = opts || {};
    var sign = (opts.direction === 'above') ? -1 : 1;   // 'below' default
    // Pointer arrow uses the branch/commit's own colour (not a neutral
    // grey) so the lineage is legible at a glance. Both branch->commit
    // and HEAD->branch arrows render in this colour.
    var arrowColor = color;
    // Branch and HEAD rectangles share the same width so the pointer
    // chain reads as a uniform stack. Spacing values give the chain
    // more breathing room around the commit and between rectangles.
    var commitR = 16, rectGap = 24, rectW = 64, rectH = 20;
    var headGap = 22, headW = 64, headH = 20;
    // tipGap leaves a small visual gap between the arrowhead and the
    // element it points at, so the arrow doesn\'t collide with the
    // destination border.
    var arrowSize = 6, lineStroke = 2.2, tipGap = 4;

    function arrow(fromY, toY) {
      // motion = +1 if arrow points DOWN (toY > fromY), -1 for UP.
      // The tip stops `tipGap` short of the destination edge to avoid
      // colliding with the rectangle / circle border. Polygon body
      // sits behind the tip and the line ends at the polygon base.
      var motion = (toY > fromY) ? 1 : -1;
      var tipY = toY - motion * tipGap;
      var baseY = tipY - motion * arrowSize;
      return '<line x1="' + cx + '" y1="' + fromY + '" x2="' + cx + '" y2="' + baseY + '" stroke="' + arrowColor + '" stroke-width="' + lineStroke + '"/>' +
        '<polygon points="' + cx + ',' + tipY +
          ' ' + (cx - arrowSize) + ',' + baseY +
          ' ' + (cx + arrowSize) + ',' + baseY + '" fill="' + arrowColor + '"/>';
    }

    // ── Branch rectangle stacked above or below the commit ──
    var branchTop = (sign > 0)
      ? cy + commitR + rectGap
      : cy - commitR - rectGap - rectH;
    var branchBottom = branchTop + rectH;
    var branchMidY = branchTop + rectH / 2;
    var branchClose = (sign > 0) ? branchTop : branchBottom;
    var commitClose = (sign > 0) ? cy + commitR : cy - commitR;
    var branchArrow = arrow(branchClose, commitClose);
    var branchRect =
      '<rect x="' + (cx - rectW / 2) + '" y="' + branchTop + '" width="' + rectW + '" height="' + rectH + '" rx="3" fill="var(--paper-raised)" stroke="' + color + '" stroke-width="1.5"/>' +
      '<text x="' + cx + '" y="' + (branchMidY + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="600" fill="' + color + '">' + label + '</text>';

    if (!opts.head) {
      return branchArrow + branchRect;
    }

    // ── HEAD rectangle, further out in the same direction ──
    var headTop = (sign > 0)
      ? branchBottom + headGap
      : branchTop - headGap - headH;
    var headBottom = headTop + headH;
    var headMidY = headTop + headH / 2;
    var headClose = (sign > 0) ? headTop : headBottom;
    var branchFar  = (sign > 0) ? branchBottom : branchTop;
    var headArrow = arrow(headClose, branchFar);
    var headRect =
      '<rect x="' + (cx - headW / 2) + '" y="' + headTop + '" width="' + headW + '" height="' + headH + '" rx="3" fill="' + color + '"/>' +
      '<text x="' + cx + '" y="' + (headMidY + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="700" fill="var(--paper-raised)" letter-spacing="0.5">HEAD</text>';

    return branchArrow + branchRect + headArrow + headRect;
  }

  function svgCaption(x, y, color, text, anchor) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" font-family="var(--font-mono)" font-size="10" fill="' + color + '">' + text + '</text>';
  }

  // Token shorthand
  var INK = 'var(--ink-secondary)';   // default branch (e.g. main)
  var ACC = 'var(--coral)';           // subject branch (e.g. feature)
  var MUTED = 'var(--ink-faint)';

  // ------------------------------------------------------------------
  // Table of contents
  // ------------------------------------------------------------------
  function buildTOC(root) {
    var ENTRIES = [
      { num: 1, title: 'Common Base' },
      { num: 2, title: 'How Conflicts Arise' },
      { num: 3, title: 'Merge Conventions' },
      { num: 4, title: 'Inside a Merge Commit' },
      { num: 5, title: 'Cherry-Pick' },
      { num: 6, title: 'Rebase: Replaying Instead of Recording' }
    ];

    var sec = div('gm-section');
    sec.style.paddingTop = '8px';

    var frame = div('role-toc-frame');
    frame.style.cssText = 'padding: 18px 22px;';

    var label = div('role-toc-label');
    label.textContent = 'Contents';
    label.style.marginBottom = '12px';
    frame.appendChild(label);

    var list = div('');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    ENTRIES.forEach(function (e) {
      var nn = String(e.num).padStart(2, '0');
      var row = document.createElement('a');
      row.className = 'role-toc-row gm-toc-row';
      row.href = '#sec-' + nn;
      row.style.cssText = 'display: flex; align-items: baseline; gap: 12px; text-decoration: none; padding: 6px 8px; border-radius: 6px; transition: background 0.15s, color 0.15s;';
      row.innerHTML =
        '<span class="role-toc-index">' + nn + '</span>' +
        '<span class="role-toc-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + e.title + '</span>' +
        '<span class="role-toc-leader" style="flex: 1; border-bottom: 1px dotted currentColor; transform: translateY(-3px); min-width: 24px;"></span>';
      list.appendChild(row);
    });

    frame.appendChild(list);
    sec.appendChild(frame);
    root.appendChild(sec);

    list.querySelectorAll('.gm-toc-row').forEach(function (row) {
      row.addEventListener('click', function () {
        row.classList.remove('role-toc-row');
        row.classList.add('role-toc-row-flash');
        setTimeout(function () {
          row.classList.remove('role-toc-row-flash');
          row.classList.add('role-toc-row');
        }, 600);
      });
    });
  }

  // ------------------------------------------------------------------
  // §01 -- The common base
  // ------------------------------------------------------------------
  function buildSection01(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(1, 'Common Base'));

    sec.appendChild(el('p', 'gm-body',
      'When a branch forks off, both lineages share history up to one ' +
      'commit (the <span class="gm-ilink" data-gm-action="show-merge-base">merge base</span>). ' +
      'Git uses this third point to perform a <strong>three-way merge</strong>, ' +
      'comparing each branch tip against the base to determine what changed on ' +
      'both sides. The contrasting tab below shows what a <strong>two-way ' +
      'merge</strong> sees without that third reference.'));

    // Tabbed comparison: three-way (with a shared base) vs. two-way
    // (no shared base, so every difference becomes a conflict).
    var OPTIONS = [
      { id: 'three', label: 'Three-way merge' },
      { id: 'two',   label: 'Two-way merge'   }
    ];
    var active = 'three';

    var panel = div('gm-panel');
    var tabsBar = div('mcp-tabs');
    panel.appendChild(tabsBar);
    var svgBg = div('gm-svg-bg');
    panel.appendChild(svgBg);
    var descArea = div('gm-arch-desc');
    panel.appendChild(descArea);

    function renderThreeWay() {
      var mainY = 120, featY = 200;
      var xs = [60, 130, 200, 270, 340, 410];
      svgBg.innerHTML =
        '<svg viewBox="0 0 480 270">' +
          svgEdge(xs[0], mainY, xs[1], mainY, INK) +
          svgEdge(xs[1], mainY, xs[2], mainY, INK) +
          svgEdge(xs[2], mainY, xs[3], mainY, INK) +
          svgEdge(xs[3], mainY, xs[4], mainY, INK) +
          svgEdge(xs[2], mainY, xs[3], featY, ACC) +
          svgEdge(xs[3], featY, xs[4], featY, ACC) +
          svgCaption(xs[2], mainY - 26, ACC, 'Merge Base') +
          '<circle id="gm-merge-base-ping" cx="' + xs[2] + '" cy="' + mainY + '" r="16" fill="none" stroke="' + ACC + '"/>' +
          svgCommit(xs[0], mainY, INK, 'a1') +
          svgCommit(xs[1], mainY, INK, 'b2') +
          svgCommit(xs[2], mainY, INK, 'c3') +
          svgCommit(xs[3], mainY, INK, 'd4') +
          svgCommit(xs[4], mainY, INK, 'e5') +
          svgCommit(xs[3], featY, ACC, 'f6') +
          svgCommit(xs[4], featY, ACC, 'g7') +
          // Branches stack vertically away from the row, with a grey
          // arrow line pointing back to the commit. HEAD chains
          // further out and points to its branch.
          svgBranchLabel(xs[4], mainY, 'main', INK, { head: true, direction: 'above' }) +
          svgBranchLabel(xs[4], featY, 'feature', ACC, { direction: 'below' }) +
        '</svg>';
    }

    function renderTwoWay() {
      var twoY1 = 120, twoY2 = 200;
      var twoXs = [60, 160, 260, 360];
      svgBg.innerHTML =
        '<svg viewBox="0 0 480 270">' +
          // Two parallel rows with no shared origin.
          svgEdge(twoXs[0], twoY1, twoXs[1], twoY1, INK) +
          svgEdge(twoXs[1], twoY1, twoXs[2], twoY1, INK) +
          svgEdge(twoXs[2], twoY1, twoXs[3], twoY1, INK) +
          svgEdge(twoXs[0], twoY2, twoXs[1], twoY2, ACC) +
          svgEdge(twoXs[1], twoY2, twoXs[2], twoY2, ACC) +
          svgEdge(twoXs[2], twoY2, twoXs[3], twoY2, ACC) +
          svgCommit(twoXs[0], twoY1, INK, 'a1') +
          svgCommit(twoXs[1], twoY1, INK, 'b2') +
          svgCommit(twoXs[2], twoY1, INK, 'c3') +
          svgCommit(twoXs[3], twoY1, INK, 'd4') +
          svgCommit(twoXs[0], twoY2, ACC, 'p1') +
          svgCommit(twoXs[1], twoY2, ACC, 'p2') +
          svgCommit(twoXs[2], twoY2, ACC, 'p3') +
          svgCommit(twoXs[3], twoY2, ACC, 'p4') +
          svgBranchLabel(twoXs[3], twoY1, 'ours',   INK, { head: true, direction: 'above' }) +
          svgBranchLabel(twoXs[3], twoY2, 'theirs', ACC, { direction: 'below' }) +
          svgCaption(twoXs[1] + 50, (twoY1 + twoY2) / 2 + 4, MUTED, 'no shared ancestor') +
        '</svg>';
    }

    function renderTabs() {
      tabsBar.innerHTML = '';
      OPTIONS.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (o.id === active ? ' active' : '');
        b.type = 'button';
        b.textContent = o.label;
        b.onclick = function () { active = o.id; render(); };
        tabsBar.appendChild(b);
      });
    }

    function renderDesc() {
      if (active === 'three') {
        descArea.innerHTML =
          '<h3>Three-way diff against the base</h3>' +
          '<p>Here, <code>c3</code> is the merge base of <code>main</code> ' +
          '(tip <code>e5</code>) and <code>feature</code> (tip <code>g7</code>). ' +
          'Git computes <code>git diff c3..e5</code> and ' +
          '<code>git diff c3..g7</code> to determine each side\'s contribution.</p>';
      } else {
        descArea.innerHTML =
          '<h3>No shared ancestor</h3>' +
          '<p><code>a1</code> and <code>p1</code> are initial commits ' +
          'from completely separate histories, as if the branches originated ' +
          'in different repositories joined with <code>git remote add</code>, ' +
          'or were created as orphan branches via ' +
          '<code>git checkout --orphan</code>. With no common ancestor, Git ' +
          'has no baseline to determine either side\'s changes and every ' +
          'differing line must be flagged as a conflict. The ' +
          '<a href="#sec-02" class="gm-ilink">next section</a> provides a ' +
          'concrete example.</p>';
      }
    }

    function render() {
      renderTabs();
      if (active === 'three') renderThreeWay();
      else renderTwoWay();
      renderDesc();
    }
    render();
    sec.appendChild(panel);

    // Wire the in-prose link: clicking "merge base" switches to the
    // three-way tab (since that's where the concept is illustrated)
    // and emits a radial ping from c3's centre.
    sec.querySelectorAll('[data-gm-action="show-merge-base"]').forEach(function (link) {
      link.addEventListener('click', function () {
        if (active !== 'three') {
          active = 'three';
          render();
        }
        requestAnimationFrame(function () {
          var ping = svgBg.querySelector('#gm-merge-base-ping');
          if (!ping) return;
          ping.classList.remove('gm-radial-pulse');
          void ping.getBoundingClientRect();
          ping.classList.add('gm-radial-pulse');
        });
      });
    });

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §02 -- Merge vs. cherry-pick (tabbed: visual + description)
  // ------------------------------------------------------------------
  function buildSection02(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(5, 'Cherry-Pick'));

    sec.appendChild(el('p', 'gm-body',
      'Both merge and cherry-pick bring data from one branch to another, but ' +
      'the <strong>shape of history</strong> they leave behind is ' +
      'fundamentally different.'));

    var OPTIONS = [
      { id: 'merge', label: 'git merge feature',
        title: 'Merge: parallel work, joined',
        body:
          '<p>A merge commit (<code>M</code>) is recorded with <strong>two parents</strong>: ' +
          'the previous tip of <code>main</code> and the tip of <code>feature</code>. ' +
          'Both branches\' commits stay in history exactly as they were, and the ' +
          'relationship between the parallel streams is preserved.</p>' },
      { id: 'cherry', label: 'git cherry-pick g7',
        title: 'Cherry-pick: one commit, replayed',
        body:
          '<p>The <strong>diff</strong> of <code>g7</code> is replayed on top of ' +
          '<code>main</code> as a brand-new commit (<code>g7\'</code>) with a ' +
          '<strong>new hash</strong>. There is no tie back to <code>feature</code>.</p>' +
          '<p>This could be useful when only one commit\'s worth of change is ' +
          'wanted, e.g. porting a fix to a maintenance branch. Note that a ' +
          'subsequent merge of <code>feature</code> may surface the change a ' +
          'second time.</p>' }
    ];

    var active = 'merge';
    var panel = div('gm-panel');
    var tabsBar = div('mcp-tabs');
    panel.appendChild(tabsBar);
    var svgBg = div('gm-svg-bg');
    panel.appendChild(svgBg);
    var descArea = div('gm-arch-desc');
    panel.appendChild(descArea);

    var mainY = 120, featY = 200;
    var xs = [50, 120, 190, 260, 330, 400, 470];

    function renderSVG() {
      var trunk =
        svgEdge(xs[0], mainY, xs[1], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], mainY, INK) +
        svgEdge(xs[3], mainY, xs[4], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], featY, ACC) +
        svgEdge(xs[3], featY, xs[4], featY, ACC) +
        svgCommit(xs[0], mainY, INK, 'a1') +
        svgCommit(xs[1], mainY, INK, 'b2') +
        svgCommit(xs[2], mainY, INK, 'c3') +
        svgCommit(xs[3], mainY, INK, 'd4') +
        svgCommit(xs[4], mainY, INK, 'e5') +
        svgCommit(xs[3], featY, ACC, 'f6') +
        svgCommit(xs[4], featY, ACC, 'g7', { dim: active === 'cherry' });

      var rest;
      if (active === 'merge') {
        rest =
          // Main-side incoming to the merge commit keeps its INK colour;
          // only the feature-side curve stays coral.
          svgEdge(xs[4], mainY, xs[5], mainY, INK) +
          svgEdge(xs[4], featY, xs[5], mainY, ACC) +
          svgCommit(xs[5], mainY, ACC, 'M', { merge: true }) +
          svgBranchLabel(xs[5], mainY, 'main', INK, { head: true, direction: 'above' }) +
          svgBranchLabel(xs[4], featY, 'feature', ACC, { direction: 'below' });
      } else {
        rest =
          svgEdge(xs[4], mainY, xs[5], mainY, ACC, { dashed: true }) +
          svgCommit(xs[5], mainY, ACC, "g7'") +
          svgBranchLabel(xs[5], mainY, 'main', INK, { head: true, direction: 'above' }) +
          svgBranchLabel(xs[4], featY, 'feature', ACC, { direction: 'below' }) +
          svgCaption(xs[5], mainY + 36, ACC, 'new commit, same diff');
      }
      svgBg.innerHTML = '<svg viewBox="0 0 540 270">' + trunk + rest + '</svg>';
    }

    function renderTabs() {
      tabsBar.innerHTML = '';
      OPTIONS.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (o.id === active ? ' active' : '');
        b.type = 'button';
        b.textContent = o.label;
        b.onclick = function () { active = o.id; render(); };
        tabsBar.appendChild(b);
      });
    }

    function renderDesc() {
      var o = OPTIONS.find(function (x) { return x.id === active; });
      descArea.innerHTML = '<h3>' + o.title + '</h3>' + o.body;
    }

    function render() { renderTabs(); renderSVG(); renderDesc(); }
    render();
    sec.appendChild(panel);
    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §03 -- How conflicts arise
  // ------------------------------------------------------------------
  function buildSection03(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(2, 'How Conflicts Arise'));

    // Body uses the concrete example from the code block below: ours
    // edits the function name on line 1 (greet -> intro), theirs edits
    // the greeting on line 3 (Hello -> Hi). These are independent
    // changes, so Git auto-resolves them. The conflict in the table
    // sits on line 2 (both sides changed the colour).
    sec.appendChild(el('p', 'gm-body',
      'Git\'s three-way merge can auto-resolve <strong>independent</strong> ' +
      'changes. If <span class="gm-ilink" data-gm-action="show-indep-lines">' +
      'one side edited line 1 and the other side edited line 3</span>, then ' +
      'there are no issues. A conflict arises when both branches modify ' +
      '<strong>the same line</strong> differently, or when one side edits while ' +
      'the other deletes. Git cannot infer which intent to honour, so it stops ' +
      'and requests user input.'));

    // Tab group: three-way (greet.swift conflict resolution) vs two-way
    // (retries example, moved from §01 to show why all diffs conflict
    // without a shared ancestor).
    var OPTS = [
      { id: 'three', label: 'Three-way merge' },
      { id: 'two',   label: 'Two-way merge'   }
    ];
    var active = 'three';

    var panel = div('gm-panel');
    var tabsBar = div('mcp-tabs');
    panel.appendChild(tabsBar);
    var contentArea = div('');
    panel.appendChild(contentArea);

    // ── Three-way content ──
    // Swift snippets for the file-version table. Each line carries a
    // data-line index so the in-prose link can flash the independent
    // edits (line 1 in Ours, line 3 in Theirs) on click.
    function lineDecl(funcName, hl) {
      return '<span class="line' + (hl ? ' hl' : '') + '" data-line="1">' +
        '<span class="gm-kw">func</span> ' + funcName + '() {</span>';
    }
    function lineColor(colour, hl) {
      return '<span class="line' + (hl ? ' hl' : '') + '" data-line="2">' +
        '    <span class="gm-kw">let</span> color = <span class="gm-str">"' + colour + '"</span></span>';
    }
    function linePrint(greeting, hl) {
      return '<span class="line' + (hl ? ' hl' : '') + '" data-line="3">' +
        '    print(<span class="gm-str">"' + greeting + '!"</span>)</span>';
    }
    function lineClose() { return '<span class="line" data-line="4">}</span>'; }

    // Per-cell composition: base is unchanged; ours renames the function
    // to "intro" (line 1) and changes colour to red (line 2); theirs
    // changes colour to green (line 2) and greeting to "Hi" (line 3).
    var baseCell  = lineDecl('greet', false) + lineColor('blue',  false) + linePrint('Hello', false) + lineClose();
    var oursCell  = lineDecl('intro', false) + lineColor('red',   true)  + linePrint('Hello', false) + lineClose();
    var theirsCell = lineDecl('greet', false) + lineColor('green', true)  + linePrint('Hi',    false) + lineClose();

    var fileTable = div('gm-table-wrap');
    fileTable.innerHTML =
      '<div class="role-table-frame">' +
        '<table class="gm-table">' +
          '<thead>' +
            '<tr class="role-table-head">' +
              '<th class="role-table-head-cell">Merge Base ' +
                '<span class="gm-vershead-sub">(c3)</span></th>' +
              '<th class="role-table-head-cell" data-gm-col="ours">Ours ' +
                '<span class="gm-vershead-sub">(e5, main)</span></th>' +
              '<th class="role-table-head-cell" data-gm-col="theirs">Theirs ' +
                '<span class="gm-vershead-sub">(g7, feature)</span></th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr>' +
              '<td class="gm-cell-pre"><pre class="role-code-block">' + baseCell + '</pre></td>' +
              '<td class="gm-cell-pre" data-gm-col="ours"><pre class="role-code-block">' + oursCell + '</pre></td>' +
              '<td class="gm-cell-pre" data-gm-col="theirs"><pre class="role-code-block">' + theirsCell + '</pre></td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';

    var conflictArea = div('gm-svg-bg');
    conflictArea.style.display = 'block';
    conflictArea.innerHTML =
      '<pre class="role-code-block gm-conflict-block" style="margin: 0;">' +
        '<span class="line gm-cmt">// CONFLICT (content): Merge conflict in greet.swift</span>' +
        '<span class="line"><span class="gm-kw">func</span> intro() {</span>' +
        '<span class="line gm-cm">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD (main)</span>' +
        '<span class="line gm-ours">    <span class="gm-kw">let</span> color = <span class="gm-str">"red"</span></span>' +
        '<span class="line gm-cm">=======</span>' +
        '<span class="line gm-theirs">    <span class="gm-kw">let</span> color = <span class="gm-str">"green"</span></span>' +
        '<span class="line gm-cm">&gt;&gt;&gt;&gt;&gt;&gt;&gt; feature</span>' +
        '<span class="line">    print(<span class="gm-str">"Hi!"</span>)</span>' +
        '<span class="line">}</span>' +
      '</pre>';

    var conflictDesc = div('gm-arch-desc');
    conflictDesc.innerHTML =
      '<h3>Resolving the conflict</h3>' +
      '<p>Lines 1 and 3 are not conflicted. Only <code>main</code> renamed ' +
      'the function (<code>greet</code> → <code>intro</code>), and only ' +
      '<code>feature</code> changed the greeting (<code>"Hello"</code> → ' +
      '<code>"Hi"</code>), so Git takes each side\'s version automatically. ' +
      'The conflict is purely on line 2, where both sides changed the colour ' +
      'to incompatible values.</p>' +
      '<p>The conflict is resolved by editing the file (picking, combining, ' +
      'or rewriting), staging it with <code>git add</code>, and committing. ' +
      'That commit is the <a href="#sec-04" class="gm-ilink">merge commit</a>.</p>';

    // ── Two-way content (moved from §01) ──
    // Without a shared ancestor, every differing line is a conflict because
    // there is no baseline to determine which side changed what.
    var twoDesc = div('gm-arch-desc');
    twoDesc.innerHTML =
      '<h3>No shared ancestor</h3>' +
      '<p>Without a common ancestor, Git sees only two file snapshots.</p>' +
      '<div class="gm-table-wrap" style="margin: 8px 0 14px;">' +
        '<div class="role-table-frame">' +
          '<table class="gm-table">' +
            '<thead><tr class="role-table-head">' +
              '<th class="role-table-head-cell">Ours <span class="gm-vershead-sub">(d4)</span></th>' +
              '<th class="role-table-head-cell">Theirs <span class="gm-vershead-sub">(p4)</span></th>' +
            '</tr></thead>' +
            '<tbody><tr>' +
              '<td class="gm-cell-pre"><pre class="role-code-block">' +
                '<span class="line"><span class="gm-kw">let</span> retries = <span class="gm-str">3</span></span>' +
              '</pre></td>' +
              '<td class="gm-cell-pre"><pre class="role-code-block">' +
                '<span class="line"><span class="gm-kw">let</span> retries = <span class="gm-str">5</span></span>' +
              '</pre></td>' +
            '</tr></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<p>Both lines differ. Did <code>ours</code> raise the limit, or did ' +
      '<code>theirs</code> lower it? With only two points there is no answer: ' +
      'a two-way merge must flag every difference as a conflict.</p>' +
      '<p>A three-way merge consults the merge base. If the base read ' +
      '<code>retries = 3</code>, only <code>theirs</code> changed it, so ' +
      'Git auto-resolves to <code>5</code>. Both sides changing the same ' +
      'line is the only case that still needs human input.</p>';

    function renderTabs() {
      tabsBar.innerHTML = '';
      OPTS.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (o.id === active ? ' active' : '');
        b.type = 'button';
        b.textContent = o.label;
        b.onclick = function () { active = o.id; render(); };
        tabsBar.appendChild(b);
      });
    }

    function render() {
      renderTabs();
      contentArea.innerHTML = '';
      if (active === 'three') {
        contentArea.appendChild(fileTable);
        contentArea.appendChild(conflictArea);
        contentArea.appendChild(conflictDesc);
      } else {
        contentArea.appendChild(twoDesc);
      }
    }
    render();
    sec.appendChild(panel);

    // Sequential edits on a single branch don't conflict, even when
    // they touch the same line; this paragraph addresses that follow-on
    // question as regular prose beneath the panel.
    var sameBranchPara = el('p', 'gm-body',
      'Why don\'t two commits on the same branch conflict when they touch ' +
      'the same line? Because each commit has a single parent- the second ' +
      'commit\'s diff is applied directly to the state left by the first, ' +
      'so the order and the result are unambiguous. A conflict results via two ' +
      'divergent histories meeting at a merge, not a single stream of edits.');
    sec.appendChild(sameBranchPara);

    // Wire the in-prose link: switch to the three-way tab if needed, then
    // flash line 1 in the Ours column and line 3 in the Theirs column.
    sec.querySelectorAll('[data-gm-action="show-indep-lines"]').forEach(function (link) {
      link.addEventListener('click', function () {
        if (active !== 'three') {
          active = 'three';
          render();
        }
        requestAnimationFrame(function () {
          var targets = [
            fileTable.querySelector('td[data-gm-col="ours"] [data-line="1"]'),
            fileTable.querySelector('td[data-gm-col="theirs"] [data-line="3"]')
          ];
          targets.forEach(function (n) {
            if (!n) return;
            n.classList.remove('gm-line-flash');
            void n.getBoundingClientRect();
            n.classList.add('gm-line-flash');
          });
        });
      });
    });

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §04 -- Inside a merge commit + scenarios (tabbed)
  // ------------------------------------------------------------------
  function buildSection04(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(4, 'Inside a Merge Commit'));


    sec.appendChild(el('p', 'gm-body',
      'A merge commit is a regular commit with two (or more) ' +
      '<span class="gm-ilink" data-gm-action="pulse-parents">parent pointers</span>. ' +
      'Its tree is whatever the working directory looked like when ' +
      '<code>git commit</code> ran after resolution, which means ' +
      '<strong>the merge commit\'s contents include the conflict resolution</strong>. ' +
      'If there were no conflicts, the merge commit is often empty in terms of ' +
      '"new" content and just records that two histories joined.'));

    // Three variants of a merge commit, shown as a tab group. The
    // viewing area uses a fixed min-height sized to the tallest variant,
    // so the panel does not jump as the user switches tabs.
    function L(html, cls) {
      return '<span class="line' + (cls ? ' ' + cls : '') + '">' + html + '</span>';
    }
    // Parent SHAs are wrapped in .gm-parent-sha so the in-prose
    // "parent pointers" link and the anatomy table's "Parents" link
    // can pulse them on click. The "two/three parents" inline comment
    // is also part of the highlight so the count is legible.
    var PSHA1 = '<span class="gm-parent-sha">3e1b7a2</span>';
    var PSHA2 = '<span class="gm-parent-sha">c8d4f0a</span>';
    var PSHA3 = '<span class="gm-parent-sha">a1b2c3d</span>';
    var COMMIT_VARIANTS = [
      { id: 'conflict', label: 'With Conflict Resolution',
        lines: [
          L('<span class="gm-msg">commit</span> 9f2a8c1d4b… <span class="gm-key">(HEAD → main)</span>'),
          L('<span class="gm-key">Merge:</span> ' + PSHA1 + ' ' + PSHA2 + '   <span class="gm-cmt">// two parents</span>'),
          L('<span class="gm-key">Author:</span> Harry Du Bois &lt;harry@example.com&gt;'),
          L('<span class="gm-key">Date:</span>   Wed May 7 14:22 2026'),
          L('&nbsp;'),
          L('    Merge branch \'feature\' into main'),
          L('&nbsp;'),
          L('    Resolved color conflict in greet.swift by keeping "red".'),
          L('&nbsp;'),
          L('<span class="gm-add">+   let color = "red"</span>'),
          L('<span class="gm-add">    return "Hi, \\(name)!"</span>   <span class="gm-cmt">// from feature, no conflict</span>')
        ] },
      { id: 'clean', label: 'Clean Merge',
        lines: [
          L('<span class="gm-msg">commit</span> 4a17e0f6c1… <span class="gm-key">(HEAD → main)</span>'),
          L('<span class="gm-key">Merge:</span> ' + PSHA1 + ' ' + PSHA2 + '   <span class="gm-cmt">// two parents</span>'),
          L('<span class="gm-key">Author:</span> Harry Du Bois &lt;harry@example.com&gt;'),
          L('<span class="gm-key">Date:</span>   Wed May 7 14:22 2026'),
          L('&nbsp;'),
          L('    Merge branch \'feature\' into main'),
          L('&nbsp;'),
          L('<span class="gm-cmt">// no conflicts; tree = combined state of both tips, no diff to show</span>')
        ] },
      { id: 'octopus', label: 'Octopus Merge',
        lines: [
          L('<span class="gm-msg">commit</span> 7c2b9af3e0… <span class="gm-key">(HEAD → main)</span>'),
          L('<span class="gm-key">Merge:</span> ' + PSHA1 + ' ' + PSHA2 + ' ' + PSHA3 + '   <span class="gm-cmt">// three parents</span>'),
          L('<span class="gm-key">Author:</span> Harry Du Bois &lt;harry@example.com&gt;'),
          L('<span class="gm-key">Date:</span>   Wed May 7 14:22 2026'),
          L('&nbsp;'),
          L('    Merge branches \'feature-a\' and \'feature-b\' into main'),
          L('&nbsp;'),
          L('<span class="gm-cmt">// only allowed when no side conflicts with another side</span>')
        ] }
    ];

    var cActive = 'conflict';
    var commitPanel = div('gm-panel');
    var commitTabs  = div('mcp-tabs');
    var commitArea  = div('gm-commit-area');
    commitPanel.appendChild(commitTabs);
    commitPanel.appendChild(commitArea);

    function renderCommitVariant() {
      commitTabs.innerHTML = '';
      COMMIT_VARIANTS.forEach(function (v) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (v.id === cActive ? ' active' : '');
        b.type = 'button';
        b.textContent = v.label;
        b.onclick = function () { cActive = v.id; renderCommitVariant(); };
        commitTabs.appendChild(b);
      });
      var v = COMMIT_VARIANTS.find(function (x) { return x.id === cActive; });
      commitArea.innerHTML = '<pre class="role-code-block">' + v.lines.join('') + '</pre>';
    }
    renderCommitVariant();
    sec.appendChild(commitPanel);

    var anatomy = div('gm-table-wrap');
    anatomy.innerHTML =
      '<div class="role-table-frame">' +
        '<table class="gm-table">' +
          '<thead><tr class="role-table-head">' +
            '<th class="role-table-head-cell" style="width:18%; white-space: nowrap;">&nbsp;</th>' +
            '<th class="role-table-head-cell">What it holds</th>' +
          '</tr></thead>' +
          '<tbody>' +
            '<tr><td class="role-table-cell">' +
              '<span class="gm-ilink" data-gm-action="pulse-parents"><strong>Parents</strong></span>' +
            '</td>' +
            '<td class="role-table-cell">First parent is the branch the merge ' +
              'was performed on (<code>main</code>); second is the branch ' +
              'merged in (<code>feature</code>). This ordering is what ' +
              '<code>HEAD^N</code> walks:' +
              '<ul class="gm-keys" style="margin: 8px 0 0 22px;">' +
                '<li><code>HEAD^1</code> resolves to the first parent ' +
                  '(<code>main</code>\'s previous tip).</li>' +
                '<li><code>HEAD^2</code> resolves to the second parent ' +
                  '(<code>feature</code>\'s tip).</li>' +
                '<li><code>HEAD^3</code> only exists for an octopus merge ' +
                  '(three or more parents); on a regular two-parent merge it ' +
                  'errors out as "no such ref".</li>' +
              '</ul>' +
            '</td></tr>' +
            '<tr><td class="role-table-cell"><strong>Tree (snapshot)</strong></td>' +
            '<td class="role-table-cell">The full state of all files post-resolution. ' +
              'If conflicts existed, the hand-edited file is what is stored as a complete snapshot, ' +
              'like any other commit.</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    sec.appendChild(anatomy);

    sec.appendChild(el('p', 'gm-body',
      'A merge commit\'s special structure can usually be ignored: it just ' +
      'sits in history like any other commit. The shape only matters when an ' +
      'operation has to choose <strong>which</strong> parent to follow, or ' +
      'has to decide what to do when a merge appears inside a range.'));

    // Small SVGs accompany the first three scenarios. Each diagram shows
    // a merge commit M with its two parents (e5 on main, g7 on feature),
    // plus the operation's effect on history.
    function svgRevert() {
      var mY = 120, fY = 200;
      var xs = [30, 100, 170, 240, 310, 380];
      return '<svg viewBox="0 0 480 230">' +
        // main trunk c3 - d4 - e5 - f6 (merge) - g7' (revert).
        // The main-side incoming edge into the merge stays INK; the
        // feature-side curve into the merge stays ACC.
        svgEdge(xs[0], mY, xs[1], mY, INK) +
        svgEdge(xs[1], mY, xs[2], mY, INK) +
        svgEdge(xs[2], mY, xs[3], mY, INK) +
        svgEdge(xs[3], mY, xs[4], mY, ACC) +
        // feature: branches off c3, has two commits, second merges into f6
        svgEdge(xs[0], mY, xs[1], fY, ACC) +
        svgEdge(xs[1], fY, xs[2], fY, ACC) +
        svgEdge(xs[2], fY, xs[3], mY, ACC) +
        svgCommit(xs[0], mY, INK, 'c3') +
        svgCommit(xs[1], mY, INK, 'd4') +
        svgCommit(xs[2], mY, INK, 'e5') +
        svgCommit(xs[3], mY, ACC, 'f6', { merge: true }) +
        svgCommit(xs[4], mY, ACC, "g7'") +
        svgCommit(xs[1], fY, ACC, 'z1', { dim: true }) +
        svgCommit(xs[2], fY, ACC, 'z2', { dim: true }) +
        svgCaption(xs[4] + 4, mY + 36, 'var(--coral-strong)', 'Undo feature\'s diff') +
        svgBranchLabel(xs[4], mY, 'main', INK, { head: true, direction: 'above' }) +
        '</svg>';
    }

    function svgCherryMerge() {
      var sY = 120, mY = 200, fY = 265;
      var xs = [40, 110, 180, 250, 320, 390, 460];
      return '<svg viewBox="0 0 560 335">' +
        // release branch (top): two existing commits then f6' cherry-picked
        svgEdge(xs[4], sY, xs[5], sY, INK) +
        svgEdge(xs[5], sY, xs[6], sY, ACC, { dashed: true }) +
        svgCommit(xs[4], sY, INK, 'r1') +
        svgCommit(xs[5], sY, INK, 'r2') +
        svgCommit(xs[6], sY, ACC, "f6'") +
        svgBranchLabel(xs[6], sY, 'release', INK, { head: true, direction: 'above' }) +
        // main (middle): c3, d4, e5 then merge commit f6.
        // Main-side edge into the merge stays INK; feature-side curve stays ACC.
        svgEdge(xs[0], mY, xs[1], mY, INK) +
        svgEdge(xs[1], mY, xs[2], mY, INK) +
        svgEdge(xs[2], mY, xs[4], mY, INK) +
        // feature (bottom): three commits, last merges into f6
        svgEdge(xs[0], mY, xs[1], fY, ACC) +
        svgEdge(xs[1], fY, xs[2], fY, ACC) +
        svgEdge(xs[2], fY, xs[3], fY, ACC) +
        svgEdge(xs[3], fY, xs[4], mY, ACC) +
        svgCommit(xs[0], mY, INK, 'c3') +
        svgCommit(xs[1], mY, INK, 'd4') +
        svgCommit(xs[2], mY, INK, 'e5') +
        svgCommit(xs[4], mY, ACC, 'f6', { merge: true }) +
        svgCommit(xs[1], fY, ACC, 'z1', { dim: true }) +
        svgCommit(xs[2], fY, ACC, 'z2', { dim: true }) +
        svgCommit(xs[3], fY, ACC, 'z3', { dim: true }) +
        svgBranchLabel(xs[3], fY, 'feature', ACC, { direction: 'below' }) +
        '</svg>';
    }

    function svgSquash() {
      // Three stacked chains, each gets a left-side eyebrow label so the
      // viewer can tell them apart at a glance.
      //   1. REFERENCE (faded): the original merge state with z1, z2
      //      brought in via the merge commit M, plus a post-merge
      //      commit n1 to make the squash scenario realistic.
      //   2. rebase -i: walks first-parent only, drops the merge, so
      //      the feature work disappears.
      //   3. --squash: an alternative path that never records a merge
      //      commit; a single S holds the feature's combined diff.
      var c1 = 50, c1f = 105, c2 = 180, c3 = 250;
      var xs = [110, 180, 250, 320, 390];
      function eyebrow(x, y, text) {
        return '<text x="' + x + '" y="' + (y - 12) + '" text-anchor="start" font-family="var(--font-mono)" font-size="10" font-weight="600" fill="var(--ink-muted)" letter-spacing="0.5">' + text + '</text>';
      }

      var chain1 =
        eyebrow(15, c1, 'REFERENCE') +
        '<g opacity="0.45">' +
          svgEdge(xs[0], c1, xs[1], c1, INK) +
          svgEdge(xs[1], c1, xs[2], c1, INK) +
          svgEdge(xs[2], c1, xs[3], c1, INK) +
          svgEdge(xs[3], c1, xs[4], c1, INK) +
          svgEdge(xs[0], c1, xs[1], c1f, ACC) +
          svgEdge(xs[1], c1f, xs[2], c1f, ACC) +
          svgEdge(xs[2], c1f, xs[3], c1, ACC) +
          svgCommit(xs[0], c1, INK, 'c3') +
          svgCommit(xs[1], c1, INK, 'd4') +
          svgCommit(xs[2], c1, INK, 'e5') +
          svgCommit(xs[3], c1, ACC, 'M', { merge: true }) +
          svgCommit(xs[4], c1, INK, 'n1') +
          svgCommit(xs[1], c1f, ACC, 'z1') +
          svgCommit(xs[2], c1f, ACC, 'z2') +
        '</g>';

      var chain2 =
        eyebrow(15, c2, 'rebase -i') +
        svgEdge(xs[0], c2, xs[1], c2, INK) +
        svgEdge(xs[1], c2, xs[2], c2, INK) +
        svgEdge(xs[2], c2, xs[3], c2, INK) +
        svgCommit(xs[0], c2, INK, 'c3') +
        svgCommit(xs[1], c2, INK, 'd4') +
        svgCommit(xs[2], c2, INK, 'e5') +
        svgCommit(xs[3], c2, ACC, "n1'") +
        '<text x="' + (xs[3] + 28) + '" y="' + (c2 + 5) + '" font-family="var(--font-mono)" font-size="10" fill="var(--coral-strong)">feature work vanished</text>';

      var chain3 =
        eyebrow(15, c3, '--squash') +
        svgEdge(xs[0], c3, xs[1], c3, INK) +
        svgEdge(xs[1], c3, xs[2], c3, INK) +
        svgEdge(xs[2], c3, xs[3], c3, ACC) +
        svgCommit(xs[0], c3, INK, 'c3') +
        svgCommit(xs[1], c3, INK, 'd4') +
        svgCommit(xs[2], c3, INK, 'e5') +
        svgCommit(xs[3], c3, ACC, 'S') +
        '<text x="' + (xs[3] + 28) + '" y="' + (c3 + 5) + '" font-family="var(--font-mono)" font-size="10" fill="var(--coral)">combined diff, no merge link</text>';

      return '<svg viewBox="0 0 540 295">' + chain1 + chain2 + chain3 + '</svg>';
    }

    // Visual for the "Read History" scenario: the same merge state as
    // the reference chain, but with the first-parent line drawn as a
    // bold coral path and feature commits dimmed, mirroring what
    // `git log --first-parent` highlights.
    function svgFirstParent() {
      var mY = 80, fY = 160;
      var xs = [50, 130, 210, 290, 370];
      // The first-parent line is highlighted by stroke width alone now,
      // so the main-side colour stays INK (no special highlight tint).
      function boldEdge(x1, y1, x2, y2) {
        return svgEdge(x1, y1, x2, y2, INK, { width: 3 });
      }
      return '<svg viewBox="0 0 480 220">' +
        // Dimmed feature edges and commits
        svgEdge(xs[0], mY, xs[1], fY, ACC, { opacity: 0.3 }) +
        svgEdge(xs[1], fY, xs[2], fY, ACC, { opacity: 0.3 }) +
        svgEdge(xs[2], fY, xs[3], mY, ACC, { opacity: 0.3 }) +
        // Bold first-parent line on main (INK, width 3)
        boldEdge(xs[0], mY, xs[1], mY) +
        boldEdge(xs[1], mY, xs[2], mY) +
        boldEdge(xs[2], mY, xs[3], mY) +
        boldEdge(xs[3], mY, xs[4], mY) +
        svgCommit(xs[0], mY, INK, 'c3') +
        svgCommit(xs[1], mY, INK, 'd4') +
        svgCommit(xs[2], mY, INK, 'e5') +
        svgCommit(xs[3], mY, ACC, 'M', { merge: true }) +
        svgCommit(xs[4], mY, INK, 'n1') +
        svgCommit(xs[1], fY, ACC, 'z1', { dim: true }) +
        svgCommit(xs[2], fY, ACC, 'z2', { dim: true }) +
        svgCaption(xs[2], mY - 26, 'var(--coral-strong)', '--first-parent walks this line') +
        '</svg>';
    }

    var SCENARIOS = [
      { id: 'revert',  label: 'Revert',      title: 'Reverting a merge',
        svg: svgRevert,
        body:
          '<p>A plain <code>git revert &lt;merge-sha&gt;</code> fails, because ' +
          'Git cannot tell which side of the merge to revert. <code>-m</code> ' +
          'selects the parent that represents the line of history to keep:</p>' +
          '<pre class="role-code-block"><span class="cmt"># -m 1: keep main (first parent); undo feature\'s changes</span>\n' +
          '<span class="prompt">$</span> ' +
          '<span class="cmd">git revert -m 1 f6</span></pre>' +
          '<p>The reversal is the inverse of the diff from the chosen parent ' +
          'to the merge commit (<code>git diff e5..f6</code> with <code>-m 1</code>), ' +
          'not the diff from the merge base. That direction is what captures ' +
          'feature\'s contribution: <code>e5</code> is main\'s tip just before ' +
          'the merge, and <code>f6</code> includes everything the merge pulled ' +
          'in from the second parent (<code>z2</code>) plus any conflict-' +
          'resolution edits. The new commit <code>g7\'</code> subtracts that ' +
          'contribution while leaving the merge itself in history. Caveat: ' +
          're-merging <code>feature</code> later does not bring those changes ' +
          'back, because Git still sees them as already merged. The remedy is ' +
          'usually to revert the revert.</p>' },
      { id: 'cherry',  label: 'Cherry-Pick', title: 'Cherry-picking a merge',
        svg: svgCherryMerge,
        body:
          '<p>By default <code>git cherry-pick</code> refuses a merge commit ' +
          'for the same reason: which parent\'s diff should it replay? ' +
          '<code>-m</code> selects the mainline parent, and the cherry-pick ' +
          'becomes "everything that was added relative to that parent":</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git cherry-pick -m 1 f6</span></pre>' +
          '<p>"Everything added relative to the parent" means the combined ' +
          'diff of every commit the merge brought in via its second parent, ' +
          'collapsed into one new commit. In the diagram above, ' +
          '<code>f6</code> absorbed three feature commits ' +
          '(<code>z1</code>, <code>z2</code>, <code>z3</code>) on the source ' +
          'side; cherry-picking it onto <code>release</code> produces a ' +
          'single commit <code>f6\'</code> whose diff is the union of those ' +
          'three.</p>' +
          '<p>This is occasionally useful for porting a feature-bundle to ' +
          'another long-lived branch, but the result is squashed: the ' +
          'individual feature commits are not replayed.</p>' },
      { id: 'squash',  label: 'Squash',      title: 'Squashing across a merge commit',
        svg: svgSquash,
        body:
          '<p>Interactive rebase (<code>git rebase -i</code>) flattens history ' +
          'by walking commits one parent at a time. By default, when it hits ' +
          'a merge commit it <strong>drops</strong> the merge entirely and ' +
          'replays only the first-parent line: any commits brought in by the ' +
          'merge\'s second parent vanish. The middle chain above shows the ' +
          'aftermath: the post-merge commit <code>n1</code> is replayed as ' +
          '<code>n1\'</code>, but the feature work (<code>z1</code>, ' +
          '<code>z2</code>) is gone.</p>' +
          '<p>To preserve the merge structure while rewriting, use ' +
          '<code>--rebase-merges</code>:</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git rebase -i --rebase-merges main</span>\n' +
          '<span class="cmt"># merges become "label" / "merge" directives in the todo list</span></pre>' +
          '<p>If the goal is the opposite (collapse a feature plus its merge ' +
          'into a single tidy commit on top of <code>main</code>), it is ' +
          'almost always cleaner to <strong>not</strong> have made the merge ' +
          'in the first place: <code>git merge --squash feature</code> stages ' +
          'the feature\'s combined diff without recording a merge commit. The ' +
          'bottom chain (commit <code>S</code>) shows that result; a normal ' +
          '<code>git commit</code> lands it on <code>main</code>.</p>' },
      { id: 'history', label: 'Read History', title: 'Reading history past a merge',
        svg: svgFirstParent,
        body:
          '<p>Two flags make merges legible after the fact. ' +
          '<code>git log --first-parent</code> follows only the mainline (' +
          'highlighted in the diagram above), producing a high-level ' +
          'summary where each feature appears as a single merge entry ' +
          'rather than the full sequence of feature commits.</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git log --oneline --graph --first-parent main</span></pre>' +
          '<p><code>git diff HEAD^1..HEAD^2</code> shows what the merged-in ' +
          'branch contributed (relative to where mainline was), and ' +
          '<code>git show HEAD</code> on a merge commit displays only the ' +
          'conflict resolution, not the entirety of either side.</p>' }
    ];

    var sActive = 'revert';
    var sPanel = div('gm-panel');
    var sTabs = div('mcp-tabs');
    var sSvgBg = div('gm-svg-bg');
    var sDesc = div('gm-arch-desc');
    sPanel.appendChild(sTabs);
    sPanel.appendChild(sSvgBg);
    sPanel.appendChild(sDesc);

    function renderScenarios() {
      sTabs.innerHTML = '';
      SCENARIOS.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (s.id === sActive ? ' active' : '');
        b.type = 'button';
        b.textContent = s.label;
        b.onclick = function () { sActive = s.id; renderScenarios(); };
        sTabs.appendChild(b);
      });
      var s = SCENARIOS.find(function (x) { return x.id === sActive; });
      if (s.svg) {
        sSvgBg.innerHTML = s.svg();
        sSvgBg.style.display = '';
      } else {
        sSvgBg.innerHTML = '';
        sSvgBg.style.display = 'none';
      }
      sDesc.innerHTML = s.body;
    }
    renderScenarios();
    sec.appendChild(sPanel);

    // "parent pointers" / "Parents" internal links: pulse the parent
    // SHAs in whichever commit-log variant is currently active. The
    // commit log is always visible above, so the cue is reliable.
    sec.querySelectorAll('[data-gm-action="pulse-parents"]').forEach(function (link) {
      link.addEventListener('click', function () {
        commitArea.querySelectorAll('.gm-parent-sha').forEach(function (sha) {
          sha.classList.remove('gm-sha-pulse');
          void sha.getBoundingClientRect();
          sha.classList.add('gm-sha-pulse');
        });
      });
    });

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §05 -- "Merge X into Y"
  // ------------------------------------------------------------------
  function buildSection05(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(3, 'Merge Conventions'));

    sec.appendChild(el('p', 'gm-body',
      'The convention is <em>merge X into Y</em>, where Y is the current ' +
      'branch (the one <code>HEAD</code> points at) and X is the branch named ' +
      'in the command. So running:'));

    // HEAD is annotated as an inline comment alongside each command,
    // making the "merge X into Y" convention legible from the code
    // alone.
    sec.appendChild(el('pre', 'role-code-block',
      '<span class="prompt">$</span> <span class="cmd">git checkout main</span>    <span class="cmt"># HEAD now points at main</span>\n' +
      '<span class="prompt">$</span> <span class="cmd">git merge feature</span>    <span class="cmt"># merge feature into HEAD (main)</span>'));

    var mainY = 120, featY = 200;
    var xs = [60, 140, 220, 300, 380];
    var svg =
      '<svg viewBox="0 0 480 270">' +
        svgEdge(xs[0], mainY, xs[1], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], featY, ACC) +
        svgEdge(xs[2], featY, xs[3], featY, ACC) +
        // Main-side incoming to the merge keeps INK; feature-side stays ACC.
        svgEdge(xs[3], mainY, xs[4], mainY, INK) +
        svgEdge(xs[3], featY, xs[4], mainY, ACC) +
        svgCommit(xs[0], mainY, INK, 'a1') +
        svgCommit(xs[1], mainY, INK, 'b2') +
        svgCommit(xs[2], mainY, INK, 'c3') +
        svgCommit(xs[3], mainY, INK, 'd4') +
        svgCommit(xs[2], featY, ACC, 'f6') +
        svgCommit(xs[3], featY, ACC, 'g7') +
        svgCommit(xs[4], mainY, ACC, 'M', { merge: true }) +
        svgBranchLabel(xs[4], mainY, 'main', INK, { head: true, direction: 'above' }) +
        svgBranchLabel(xs[3], featY, 'feature', ACC, { direction: 'below' }) +
      '</svg>';

    // Mirror §01's panel recipe: visual on top (svg-bg), description /
    // bullets in arch-desc beneath, all inside a single gm-panel so the
    // dot points read as part of the figure rather than floating prose.
    var panel = div('gm-panel');
    panel.appendChild(div('gm-svg-bg', svg));
    var desc = div('gm-arch-desc');
    desc.innerHTML =
      '<ul class="gm-keys" style="margin: 0 0 0 22px;">' +
        '<li><code>main</code> moves forward: it now points to the new ' +
          'merge commit M.</li>' +
        '<li><code>feature</code> stays put: its tip is still ' +
          '<code>g7</code>. It has been "absorbed", but not consumed.</li>' +
      '</ul>';
    panel.appendChild(desc);
    sec.appendChild(panel);

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §06 -- Rebase (tabbed: before / after)
  // ------------------------------------------------------------------
  function buildSection06(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(6, 'Rebase: Replaying Instead of Recording'));

    var STATES = [
      { id: 'before', label: 'Before Rebase',
        title: 'Before: feature still rooted at the old base',
        body:
          '<p><code>main</code> has moved on to <code>e5</code> and ' +
          '<code>feature</code> still sprouts from the old merge base ' +
          '<code>c3</code>. Both branches share <code>c3</code> as ancestor, ' +
          'and a merge here would record both lineages with a merge commit.</p>' },
      { id: 'after',  label: 'After Rebase',
        title: 'After: feature commits replayed on top of e5',
        body:
          '<p>The original <code>f6</code>/<code>g7</code> are set aside; new ' +
          'commits <code>f6\'</code>/<code>g7\'</code> are constructed by ' +
          'applying the same diffs on top of <code>e5</code>. The branch tip ' +
          'now points at <code>g7\'</code>, and the original commits are ' +
          'unreachable (Git\'s reflog still retains them for ~90 days).</p>' +
          '<p>The resulting history is linear, and the parallelism that ' +
          'actually happened is no longer recorded.</p>' }
    ];

    var rActive = 'before';
    var panel = div('gm-panel');
    var tabs = div('mcp-tabs');
    panel.appendChild(tabs);
    var svgBg = div('gm-svg-bg');
    panel.appendChild(svgBg);
    var desc = div('gm-arch-desc');
    panel.appendChild(desc);

    var mainY = 120, featY = 200;
    var xs = [50, 120, 190, 260, 330, 400, 470];

    function renderSVG() {
      var trunk =
        svgEdge(xs[0], mainY, xs[1], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], mainY, INK) +
        svgEdge(xs[3], mainY, xs[4], mainY, INK) +
        svgCommit(xs[0], mainY, INK, 'a1') +
        svgCommit(xs[1], mainY, INK, 'b2') +
        svgCommit(xs[2], mainY, INK, 'c3') +
        svgCommit(xs[3], mainY, INK, 'd4') +
        svgCommit(xs[4], mainY, INK, 'e5');

      var rest;
      if (rActive === 'before') {
        rest =
          svgEdge(xs[2], mainY, xs[3], featY, ACC) +
          svgEdge(xs[3], featY, xs[4], featY, ACC) +
          svgCommit(xs[3], featY, ACC, 'f6') +
          svgCommit(xs[4], featY, ACC, 'g7') +
          svgBranchLabel(xs[4], mainY, 'main', INK, { direction: 'above' }) +
          svgBranchLabel(xs[4], featY, 'feature', ACC, { head: true, direction: 'below' });
      } else {
        rest =
          svgEdge(xs[4], mainY, xs[5], mainY, ACC) +
          svgEdge(xs[5], mainY, xs[6], mainY, ACC) +
          svgCommit(xs[5], mainY, ACC, "f6'") +
          svgCommit(xs[6], mainY, ACC, "g7'") +
          svgBranchLabel(xs[4], mainY, 'main', INK, { direction: 'below' }) +
          svgBranchLabel(xs[6], mainY, 'feature', ACC, { head: true, direction: 'above' });
      }
      svgBg.innerHTML = '<svg viewBox="0 0 560 310">' + trunk + rest + '</svg>';
    }

    function render() {
      tabs.innerHTML = '';
      STATES.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (s.id === rActive ? ' active' : '');
        b.type = 'button';
        b.textContent = s.label;
        b.onclick = function () { rActive = s.id; render(); };
        tabs.appendChild(b);
      });
      var s = STATES.find(function (x) { return x.id === rActive; });
      desc.innerHTML = '<h3>' + s.title + '</h3>' + s.body;
      renderSVG();
    }
    render();
    sec.appendChild(panel);

    var compare = div('gm-table-wrap');
    compare.innerHTML =
      '<div class="role-table-frame">' +
        '<table class="gm-table">' +
          '<thead><tr class="role-table-head">' +
            '<th class="role-table-head-cell" style="width:28%">Aspect</th>' +
            '<th class="role-table-head-cell">Merge</th>' +
            '<th class="role-table-head-cell">Rebase</th>' +
          '</tr></thead>' +
          '<tbody>' +
            '<tr>' +
              '<td class="role-table-cell"><strong>Original commits</strong></td>' +
              '<td class="role-table-cell">Kept exactly as written.</td>' +
              '<td class="role-table-cell">Copied onto a new base with ' +
                'new hashes (<code>f6\'</code>, <code>g7\'</code>); originals ' +
                'become unreachable.</td>' +
            '</tr>' +
            '<tr>' +
              '<td class="role-table-cell"><strong>History shape</strong></td>' +
              '<td class="role-table-cell">Forks and joins. The merge ' +
                'commit records that work happened in parallel.</td>' +
              '<td class="role-table-cell">Linear. Reads as if the feature ' +
                'had been written on top of today\'s <code>main</code> ' +
                'all along.</td>' +
            '</tr>' +
            '<tr>' +
              '<td class="role-table-cell"><strong>Tie to source branch</strong></td>' +
              '<td class="role-table-cell">Yes, via the second parent ' +
                'pointer.</td>' +
              '<td class="role-table-cell">None. The replay is independent ' +
                'of the original branch.</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    sec.appendChild(compare);

    // ---- Conflict during rebase ---------------------------------------
    sec.appendChild(el('p', 'gm-body',
      '<strong>Rebase can still produce conflicts.</strong> When a replayed ' +
      'commit modifies a line that the new base also changed, Git pauses the ' +
      'rebase mid-flight and requests user input to resolve. The resolution ' +
      'is identical to a merge conflict, but applied <strong>one commit at a ' +
      'time</strong> and continued with <code>git rebase --continue</code>.'));

    // Tabbed panel: Conflict Arises / After Resolution
    var CONFLICT_STATES = [
      { id: 'paused',   label: 'Conflict Arises' },
      { id: 'resolved', label: 'After Resolution' }
    ];
    var rcActive = 'paused';

    var rcPanel = div('gm-panel');
    var rcTabs = div('mcp-tabs');
    rcPanel.appendChild(rcTabs);
    var rcSvgBg = div('gm-svg-bg');
    rcPanel.appendChild(rcSvgBg);
    var rcDesc = div('gm-arch-desc');
    rcPanel.appendChild(rcDesc);

    var rcMainY = 120;
    var rcXs = [50, 120, 190, 260, 330, 400, 470];
    // (Single-row diagram; viewBox just needs head-chain clearance
    // above and the main-pointer extent below.)

    // Swift snippets reuse the same .line / .gm-kw / .gm-str / gm-cm /
    // gm-ours / gm-theirs spans as §03 so the surface is uniform.
    var pausedFile =
      '<pre class="role-code-block" style="margin:10px 0 0">' +
        '<span class="line gm-cmt">// CONFLICT (content): Merge conflict in greet.swift</span>' +
        '<span class="line"><span class="gm-kw">func</span> greet(name: <span class="gm-kw">String</span>) -&gt; <span class="gm-kw">String</span> {</span>' +
        '<span class="line gm-cm">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</span>' +
        '<span class="line gm-ours">    <span class="gm-kw">let</span> color = <span class="gm-str">"red"</span></span>' +
        '<span class="line gm-cm">=======</span>' +
        '<span class="line gm-theirs">    <span class="gm-kw">let</span> color = <span class="gm-str">"green"</span></span>' +
        '<span class="line gm-cm">&gt;&gt;&gt;&gt;&gt;&gt;&gt; g7 (replay feature)</span>' +
        '<span class="line">    <span class="gm-kw">return</span> <span class="gm-str">"Hi, \\(name)!"</span></span>' +
        '<span class="line">}</span>' +
      '</pre>';

    var resolvedFile =
      '<pre class="role-code-block" style="margin:10px 0 0">' +
        '<span class="line"><span class="gm-kw">func</span> greet(name: <span class="gm-kw">String</span>) -&gt; <span class="gm-kw">String</span> {</span>' +
        '<span class="line">    <span class="gm-kw">let</span> color = <span class="gm-str">"red"</span>   <span class="gm-cmt">// kept main\'s value</span></span>' +
        '<span class="line">    <span class="gm-kw">return</span> <span class="gm-str">"Hi, \\(name)!"</span></span>' +
        '<span class="line">}</span>' +
      '</pre>' +
      '<pre class="role-code-block" style="margin:10px 0 0">' +
        '<span class="prompt">$</span> <span class="cmd">git add greet.swift</span>\n' +
        '<span class="prompt">$</span> <span class="cmd">git rebase --continue</span>\n' +
        '<span class="cmt"># applies the resolved patch as g7\', moves on</span>' +
      '</pre>';

    function renderRcSvg() {
      // main row stays the same in both states
      var trunk =
        svgEdge(rcXs[0], rcMainY, rcXs[1], rcMainY, INK) +
        svgEdge(rcXs[1], rcMainY, rcXs[2], rcMainY, INK) +
        svgEdge(rcXs[2], rcMainY, rcXs[3], rcMainY, INK) +
        svgEdge(rcXs[3], rcMainY, rcXs[4], rcMainY, INK) +
        svgEdge(rcXs[4], rcMainY, rcXs[5], rcMainY, ACC) +
        svgCommit(rcXs[0], rcMainY, INK, 'a1') +
        svgCommit(rcXs[1], rcMainY, INK, 'b2') +
        svgCommit(rcXs[2], rcMainY, INK, 'c3') +
        svgCommit(rcXs[3], rcMainY, INK, 'd4') +
        svgCommit(rcXs[4], rcMainY, INK, 'e5') +
        svgCommit(rcXs[5], rcMainY, ACC, "f6'");

      // Both states share a "main" pointer below e5 (the rebase target).
      var mainLabel = svgBranchLabel(rcXs[4], rcMainY, 'main', INK, { direction: 'below' });

      var rest;
      if (rcActive === 'paused') {
        // g7 is paused mid-replay: drawn dimmed with a coral-strong
        // "paused" caption (no dashed ring per the v3 cleanup).
        rest = mainLabel +
          svgEdge(rcXs[5], rcMainY, rcXs[6], rcMainY, ACC, { dashed: true, opacity: 0.6 }) +
          svgCommit(rcXs[6], rcMainY, ACC, 'g7', { dim: true }) +
          '<text x="' + rcXs[6] + '" y="' + (rcMainY + 36) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--coral-strong)">⚠ paused</text>' +
          svgBranchLabel(rcXs[6], rcMainY, 'feature', ACC, { direction: 'above' });
      } else {
        rest = mainLabel +
          svgEdge(rcXs[5], rcMainY, rcXs[6], rcMainY, ACC) +
          svgCommit(rcXs[6], rcMainY, ACC, "g7'") +
          svgBranchLabel(rcXs[6], rcMainY, 'feature', ACC, { head: true, direction: 'above' });
      }
      rcSvgBg.innerHTML = '<svg viewBox="0 0 580 200">' + trunk + rest + '</svg>';
    }

    function renderRc() {
      rcTabs.innerHTML = '';
      CONFLICT_STATES.forEach(function (s) {
        var b = document.createElement('button');
        b.className = 'mcp-tab' + (s.id === rcActive ? ' active' : '');
        b.type = 'button';
        b.textContent = s.label;
        b.onclick = function () { rcActive = s.id; renderRc(); };
        rcTabs.appendChild(b);
      });
      if (rcActive === 'paused') {
        rcDesc.innerHTML =
          '<h3>Replay paused at g7</h3>' +
          '<p><code>f6\'</code> applied cleanly on top of <code>e5</code>, ' +
          'but <code>g7</code> hits a conflict: both <code>e5</code> and ' +
          '<code>g7</code> changed line 2 of <code>greet.swift</code>. Git ' +
          'leaves conflict markers in the file and stops the rebase.</p>' +
          pausedFile;
      } else {
        rcDesc.innerHTML =
          '<h3>Resolved with <code>git rebase --continue</code></h3>' +
          '<p>The file is edited to a single value, staged, and the rebase ' +
          'is continued. Git records the resolved patch as <code>g7\'</code> ' +
          'and the history is now linear.</p>' +
          resolvedFile;
      }
      renderRcSvg();
    }
    renderRc();
    sec.appendChild(rcPanel);

    sec.appendChild(el('p', 'gm-body',
      '<strong>Interactive rebase</strong> (<code>git rebase -i &lt;base&gt;</code>) ' +
      'turns the same machinery into an editing surface: each commit in the ' +
      'replay window appears in a todo list, where it can be ' +
      '<code>pick</code>ed, <code>reword</code>ed, <code>squash</code>ed, ' +
      '<code>fixup</code>ed, <code>edit</code>ed, <code>drop</code>ped, or ' +
      'reordered. It is the usual way to clean up a feature\'s history ' +
      'before sharing.'));

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // Public factory
  // ------------------------------------------------------------------
  window.createGitMergeExploration = function (rootId) {
    injectStyles();
    var root = document.getElementById(rootId);
    if (!root) return;
    root.className = 'gm';

    buildTOC(root);
    buildSection01(root);  // 1: Common Base
    buildSection03(root);  // 2: How Conflicts Arise
    buildSection05(root);  // 3: Merge Conventions
    buildSection04(root);  // 4: Inside a Merge Commit
    buildSection02(root);  // 5: Cherry-Pick
    buildSection06(root);  // 6: Rebase: Replaying Instead of Recording
  };

})();
