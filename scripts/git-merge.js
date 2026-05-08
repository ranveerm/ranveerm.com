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

      /* Tables. The minima theme's _base.scss adds hardcoded light-mode
         defaults (zebra striping, header backgrounds, cell borders) that
         use SASS variables, not CSS custom properties, so they bleed
         through in dark mode. The first block below neutralises those
         element-level rules so the role-table-* tokens win. */
      '.gm-table-wrap { margin: 16px 0; }',
      '.gm-table-wrap .role-table-frame { width: 100%; }',
      /* table-layout: fixed lets each <pre>\'s overflow-x: auto take effect
         per-cell instead of the longest line forcing the whole table to
         exceed the post width (which previously clipped "Theirs"). */
      '.gm-table { width: 100%; border-collapse: collapse; margin: 0; border: none; color: inherit; table-layout: fixed; }',
      '.gm-table th, .gm-table td { padding: 12px 14px; text-align: left; vertical-align: top; border: none; background: transparent; min-width: 0; }',
      '.gm-table tr:nth-child(even) { background: transparent; }',
      '.gm-table tbody tr { border-top: 1px solid var(--table-line); }',
      '.gm-table tbody tr:first-child { border-top: none; }',
      '.gm-table code { font-family: var(--font-mono); font-size: 0.86em; background: var(--paper-inset); border: 1px solid var(--line); color: var(--ink-primary); padding: 1px 6px; border-radius: 3px; }',
      '.gm-table strong { color: var(--ink-primary); font-weight: 500; }',
      '.gm-table em { color: var(--ink-primary); font-style: italic; }',
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
      '.gm .gm-table pre.role-code-block .line.hl { background: var(--coral-wash); margin: 0 -14px; padding: 0 14px; color: var(--ink-primary); }',

      /* Note callout */
      '.gm-note { background: var(--paper-raised); border: 1px solid var(--line); border-left: 3px solid var(--coral); border-radius: 4px; padding: 12px 16px; color: var(--ink-secondary); font-family: var(--font-text); font-size: var(--size-md); line-height: var(--lh-body); margin: 12px 0; }',
      '.gm-note + .gm-note { margin-top: 8px; }',

      /* Inline mono chip. */
      '.gm code, .gm-mono { font-family: var(--font-mono); font-size: 0.86em; background: var(--paper-inset); border: 1px solid var(--line); color: var(--ink-primary); padding: 1px 6px; border-radius: 3px; }',

      /* Block code listing. Uses .role-code-block from the design
         language for the surface (paper-inset background, line border,
         smd mono type), plus widget-local helpers for prompt-glyph /
         command / comment styling. Colours match the design-language
         siblings .role-code-prompt-glyph (coral) and .role-code-comment
         (sx-comment). */
      '.gm pre.role-code-block { margin: 0 0 16px; padding: 14px 16px; line-height: 1.7; overflow: auto; }',
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
      '.gm pre.role-code-block .gm-ours { background: var(--paper); margin: 0 -16px; padding: 0 16px; }',
      '.gm pre.role-code-block .gm-theirs { background: var(--coral-wash); margin: 0 -16px; padding: 0 16px; color: var(--ink-primary); }',
      '.gm-conflict-foot { color: var(--ink-muted); font-family: var(--font-text); font-size: var(--size-md); line-height: var(--lh-body); margin: 10px 0 0; }',
      /* Syntax helpers reusing the design language\'s sx-* tokens. */
      '.gm-kw { color: var(--sx-keyword); font-weight: 500; }',
      '.gm-str { color: var(--sx-string); }',

      /* Merge-commit variants (§04). Tabbed code block with a fixed
         min-height so the panel doesn\'t jump as the user switches tabs.
         The min-height is sized to the tallest variant\'s line count. */
      '.gm-commit-area { background: var(--paper); padding: 14px 16px; min-height: 270px; box-sizing: border-box; }',
      '.gm-commit-area pre { margin: 0; padding: 0; background: transparent; border: none; overflow-x: auto; }',
      '.gm-commit-area .line { display: block; }',
      '.gm-commit-area .gm-cmt { color: var(--sx-comment); font-style: italic; }',
      '.gm-commit-area .gm-key { color: var(--ink-faint); }',
      '.gm-commit-area .gm-add { color: var(--coral-strong); }',
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
      '.gm-toc-row:hover .role-toc-row { color: var(--ink-primary); }'
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
    var sameRow = Math.abs(y1 - y2) < 2;
    var d;
    if (sameRow) {
      d = 'M ' + (x1 + 16) + ' ' + y1 + ' L ' + (x2 - 16) + ' ' + y2;
    } else {
      var startOffset = (y2 > y1 ? 9 : -9);
      var endOffset   = (y2 > y1 ? -9 : 9);
      d = 'M ' + (x1 + 12) + ' ' + (y1 + startOffset) +
          ' C ' + (x1 + 30) + ' ' + y1 + ', ' + (x2 - 30) + ' ' + y2 +
          ', ' + (x2 - 12) + ' ' + (y2 + endOffset);
    }
    var dash = opts.dashed ? ' stroke-dasharray="4 4"' : '';
    var op   = opts.opacity != null ? ' stroke-opacity="' + opts.opacity + '"' : '';
    return '<path d="' + d + '" stroke="' + color + '" stroke-width="' + (opts.width || 1.5) + '" fill="none"' + dash + op + '/>';
  }

  function svgCommit(x, y, color, label, opts) {
    opts = opts || {};
    var ring = '';
    if (opts.merge) {
      ring = '<circle cx="' + x + '" cy="' + y + '" r="24" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="2 3" stroke-opacity="0.7"/>';
    }
    var inner = opts.merge
      ? '<circle cx="' + x + '" cy="' + y + '" r="16" fill="var(--paper-inset)" stroke="' + color + '" stroke-width="1.5"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="7" fill="' + color + '"/>'
      : '<circle cx="' + x + '" cy="' + y + '" r="16" fill="var(--paper-inset)" stroke="' + color + '" stroke-width="1.5"/>';
    var labelEl = label
      ? '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="14" font-weight="600" fill="' + color + '">' + label + '</text>'
      : '';
    var head = '';
    if (opts.head) {
      head =
        '<rect x="' + (x - 26) + '" y="' + (y - 50) + '" width="52" height="18" rx="3" fill="' + color + '"/>' +
        '<text x="' + x + '" y="' + (y - 37) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="13" font-weight="700" fill="var(--paper-raised)" letter-spacing="0.5">HEAD</text>';
    }
    var op = opts.dim ? ' opacity="0.35"' : '';
    return '<g' + op + '>' + ring + inner + labelEl + head + '</g>';
  }

  function svgBranchLabel(x, y, label, color) {
    return '<g>' +
      '<rect x="' + x + '" y="' + (y - 10) + '" width="60" height="20" rx="3" fill="var(--paper-raised)" stroke="' + color + '" stroke-width="1.5"/>' +
      '<text x="' + (x + 30) + '" y="' + (y + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="600" fill="' + color + '">' + label + '</text>' +
      '</g>';
  }

  function svgRing(x, y, r, color) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="3 3"/>';
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
      { num: 1, title: 'The Common Base' },
      { num: 2, title: 'Merge vs. Cherry-Pick' },
      { num: 3, title: 'How Conflicts Arise' },
      { num: 4, title: 'Inside a Merge Commit' },
      { num: 5, title: 'Merge Conventions' },
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

    ENTRIES.forEach(function (e, i) {
      var nn = String(e.num).padStart(2, '0');
      var pp = String(i + 2).padStart(2, '0');
      var row = document.createElement('a');
      row.className = 'role-toc-row gm-toc-row';
      row.href = '#sec-' + nn;
      row.style.cssText = 'display: flex; align-items: baseline; gap: 12px; text-decoration: none; padding: 6px 8px; border-radius: 6px; transition: background 0.15s, color 0.15s;';
      row.innerHTML =
        '<span class="role-toc-index">' + nn + '</span>' +
        '<span class="role-toc-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + e.title + '</span>' +
        '<span class="role-toc-leader" style="flex: 1; border-bottom: 1px dotted currentColor; transform: translateY(-3px); min-width: 24px;"></span>' +
        '<span class="role-toc-page">' + pp + '</span>';
      list.appendChild(row);
    });

    frame.appendChild(list);
    sec.appendChild(frame);
    root.appendChild(sec);

    // Click flash, mirroring mcp-exploration.js.
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
    sec.appendChild(sectionHeader(1, 'The Common Base'));

    sec.appendChild(el('p', 'gm-body',
      'When you branch off, both branches share history up to one commit: ' +
      'the <em>merge base</em>. Git uses this third point to perform a ' +
      '<strong>three-way merge</strong>, comparing each branch tip against ' +
      'the base to figure out what changed on each side.'));

    var mainY = 70, featY = 150;
    var xs = [60, 130, 200, 270, 340, 410];
    var svg =
      '<svg viewBox="0 0 480 220">' +
        svgEdge(xs[0], mainY, xs[1], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], mainY, INK) +
        svgEdge(xs[3], mainY, xs[4], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], featY, ACC) +
        svgEdge(xs[3], featY, xs[4], featY, ACC) +
        svgRing(xs[2], mainY, 33, ACC) +
        svgCaption(xs[2], mainY + 50, ACC, '← merge base') +
        svgCommit(xs[0], mainY, INK, 'a1') +
        svgCommit(xs[1], mainY, INK, 'b2') +
        svgCommit(xs[2], mainY, INK, 'c3') +
        svgCommit(xs[3], mainY, INK, 'd4') +
        svgCommit(xs[4], mainY, INK, 'e5', { head: true }) +
        svgCommit(xs[3], featY, ACC, 'f6') +
        svgCommit(xs[4], featY, ACC, 'g7') +
        svgBranchLabel(xs[4] + 28, mainY, 'main', INK) +
        svgBranchLabel(xs[4] + 28, featY, 'feature', ACC) +
      '</svg>';
    sec.appendChild(div('gm-frame', svg));

    sec.appendChild(div('gm-note',
      'Here, <code>c3</code> is the merge base of <code>main</code> ' +
      '(tip <code>e5</code>) and <code>feature</code> (tip <code>g7</code>). ' +
      'Git diffs <code>c3 → e5</code> and <code>c3 → g7</code> to determine ' +
      'each side\'s contribution.'));

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §02 -- Merge vs. cherry-pick (tabbed: visual + description)
  // ------------------------------------------------------------------
  function buildSection02(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(2, 'Merge vs. Cherry-Pick'));

    sec.appendChild(el('p', 'gm-body',
      'Both operations bring work from one branch to another, but the ' +
      '<em>shape of history</em> they leave behind is fundamentally different. ' +
      'Switch tabs to compare what each one records.'));

    var OPTIONS = [
      { id: 'merge', label: 'git merge feature',
        title: 'Merge: parallel work, joined',
        body:
          '<p>A merge commit (<code>M</code>) is recorded with <strong>two parents</strong>: ' +
          'the previous tip of <code>main</code> and the tip of <code>feature</code>. ' +
          'Both branches\' commits stay in history exactly as they were, and the ' +
          'relationship between the parallel streams is preserved.</p>' +
          '<p>Use this when the parallelism itself is meaningful, e.g. when a ' +
          'feature lands on a release branch and you want the merge to mark ' +
          'where it joined.</p>' },
      { id: 'cherry', label: 'git cherry-pick g7',
        title: 'Cherry-pick: one commit, replayed',
        body:
          '<p>The <em>diff</em> of <code>g7</code> is replayed on top of ' +
          '<code>main</code> as a brand-new commit (<code>g7\'</code>) with a ' +
          '<strong>new hash</strong>. There is no tie back to <code>feature</code>.</p>' +
          '<p>Use this when only one commit\'s worth of change is wanted, e.g. ' +
          'porting a fix to a maintenance branch. Be aware that if you later ' +
          'merge <code>feature</code>, Git may see the change a second time.</p>' }
    ];

    var active = 'merge';
    var panel = div('gm-panel');
    var tabsBar = div('mcp-tabs');
    panel.appendChild(tabsBar);
    var svgBg = div('gm-svg-bg');
    panel.appendChild(svgBg);
    var descArea = div('gm-arch-desc');
    panel.appendChild(descArea);

    var mainY = 80, featY = 170;
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
          svgEdge(xs[4], mainY, xs[5], mainY, ACC) +
          svgEdge(xs[4], featY, xs[5], mainY, ACC) +
          svgCommit(xs[5], mainY, ACC, 'M', { merge: true, head: true }) +
          svgBranchLabel(xs[5] + 36, mainY, 'main', INK) +
          svgBranchLabel(xs[4] + 28, featY, 'feature', ACC);
      } else {
        rest =
          svgEdge(xs[4], mainY, xs[5], mainY, ACC, { dashed: true }) +
          svgCommit(xs[5], mainY, ACC, "g7'", { head: true }) +
          svgBranchLabel(xs[5] + 28, mainY, 'main', INK) +
          svgBranchLabel(xs[4] + 28, featY, 'feature', ACC) +
          svgCaption(xs[5], mainY - 50, ACC, 'new commit, same diff');
      }
      svgBg.innerHTML = '<svg viewBox="0 0 540 240">' + trunk + rest + '</svg>';
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
    sec.appendChild(sectionHeader(3, 'How Conflicts Arise'));

    sec.appendChild(el('p', 'gm-body',
      'Git\'s three-way merge can auto-resolve <em>independent</em> changes: ' +
      'if you edited line 5 and the other side edited line 50, no problem. A ' +
      'conflict arises when both branches modify <strong>the same line</strong> ' +
      'differently, or when one side edits while the other deletes. Git cannot ' +
      'infer which intent to honour, so it stops and asks you.'));

    // Swift versions of greet, one cell per version. The conflicting
    // line (the one both sides modified differently) is wrapped in a
    // .line.hl span so the difference is visible at a glance. Each line
    // is its own block-display span, so the .hl line does not introduce
    // an extra newline (which it did when mixed with raw "\n" separators).
    function lineSwiftDecl() {
      return '<span class="line"><span class="gm-kw">func</span> greet(name: <span class="gm-kw">String</span>) -&gt; <span class="gm-kw">String</span> {</span>';
    }
    function lineColor(colour, hl) {
      return '<span class="line' + (hl ? ' hl' : '') + '">    <span class="gm-kw">let</span> color = <span class="gm-str">"' + colour + '"</span></span>';
    }
    function lineReturn(greeting) {
      return '<span class="line">    <span class="gm-kw">return</span> <span class="gm-str">"' + greeting + ', \\(name)!"</span></span>';
    }
    function lineClose() { return '<span class="line">}</span>'; }

    function swiftBody(colour, hl) {
      var greeting = (colour === 'green') ? 'Hi' : 'Hello';
      return lineSwiftDecl() + lineColor(colour, hl) + lineReturn(greeting) + lineClose();
    }

    var fileTable = div('gm-table-wrap');
    fileTable.innerHTML =
      '<div class="role-table-frame">' +
        '<table class="gm-table">' +
          '<thead>' +
            '<tr class="role-table-head">' +
              '<th class="role-table-head-cell">Merge Base ' +
                '<span class="gm-vershead-sub">(c3)</span></th>' +
              '<th class="role-table-head-cell">Ours ' +
                '<span class="gm-vershead-sub">(e5, main)</span></th>' +
              '<th class="role-table-head-cell">Theirs ' +
                '<span class="gm-vershead-sub">(g7, feature)</span></th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr>' +
              '<td><pre class="role-code-block">' + swiftBody('blue',  false) + '</pre></td>' +
              '<td><pre class="role-code-block">' + swiftBody('red',   true)  + '</pre></td>' +
              '<td><pre class="role-code-block">' + swiftBody('green', true)  + '</pre></td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    sec.appendChild(fileTable);

    // The "CONFLICT (content): …" line is not part of the file, so it
    // sits inside the code block as a Swift comment. Each line is a
    // block-display .line span; no raw "\n" is used, so the highlighted
    // ours/theirs lines do not introduce an extra blank line.
    var conflict = div('gm-conflict-wrap');
    conflict.innerHTML =
      '<pre class="role-code-block gm-conflict-block">' +
        '<span class="line gm-cmt">// CONFLICT (content): Merge conflict in greet.swift</span>' +
        '<span class="line"><span class="gm-kw">func</span> greet(name: <span class="gm-kw">String</span>) -&gt; <span class="gm-kw">String</span> {</span>' +
        '<span class="line gm-cm">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD (main)</span>' +
        '<span class="line gm-ours">    <span class="gm-kw">let</span> color = <span class="gm-str">"red"</span></span>' +
        '<span class="line gm-cm">=======</span>' +
        '<span class="line gm-theirs">    <span class="gm-kw">let</span> color = <span class="gm-str">"green"</span></span>' +
        '<span class="line gm-cm">&gt;&gt;&gt;&gt;&gt;&gt;&gt; feature</span>' +
        '<span class="line">    <span class="gm-kw">return</span> <span class="gm-str">"Hi, \\(name)!"</span></span>' +
        '<span class="line">}</span>' +
      '</pre>' +
      '<p class="gm-conflict-foot">' +
        'Note: line 3 is not conflicted. Only <code>main</code> is unchanged ' +
        'from base, and only <code>feature</code> changed <code>"Hello"</code> ' +
        '→ <code>"Hi"</code>, so Git takes <code>feature</code>\'s version ' +
        'automatically. The conflict is purely on line 2.' +
      '</p>';
    sec.appendChild(conflict);

    sec.appendChild(div('gm-note',
      'You resolve the conflict by editing the file (picking, combining, or ' +
      'rewriting), staging it with <code>git add</code>, and committing. ' +
      '<em>That commit</em> is the merge commit.'));

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §04 -- Inside a merge commit + scenarios (tabbed)
  // ------------------------------------------------------------------
  function buildSection04(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(4, 'Inside a Merge Commit'));

    sec.appendChild(el('p', 'gm-body',
      'A merge commit is a <strong>regular commit with two (or more) parent ' +
      'pointers</strong>. Its tree is whatever the working directory looked ' +
      'like when you ran <code>git commit</code> after resolving, which means ' +
      '<strong>the merge commit\'s contents include your conflict resolution</strong>. ' +
      'If there were no conflicts, the merge commit is often empty in terms of ' +
      '"new" content; it just records that two histories joined.'));

    // Three variants of a merge commit, shown as a tab group. The
    // viewing area uses a fixed min-height sized to the tallest variant,
    // so the panel does not jump as the user switches tabs.
    function L(html, cls) {
      return '<span class="line' + (cls ? ' ' + cls : '') + '">' + html + '</span>';
    }
    var COMMIT_VARIANTS = [
      { id: 'conflict', label: 'With Conflict Resolution',
        lines: [
          L('<span class="gm-msg">commit</span> 9f2a8c1d4b… <span class="gm-key">(HEAD → main)</span>'),
          L('<span class="gm-key">Merge:</span> 3e1b7a2 c8d4f0a   <span class="gm-cmt">// two parents</span>'),
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
          L('<span class="gm-key">Merge:</span> 3e1b7a2 c8d4f0a   <span class="gm-cmt">// two parents</span>'),
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
          L('<span class="gm-key">Merge:</span> 3e1b7a2 c8d4f0a a1b2c3d   <span class="gm-cmt">// three parents</span>'),
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
    commitPanel.style.margin = '0 0 16px';
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
            '<th class="role-table-head-cell" style="width:30%">Field</th>' +
            '<th class="role-table-head-cell">What it holds</th>' +
          '</tr></thead>' +
          '<tbody>' +
            '<tr><td class="role-table-cell"><strong>Two parents</strong></td>' +
            '<td class="role-table-cell">First parent is the branch you were on ' +
              '(<code>main</code>); second is the branch you merged in ' +
              '(<code>feature</code>). This ordering is why <code>HEAD^1</code> ' +
              'and <code>HEAD^2</code> work the way they do.</td></tr>' +
            '<tr><td class="role-table-cell"><strong>Tree (snapshot)</strong></td>' +
            '<td class="role-table-cell">The full state of all files post-resolution. ' +
              'If conflicts existed, your hand-edited file is what is stored: ' +
              '<em>not</em> a "diff of diffs", but a complete snapshot like any ' +
              'other commit.</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    sec.appendChild(anatomy);

    sec.appendChild(el('p', 'gm-body',
      'Most of the time you can ignore a merge commit\'s special structure ' +
      'and let it sit there. The shape only matters when an operation has to ' +
      'choose <em>which</em> parent to follow, or has to decide what to do ' +
      'when a merge appears inside a range. The four common scenarios:'));

    var SCENARIOS = [
      { id: 'revert',  label: 'Revert',      title: 'Reverting a merge',
        body:
          '<p>A plain <code>git revert &lt;merge-sha&gt;</code> fails, because ' +
          'Git cannot tell which side of the merge to revert. Pass ' +
          '<code>-m</code> to choose the parent that represents the line of ' +
          'history you want to keep:</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git revert -m 1 9f2a8c1</span>\n' +
          '<span class="cmt"># -m 1: keep main (first parent); undo feature\'s changes</span></pre>' +
          '<p>The new commit subtracts <code>feature</code>\'s contribution ' +
          'while leaving the merge itself in history. Be careful: re-merging ' +
          '<code>feature</code> later will not bring those changes back, ' +
          'because Git still sees them as already merged. You typically have ' +
          'to revert the revert.</p>' },
      { id: 'cherry',  label: 'Cherry-pick', title: 'Cherry-picking a merge',
        body:
          '<p>By default <code>git cherry-pick</code> refuses a merge commit ' +
          'for the same reason: which parent\'s diff should it replay? ' +
          '<code>-m</code> selects the mainline parent, and the cherry-pick ' +
          'becomes "everything that was added relative to that parent":</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git cherry-pick -m 1 9f2a8c1</span></pre>' +
          '<p>This is occasionally useful for porting a feature-bundle to ' +
          'another long-lived branch, but the result is a single ' +
          'squashed-feeling commit, not a faithful replay of the individual ' +
          'feature work.</p>' },
      { id: 'squash',  label: 'Squash',      title: 'Squashing across a merge commit',
        body:
          '<p>Interactive rebase (<code>git rebase -i</code>) flattens history ' +
          'by walking commits one parent at a time. By default, when it hits ' +
          'a merge commit it <em>drops</em> the merge entirely and replays ' +
          'only the first-parent line: any commits brought in by the merge\'s ' +
          'second parent vanish. This bites the unwary when a quick squash on ' +
          'top of a freshly-merged feature appears to lose work.</p>' +
          '<p>If you genuinely need to preserve the merge structure while ' +
          'rewriting, use <code>--rebase-merges</code>:</p>' +
          '<pre class="role-code-block"><span class="prompt">$</span> ' +
          '<span class="cmd">git rebase -i --rebase-merges main</span>\n' +
          '<span class="cmt"># merges become "label" / "merge" directives in the todo list</span></pre>' +
          '<p>If the goal is the opposite (collapse a feature plus its merge ' +
          'into a single tidy commit on top of <code>main</code>), it is ' +
          'almost always cleaner to <em>not</em> have made the merge in the ' +
          'first place: run <code>git merge --squash feature</code>, which ' +
          'stages the feature\'s combined diff without recording a merge ' +
          'commit, then commit normally.</p>' },
      { id: 'history', label: 'Read history', title: 'Reading history past a merge',
        body:
          '<p>Two flags make merges legible after the fact. ' +
          '<code>git log --first-parent</code> follows only the mainline, ' +
          'producing a "headline" history where each feature appears as a ' +
          'single merge entry rather than the full sequence of feature ' +
          'commits.</p>' +
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
    var sDesc = div('gm-arch-desc');
    sPanel.appendChild(sTabs);
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
      sDesc.innerHTML = '<h3>' + s.title + '</h3>' + s.body;
    }
    renderScenarios();
    sec.appendChild(sPanel);

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §05 -- "Merge X into Y"
  // ------------------------------------------------------------------
  function buildSection05(root) {
    var sec = el('section', 'gm-section');
    sec.appendChild(sectionHeader(5, 'Merge Conventions'));

    sec.appendChild(el('p', 'gm-body',
      'The convention is <strong>"merge X into Y"</strong>, where ' +
      '<strong>Y is your current branch (HEAD)</strong> and X is the branch ' +
      'named in the command. So if you run:'));

    sec.appendChild(el('pre', 'role-code-block',
      '<span class="prompt">$</span> <span class="cmd">git checkout main</span>\n' +
      '<span class="prompt">$</span> <span class="cmd">git merge feature</span>\n' +
      '<span class="cmt"># merge feature INTO main</span>'));

    var mainY = 75, featY = 165;
    var xs = [60, 140, 220, 300, 380];
    var svg =
      '<svg viewBox="0 0 480 230">' +
        svgEdge(xs[0], mainY, xs[1], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], mainY, INK) +
        svgEdge(xs[2], mainY, xs[3], mainY, INK) +
        svgEdge(xs[1], mainY, xs[2], featY, ACC) +
        svgEdge(xs[2], featY, xs[3], featY, ACC) +
        svgEdge(xs[3], mainY, xs[4], mainY, ACC) +
        svgEdge(xs[3], featY, xs[4], mainY, ACC) +
        svgCommit(xs[0], mainY, INK, 'a1') +
        svgCommit(xs[1], mainY, INK, 'b2') +
        svgCommit(xs[2], mainY, INK, 'c3') +
        svgCommit(xs[3], mainY, INK, 'd4') +
        svgCommit(xs[2], featY, ACC, 'f6') +
        svgCommit(xs[3], featY, ACC, 'g7') +
        svgCommit(xs[4], mainY, ACC, 'M', { merge: true, head: true }) +
        svgBranchLabel(xs[4] + 36, mainY, 'main', INK) +
        svgBranchLabel(xs[3] + 28, featY, 'feature', ACC) +
      '</svg>';
    sec.appendChild(div('gm-frame', svg));

    var keys = el('ul', 'gm-keys');
    keys.innerHTML =
      '<li><code>main</code> moves forward: it now points to the new merge ' +
        'commit M.</li>' +
      '<li><code>feature</code> stays put: its tip is still <code>g7</code>. ' +
        'It has been "absorbed", but not consumed.</li>' +
      '<li><code>HEAD</code> follows <code>main</code>: you were on ' +
        '<code>main</code> when you merged, so <code>HEAD</code> moves to ' +
        'M with <code>main</code>.</li>';
    sec.appendChild(keys);

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
          '<p><code>main</code> has moved on to <code>e5</code>; ' +
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
          'unreachable (Git\'s reflog still has them for ~90 days).</p>' +
          '<p>History is linear; the parallelism that did happen is erased.</p>' }
    ];

    var rActive = 'before';
    var panel = div('gm-panel');
    var tabs = div('mcp-tabs');
    panel.appendChild(tabs);
    var svgBg = div('gm-svg-bg');
    panel.appendChild(svgBg);
    var desc = div('gm-arch-desc');
    panel.appendChild(desc);

    var mainY = 80, featY = 170;
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
          svgCommit(xs[4], featY, ACC, 'g7', { head: true }) +
          svgBranchLabel(xs[4] + 28, mainY, 'main', INK) +
          svgBranchLabel(xs[4] + 28, featY, 'feature', ACC);
      } else {
        rest =
          svgEdge(xs[4], mainY, xs[5], mainY, ACC) +
          svgEdge(xs[5], mainY, xs[6], mainY, ACC) +
          svgCommit(xs[5], mainY, ACC, "f6'") +
          svgCommit(xs[6], mainY, ACC, "g7'", { head: true }) +
          svgBranchLabel(xs[4] + 28, mainY + 35, 'main', INK) +
          svgBranchLabel(xs[6] + 28, mainY, 'feature', ACC);
      }
      svgBg.innerHTML = '<svg viewBox="0 0 560 240">' + trunk + rest + '</svg>';
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
      'rebase mid-flight and asks you to resolve. The resolution is identical ' +
      'to a merge conflict, but applied <em>one commit at a time</em> and ' +
      'continued with <code>git rebase --continue</code>.'));

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

    var rcMainY = 80;
    var rcXs = [50, 120, 190, 260, 330, 400, 470];

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

      // Both states share a "main" label below e5 (the rebase target);
      // the right-most position carries either the conflict ring or the
      // resolved g7' with the feature label.
      var mainLabel = svgBranchLabel(rcXs[4] - 5, rcMainY + 35, 'main', INK);

      var rest;
      if (rcActive === 'paused') {
        // g7 is paused mid-replay: drawn dashed and ringed in coral-strong.
        rest = mainLabel +
          svgEdge(rcXs[5], rcMainY, rcXs[6], rcMainY, ACC, { dashed: true, opacity: 0.6 }) +
          '<circle cx="' + rcXs[6] + '" cy="' + rcMainY + '" r="33" fill="none" stroke="var(--coral-strong)" stroke-width="1.5" stroke-dasharray="3 3"/>' +
          svgCommit(rcXs[6], rcMainY, ACC, 'g7', { dim: true }) +
          '<text x="' + rcXs[6] + '" y="' + (rcMainY + 50) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--coral-strong)">⚠ paused</text>' +
          svgBranchLabel(rcXs[6] + 44, rcMainY, 'feature', ACC);
      } else {
        rest = mainLabel +
          svgEdge(rcXs[5], rcMainY, rcXs[6], rcMainY, ACC) +
          svgCommit(rcXs[6], rcMainY, ACC, "g7'", { head: true }) +
          svgBranchLabel(rcXs[6] + 28, rcMainY, 'feature', ACC);
      }
      rcSvgBg.innerHTML = '<svg viewBox="0 0 580 220">' + trunk + rest + '</svg>';
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
          '<p>Edit the file to choose a single value, stage it, and continue. ' +
          'Git records the resolved patch as <code>g7\'</code> and the ' +
          'history is now linear.</p>' +
          resolvedFile;
      }
      renderRcSvg();
    }
    renderRc();
    sec.appendChild(rcPanel);

    sec.appendChild(el('p', 'gm-body',
      '<strong>Interactive rebase</strong> (<code>git rebase -i &lt;base&gt;</code>) ' +
      'turns the same machinery into an editing surface: each commit in the ' +
      'replay window appears in a todo list, and you can <code>pick</code>, ' +
      '<code>reword</code>, <code>squash</code>, <code>fixup</code>, ' +
      '<code>edit</code>, <code>drop</code>, or reorder them. It is the usual ' +
      'way to clean up a feature\'s history before sharing.'));

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
    buildSection01(root);
    buildSection02(root);
    buildSection03(root);
    buildSection04(root);
    buildSection05(root);
    buildSection06(root);
  };

})();
