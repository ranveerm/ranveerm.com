// Model Context Protocol exploration widget.
// Vanilla JS. Renders nine interactive sections covering MCP architecture,
// primitives, prompt flow, configuration, and multi-server composition.
//
// Usage:  <div id="mcp-demo"></div>
//         <script>createMCPExploration('mcp-demo');</script>

(function () {

  // ------------------------------------------------------------------
  // Styles live in _sass/_theme.scss. Class names map mcp-foo -> role-foo-bar.
  // See the "Widget specifics: MCP" section there for the small set of rules
  // that remain page-scoped (SVG selectors, the .mcp-section margin, etc.).
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function div(cls, html) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  function sectionHeader(num, kicker, title) {
    var wrap = div('');
    var id = 'sec-' + String(num).padStart(2, '0');
    wrap.innerHTML =
      '<div class="role-viz-section-eyebrow" id="' + id + '">' +
        '<span class="role-post-section-index">' + String(num).padStart(2, '0') + '</span>' +
        '<div class="role-post-section-rule"></div>' +
        '<span class="role-post-section-name">' + kicker + '</span>' +
      '</div>' +
      '<h2 class="role-viz-section-heading">' + title + '</h2>';
    return wrap;
  }

  // ------------------------------------------------------------------
  // Typewriter animation for any existing .mcp-typed-text element
  // (the prompt block is rendered by the post markdown above the body
  // paragraph, so the widget only animates it).
  // ------------------------------------------------------------------
  function startTypewriter() {
    var el = document.querySelector('.mcp-typed-text');
    if (!el) return;
    var target = 'what is the model context protocol, really?';
    var typed = 0;
    var timer = setInterval(function () {
      if (typed <= target.length) { el.textContent = target.slice(0, typed++); }
      else { clearInterval(timer); }
    }, 35);
  }

  // ------------------------------------------------------------------
  // Table of contents
  // ------------------------------------------------------------------
  function buildTOC(root) {
    var ENTRIES = [
      { num: 1,  title: 'The integration problem MCP exists to solve' },
      { num: 2,  title: 'When should you deploy MCP?' },
      { num: 3,  title: 'Host, Client and Server' },
      { num: 4,  title: 'MCP Primitives' },
      { num: 5,  title: 'MCP vs. Claude’s native tool use API' },
      { num: 6,  title: '“Convert the typeface on my landing page”' },
      { num: 7,  title: 'How a server is configured and launched' },
      { num: 8,  title: 'Many servers, one conversation' },
      { num: 9,  title: 'Same server. Same protocol. Any host' },
      { num: 10, title: 'What you now have a model of' }
    ];

    var sec = div('mcp-section');
    sec.style.paddingTop = '8px';

    var frame = div('role-toc-frame mcp-toc');
    frame.style.cssText = 'padding: 18px 22px;';

    var label = div('role-toc-label');
    label.textContent = 'Contents';
    label.style.marginBottom = '12px';
    frame.appendChild(label);

    var list = div('mcp-toc-list');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    ENTRIES.forEach(function (e, i) {
      var nn = String(e.num).padStart(2, '0');
      var pp = String(i + 2).padStart(2, '0');
      var row = document.createElement('a');
      row.className = 'role-toc-row role-toc-row';
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

    // Click flash: temporarily apply role-toc-row-flash, then revert.
    list.querySelectorAll('.role-toc-row').forEach(function (row) {
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
  // §01 The Problem, M×N toggle with SVG
  // ------------------------------------------------------------------
  function buildProblem(root) {
    var APPS  = [{ name: 'Claude Code' }, { name: 'Cursor' }, { name: 'VS Code' }, { name: 'Zed' }];
    var TOOLS = [{ name: 'GitHub' }, { name: 'Postgres' }, { name: 'Slack' }, { name: 'Filesystem' }];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(1, 'The motivation', 'The integration problem MCP exists to solve'));

    // ─────── Top visualisation: topology toggle (Without / With MCP) ───────
    var topPanel = div('role-panel-frame');
    var withMCP = false;

    var toggleBar = div('role-tab-bar');
    var btn1 = document.createElement('button');
    btn1.className = 'role-tab active';
    btn1.innerHTML = 'Without MCP &nbsp;<code class="inline">M × N integrations</code>';
    var btn2 = document.createElement('button');
    btn2.className = 'role-tab';
    btn2.innerHTML = 'With MCP &nbsp;<code class="inline">M + N integrations</code>';
    toggleBar.appendChild(btn1);
    toggleBar.appendChild(btn2);
    topPanel.appendChild(toggleBar);

    var W = 720, H = 340, padX = 80;
    var aPos = APPS.map(function (_, i)  { return { x: padX,     y: 55 + i * 75 }; });
    var tPos = TOOLS.map(function (_, i) { return { x: W - padX, y: 55 + i * 75 }; });
    var hub  = { x: W / 2, y: H / 2 };

    function makeSVG() {
      var lines = '';
      if (!withMCP) {
        aPos.forEach(function (a) {
          tPos.forEach(function (t) {
            lines += '<line x1="' + (a.x + 50) + '" y1="' + a.y + '" x2="' + (t.x - 50) + '" y2="' + t.y + '" stroke="var(--ink-faint)" stroke-width="1" stroke-opacity="0.5"/>';
          });
        });
      } else {
        aPos.forEach(function (a) {
          lines += '<line x1="' + (a.x + 50) + '" y1="' + a.y + '" x2="' + (hub.x - 50) + '" y2="' + hub.y + '" stroke="var(--coral)" stroke-width="1.5" stroke-opacity="0.8"/>';
        });
        tPos.forEach(function (t) {
          lines += '<line x1="' + (hub.x + 50) + '" y1="' + hub.y + '" x2="' + (t.x - 50) + '" y2="' + t.y + '" stroke="var(--coral)" stroke-width="1.5" stroke-opacity="0.8"/>';
        });
        lines += '<rect x="' + (hub.x - 50) + '" y="' + (hub.y - 26) + '" width="100" height="52" rx="4" fill="var(--paper-inset)" stroke="var(--coral)" stroke-width="1.5"/>';
        lines += '<text x="' + hub.x + '" y="' + (hub.y + 6) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="13" font-weight="600" fill="var(--coral)">MCP</text>';
      }

      var apps = APPS.map(function (app, i) {
        return '<g><rect x="' + (aPos[i].x - 50) + '" y="' + (aPos[i].y - 18) + '" width="100" height="36" rx="3" fill="var(--paper-inset)" stroke="var(--line)"/>' +
          '<text x="' + aPos[i].x + '" y="' + (aPos[i].y + 5) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)">' + app.name + '</text></g>';
      }).join('');

      var tools = TOOLS.map(function (tool, i) {
        return '<g><rect x="' + (tPos[i].x - 50) + '" y="' + (tPos[i].y - 18) + '" width="100" height="36" rx="3" fill="var(--paper-inset)" stroke="var(--line)"/>' +
          '<text x="' + tPos[i].x + '" y="' + (tPos[i].y + 5) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)">' + tool.name + '</text></g>';
      }).join('');

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-height:360px">' +
        lines + apps + tools +
        '<text x="' + (padX - 5) + '" y="28" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="2">M  HOSTS</text>' +
        '<text x="' + (W - padX - 40) + '" y="28" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="2">N  SYSTEMS</text>' +
        '</svg>';
    }

    var svgWrap = div('');
    svgWrap.style.padding = '18px 20px';
    var svgCont = div('');
    svgCont.innerHTML = makeSVG();
    svgWrap.appendChild(svgCont);
    topPanel.appendChild(svgWrap);
    sec.appendChild(topPanel);

    function setMCP(val) {
      withMCP = val;
      btn1.className = 'role-tab' + (val ? '' : ' active');
      btn2.className = 'role-tab' + (val ? ' active' : '');
      svgCont.innerHTML = makeSVG();
    }
    btn1.onclick = function () { setMCP(false); };
    btn2.onclick = function () { setMCP(true); };

    // ─────── Body paragraph ───────
    var body = div('role-post-body');
    body.style.marginTop = '24px';
    body.innerHTML = 'Any LLM application that aspires to be useful needs access to context (files, services, APIs, and so on). In the absence of a shared standard, each application is more or less obliged to build bespoke integrations against every system it wishes to interact with. This is, at its core, an <code class="inline">M × N</code> problem. A common protocol changes its shape fundamentally: each side implements the protocol once and benefits from every other implementation that adopts it.';
    sec.appendChild(body);

    // ─────── Bottom visualisation: M & N sliders showing M×N vs M+N ───────
    var bottomPanel = div('role-panel-frame');
    bottomPanel.style.padding = '20px 22px';

    var sliderM = 4, sliderN = 4, sliderMin = 1, sliderMax = 20;

    function makeSliderRow(labelText, getVal, setVal, onChange) {
      var row = div('');
      row.style.cssText = 'display:grid;grid-template-columns:140px 1fr 40px;align-items:center;gap:14px;margin-bottom:14px';

      // Slider row eyebrow: role-meta-label recipe with an ink-muted override
      // (the role default is ink-faint; slider labels read a touch heavier).
      var label = div('role-meta-label');
      label.style.color = 'var(--ink-muted)';
      label.textContent = labelText;
      row.appendChild(label);

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = sliderMin;
      slider.max = sliderMax;
      slider.value = getVal();
      slider.style.cssText = 'width:100%;accent-color:var(--ink-muted)';
      slider.addEventListener('input', function () {
        setVal(parseInt(slider.value, 10));
        onChange();
      });
      row.appendChild(slider);

      var val = div('');
      val.style.cssText = 'font-family:var(--font-mono);font-size:var(--size-md);font-weight:500;text-align:right;color:var(--ink-secondary);font-variant-numeric:tabular-nums';
      val.textContent = getVal();
      row.appendChild(val);

      return { el: row, slider: slider, val: val };
    }

    // Comparison readout: two big numbers side by side with proportional bars
    var readout = div('');
    readout.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px';

    function makeReadoutCell(labelText, color) {
      var cell = div('');
      cell.style.cssText = 'padding:14px 16px;background:var(--paper-inset);border:1px solid var(--line);border-radius:8px;display:flex;flex-direction:column;gap:8px';
      // Readout cell eyebrow: role-meta-label recipe + ink-muted override
      // (slightly heavier than the role default ink-faint).
      var lbl = div('role-meta-label');
      lbl.style.color = 'var(--ink-muted)';
      lbl.textContent = labelText;
      cell.appendChild(lbl);
      var num = div('');
      num.style.cssText = 'font-family:var(--font-display);font-size:32px;font-weight:400;color:' + color + ';font-variant-numeric:tabular-nums;line-height:1';
      cell.appendChild(num);
      var bar = div('');
      bar.style.cssText = 'height:6px;background:var(--paper);border-radius:999px;overflow:hidden;margin-top:4px';
      var fill = div('');
      fill.style.cssText = 'height:100%;background:' + color + ';border-radius:999px;transition:width 0.18s ease';
      bar.appendChild(fill);
      cell.appendChild(bar);
      return { cell: cell, num: num, fill: fill };
    }

    var withoutCell = makeReadoutCell('M × N', 'var(--ink-muted)');
    var withCell    = makeReadoutCell('M + N', 'var(--coral)');
    readout.appendChild(withoutCell.cell);
    readout.appendChild(withCell.cell);

    function updateReadout() {
      var without = sliderM * sliderN;
      var withh   = sliderM + sliderN;
      var max = Math.max(without, withh, 1);
      withoutCell.num.textContent  = without;
      withCell.num.textContent     = withh;
      withoutCell.fill.style.width = (without / max * 100).toFixed(1) + '%';
      withCell.fill.style.width    = (withh   / max * 100).toFixed(1) + '%';
    }

    var rowM = makeSliderRow('Hosts (M)',   function () { return sliderM; }, function (v) { sliderM = v; }, function () { rowM.val.textContent = sliderM; updateReadout(); });
    var rowN = makeSliderRow('Systems (N)', function () { return sliderN; }, function (v) { sliderN = v; }, function () { rowN.val.textContent = sliderN; updateReadout(); });

    bottomPanel.appendChild(readout);
    bottomPanel.appendChild(rowM.el);
    bottomPanel.appendChild(rowN.el);

    sec.appendChild(bottomPanel);
    root.appendChild(sec);

    updateReadout();
  }

  // ------------------------------------------------------------------
  // §02 When to use MCP
  // ------------------------------------------------------------------
  function buildWhenToUseMCP(root) {
    var SIGNALS = [
      {
        label: 'Client-agnostic capability',
        body: 'MCP is worth reaching for when you want the integration to work regardless of what the host can do natively. A server that owns its own process runs its tools without depending on the host having shell access, a particular runtime, or any specific built-in capability. The host just needs to speak the protocol.'
      },
      {
        label: 'Server-owned auth and process lifetime',
        body: 'When the integration involves credentials or a long-lived connection, keeping those concerns inside the server is the cleaner arrangement. The server manages the OAuth flow or the open socket; the host stays unaware of the details and simply calls tools through the MCP boundary.'
      }
    ];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(2, 'The decision', 'When should you deploy MCP?'));

    var intro = div('role-post-body');
    intro.innerHTML = "The M+N argument is the canonical motivation, but it isn’t the only one worth internalising. There are two more specific signals that suggest MCP is the right layer to reach for.";
    sec.appendChild(intro);

    var panel = div('role-panel-frame');

    SIGNALS.forEach(function (s, i) {
      var row = div('');
      row.style.cssText = 'padding: 20px 22px;' + (i > 0 ? 'border-top: 1px solid var(--line);' : '');

      // Signal header reuses the canonical post.section-index +
      // post.section-name pattern from upstream Design Language v3, so
      // signals read as numbered sub-sections of the parent section. No
      // locally-invented eyebrow role required.
      var header = div('');
      header.style.cssText = 'display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px;';
      var idx  = document.createElement('span');
      idx.className = 'role-post-section-index';
      idx.textContent = String(i + 1).padStart(2, '0');
      var name = document.createElement('span');
      name.className = 'role-post-section-name';
      name.textContent = s.label;
      header.appendChild(idx);
      header.appendChild(name);
      row.appendChild(header);

      var bodyEl = div('role-system-secondary');
      bodyEl.textContent = s.body;
      row.appendChild(bodyEl);

      panel.appendChild(row);
    });

    sec.appendChild(panel);
    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §03 Architecture, clickable SVG
  // ------------------------------------------------------------------
  function buildArchitecture(root) {
    var NODES = [
      { id: 'host',   label: 'Host',   sub: 'the LLM application', color: 'var(--coral)', colorLit: '#C96442',
        examples: 'Claude Code · Cursor · Claude Desktop · VS Code',
        description: 'The application the user is actually working in. It is the only component that talks directly to the LLM (sending prompts and receiving completions), keeps track of the running conversation, and reads its config to decide which MCP servers to spawn or connect to. For every connected server, the host instantiates one client.' },
      { id: 'client', label: 'Client', sub: '1:1 connection',       color: 'var(--coral)', colorLit: '#C96442',
        examples: 'spawned per server, lives inside the host',
        description: 'An in-process object inside the host, one per connected server, that holds the open session with that server. It walks through the JSON-RPC handshake, sends requests over the configured transport (stdio or HTTP), parses the replies coming back, and surfaces the server’s capabilities to the host.' },
      { id: 'server', label: 'Server', sub: 'the integration',      color: 'var(--coral)', colorLit: '#C96442',
        examples: 'filesystem · github · postgres · slack · custom',
        description: "A standalone process that exposes capabilities (tools, resources, prompts) over MCP. It owns the connection to the actual external system and is agnostic to the client it is communicating with." },
    ];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(3, 'The architecture', 'Host, Client and Server'));

    var body = div('role-post-body');
    body.innerHTML = 'MCP defines 3 components: host, client and server. Unlike the client-server model, the <code class="inline">client</code> isn’t the user-facing application. Each client is, more or less, a single open phone line to one server- an in-process object inside the host that holds the JSON-RPC session for that one connection. A host with three servers configured ends up with three of these lines open simultaneously.';
    sec.appendChild(body);

    var panel = div('role-panel-frame');
    var active = 'host';

    // Component selector tabs, sit at the very top of the panel so the
    // user can pick host / client / server without scrolling past the
    // visualisation first.
    var btnsBar = div('role-tab-bar');
    panel.appendChild(btnsBar);

    var svgBg = div('');
    svgBg.style.cssText = 'padding:20px 18px 12px;background:var(--paper-inset)';

    function makeSVG() {
      // Selection-driven stroke styling. Inactive components use the
      // same grey line treatment as the connection lines (ink-faint @
      // opacity 0.5, no dash); the selected one switches to coral.
      var hostStroke = active === 'host'
        ? 'stroke="var(--coral)" stroke-width="2"'
        : 'stroke="var(--ink-faint)" stroke-opacity="0.5" stroke-width="1"';
      var cliC   = active === 'client' ? 'var(--coral)' : 'var(--line)';
      var srvC   = active === 'server' ? 'var(--coral)' : 'var(--line)';

      // Layout: User | Host (LLM + clients) | Servers | External systems.
      // Every text-bearing box is the same 100x40 footprint; the host
      // rectangle is the only outlier because it is a container.
      var bw = 100, bh = 40;
      // Row 3 sits further from row 2 than row 2 from row 1 to leave
      // room between the Local and Remote groupings on the right.
      var rowYs    = [61, 116, 211];
      var rowTops  = rowYs.map(function (y) { return y - bh / 2; }); // [41, 96, 191]

      var userX   = 14;
      var llmX    = 160;
      var clientX = 320;
      var serverLeft = 530;
      var extLeft = 680;
      var hostX   = 142, hostY = 17, hostW_ = 318, hostH_ = 238;
      var pbX     = 495;
      var rowY = rowYs[1];
      var topY = rowTops[1];

      var userRight   = userX + bw;
      var llmLeft     = llmX;
      var llmRight    = llmX + bw;
      var clientLeft  = clientX;
      var clientRight = clientX + bw;
      var serverRight = serverLeft + bw;
      var extLabels = ['Disk', 'GitHub API', 'Postgres DB'];

      // User on the far left. The standard "head + shoulders" glyph
      // (Lucide-style) replaces the textual label.
      var userIconX = userX + (bw - 24) / 2;
      var userIconY = topY + (bh - 24) / 2;
      var userBox =
        '<rect class="role-viz-graphic-node" x="' + userX + '" y="' + topY + '" width="' + bw + '" height="' + bh + '" rx="3"/>' +
        '<g stroke="var(--ink-secondary)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(' + userIconX + ' ' + userIconY + ')">' +
          '<circle cx="12" cy="9" r="4"/>' +
          '<path d="M 4 21 v -2 a 4 4 0 0 1 4 -4 h 8 a 4 4 0 0 1 4 4 v 2"/>' +
        '</g>';
      var userToLlm =
        '<line x1="' + userRight + '" y1="' + rowY + '" x2="' + llmLeft + '" y2="' + rowY + '" stroke="var(--ink-faint)" stroke-width="1" stroke-opacity="0.5"/>';

      var clients = [0,1,2].map(function (_, i) {
        var top = rowTops[i];
        return '<g class="mcp-svg-client" style="cursor:pointer">' +
          '<rect x="' + clientX + '" y="' + top + '" width="' + bw + '" height="' + bh + '" rx="3" fill="var(--paper-raised)" stroke="' + cliC + '" stroke-width="' + (active === 'client' ? '1.5' : '1') + '"/>' +
          '<text x="' + (clientX + bw / 2) + '" y="' + (rowYs[i] + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)" style="cursor:pointer">Client</text>' +
          '</g>';
      }).join('');

      // LLM (centre-left of host) fans out to the three clients.
      var llmToClients = rowYs.map(function (y) {
        return '<line x1="' + llmRight + '" y1="' + rowY + '" x2="' + clientLeft + '" y2="' + y + '" stroke="var(--ink-faint)" stroke-width="1" stroke-opacity="0.5"/>';
      }).join('');

      // Each client → corresponding server. Same neutral grey line as
      // LLM → client; subdued regardless of selection.
      var clientsToServers = rowYs.map(function (y) {
        return '<line x1="' + clientRight + '" y1="' + y + '" x2="' + serverLeft + '" y2="' + y + '" stroke="var(--ink-faint)" stroke-width="1" stroke-opacity="0.5"/>';
      }).join('');

      // Local / Remote groupings (dashed). Local wraps the two
      // server+external pairs reached via local stdio; Remote wraps
      // the postgres server together with its DB, expressing that they
      // live on a remote machine.
      var groupStroke = 'stroke="var(--ink-faint)" stroke-opacity="0.5" stroke-dasharray="4 4" stroke-width="1"';
      var localX = serverLeft - 12;
      var localY = rowTops[0] - 12;
      var localW = (extLeft + bw) - serverLeft + 24;
      var localH = (rowTops[1] + bh) - rowTops[0] + 24;
      var remoteX = serverLeft - 12;
      var remoteY = rowTops[2] - 12;
      var remoteW = localW;
      var remoteH = bh + 24;
      var groupBoxes =
        '<rect x="' + localX + '" y="' + localY + '" width="' + localW + '" height="' + localH + '" rx="6" fill="none" ' + groupStroke + '/>' +
        '<text x="' + (localX + 8) + '" y="' + (localY - 6) + '" text-anchor="start" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="1.5">LOCAL</text>' +
        '<rect x="' + remoteX + '" y="' + remoteY + '" width="' + remoteW + '" height="' + remoteH + '" rx="6" fill="none" ' + groupStroke + '/>' +
        '<text x="' + (remoteX + 8) + '" y="' + (remoteY + remoteH + 13) + '" text-anchor="start" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="1.5">REMOTE</text>';

      // External Systems box (solid, host-style stroke). Centred
      // horizontally around the externals column with equal padding
      // either side. The 12px spacing between Local top (y=29) and ES
      // top (y=17) is matched on the right (ES right is 12px past
      // Local/Remote right) and bottom (ES bottom is 12px below
      // Remote bottom). Height equals the host box and shares the
      // same y range so the two outer frames align top and bottom.
      var esPad = 24;
      var esX = extLeft - esPad;
      var esW = bw + esPad * 2;
      var esY = hostY;
      var esH = hostH_;
      var externalSystemsBox =
        '<rect x="' + esX + '" y="' + esY + '" width="' + esW + '" height="' + esH + '" rx="4" fill="none" stroke="var(--ink-faint)" stroke-opacity="0.5" stroke-width="1"/>';
      var externalSystemsLabel =
        '<text x="' + (esX + esW / 2) + '" y="281" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="1.5">EXTERNAL SYSTEMS</text>';

      var servers = [0,1,2].map(function (_, i) {
        var top = rowTops[i];
        return '<g class="mcp-svg-server" style="cursor:pointer">' +
          '<rect x="' + serverLeft + '" y="' + top + '" width="' + bw + '" height="' + bh + '" rx="3" fill="var(--paper-raised)" stroke="' + srvC + '" stroke-width="' + (active === 'server' ? '1.5' : '1') + '"/>' +
          '<text x="' + (serverLeft + bw / 2) + '" y="' + (rowYs[i] + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)" style="cursor:pointer">Server</text>' +
          '</g>';
      }).join('');

      // External systems column. Styling matches the server box so the
      // two read as peers; what distinguishes them is the label and the
      // fact that the external system sits outside the MCP boundary.
      var serverToExt = rowYs.map(function (y) {
        return '<line x1="' + serverRight + '" y1="' + y + '" x2="' + extLeft + '" y2="' + y + '" stroke="var(--ink-faint)" stroke-width="1" stroke-opacity="0.5"/>';
      }).join('');
      var externals = extLabels.map(function (lbl, i) {
        var top = rowTops[i];
        return '<g>' +
          '<rect class="role-viz-graphic-node" x="' + extLeft + '" y="' + top + '" width="' + bw + '" height="' + bh + '" rx="3"/>' +
          '<text x="' + (extLeft + bw / 2) + '" y="' + (rowYs[i] + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)">' + lbl + '</text>' +
          '</g>';
      }).join('');

      return '<svg viewBox="0 0 820 295" style="width:100%;max-height:305px">' +
        userBox + userToLlm +
        '<rect class="mcp-svg-host-rect" x="' + hostX + '" y="' + hostY + '" width="' + hostW_ + '" height="' + hostH_ + '" rx="7" fill="none" ' + hostStroke + ' style="cursor:pointer"/>' +
        '<rect class="role-viz-graphic-node" x="' + llmX + '" y="' + topY + '" width="' + bw + '" height="' + bh + '" rx="3"/>' +
        '<text x="' + (llmX + bw / 2) + '" y="' + (rowY + 4) + '" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink-secondary)">LLM</text>' +
        groupBoxes +
        llmToClients + clients + clientsToServers + servers +
        serverToExt + externals +
        externalSystemsBox +
        externalSystemsLabel +
        '<line x1="' + pbX + '" y1="' + hostY + '" x2="' + pbX + '" y2="' + (hostY + hostH_) + '" stroke="var(--line)" stroke-dasharray="2 4"/>' +
        '<text x="' + pbX + '" y="281" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--ink-faint)" letter-spacing="1.5">PROCESS BOUNDARY</text>' +
        '</svg>';
    }

    var svgCont = div('');
    svgCont.innerHTML = makeSVG();
    svgBg.appendChild(svgCont);
    panel.appendChild(svgBg);

    var descArea = div('mcp-arch-desc');

    function renderBtns() {
      btnsBar.innerHTML = '';
      NODES.forEach(function (n) {
        var btn = document.createElement('button');
        btn.className = 'role-tab' + (n.id === active ? ' active' : '');
        btn.textContent = n.label;
        btn.onclick = function () { setActive(n.id); };
        btnsBar.appendChild(btn);
      });
    }

    function renderDesc() {
      // Heading and body typography come from .mcp-arch-desc h3 / p in
      // _sass/_theme.scss (Widget specifics: MCP).
      var node = NODES.find(function (n) { return n.id === active; });
      descArea.innerHTML =
        '<h3>' + node.label + '</h3>' +
        '<p>' + node.description + '</p>';
    }

    panel.appendChild(descArea);

    var wireBody = div('role-post-body');
    wireBody.style.marginTop = '20px';
    wireBody.innerHTML =
      'Between client and server, every message takes the form of <a href="https://www.jsonrpc.org/specification" target="_blank" rel="noopener">JSON-RPC 2.0</a>. The underlying transport (i.e. how those messages actually travel) is interchangeable. Local servers typically use <code class="inline">stdio</code>, where the host spawns the server as a subprocess and pipes messages over stdin/stdout. Remote servers use a <a href="https://modelcontextprotocol.io/docs/concepts/transports" target="_blank" rel="noopener">streaming HTTP transport</a> instead.';

    sec.appendChild(panel);
    sec.appendChild(wireBody);
    root.appendChild(sec);

    function wireClicks() {
      var hr  = svgCont.querySelector('.mcp-svg-host-rect');
      if (hr) hr.onclick = function () { setActive('host'); };
      svgCont.querySelectorAll('.mcp-svg-client').forEach(function (el) { el.onclick = function () { setActive('client'); }; });
      svgCont.querySelectorAll('.mcp-svg-server').forEach(function (el) { el.onclick = function () { setActive('server'); }; });
    }

    function setActive(id) {
      active = id;
      svgCont.innerHTML = makeSVG();
      renderBtns();
      renderDesc();
      wireClicks();
    }

    // Allow other sections (e.g. §03) to drive selection here.
    window.__mcpSelectArchNode = function (id) {
      if (!NODES.find(function (n) { return n.id === id; })) return;
      setActive(id);
      var anchor = document.getElementById('sec-03');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    renderBtns();
    renderDesc();
    wireClicks();
  }

  // ------------------------------------------------------------------
  // §03 Primitives, tabs
  // ------------------------------------------------------------------
  function buildPrimitives(root) {
    // rpcMethod is the JSON-RPC method whose payload the code block shows.
    // It is rendered as a key/value pair alongside "controlled by" and
    // "example", so the meta strip carries all the protocol-level facts
    // and the codeTitle is freed to just label the payload variant
    // ("Server reply", "Server-initiated request", and so on).
    // controlledByTarget maps each "controlled by" subject to a section-2
    // architecture node (host / client / server). Clicking the subject
    // scrolls to §02 and selects the corresponding component. "User" is
    // not represented in §02 and is therefore non-clickable; instead the
    // user glyph from §02 is rendered inline next to the label.
    var USER_ICON =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:5px">' +
        '<circle cx="12" cy="9" r="4"/>' +
        '<path d="M 4 21 v -2 a 4 4 0 0 1 4 -4 h 8 a 4 4 0 0 1 4 4 v 2"/>' +
      '</svg>';

    var PRIMS = [
      { id: 'tools',     name: 'Tools',     color: 'var(--coral)', colorLit: '#C96442',
        controlledBy: 'Model',
        controlledByTarget: 'host',
        example: 'read_file',
        rpcMethod: 'tools/list',
        summary: 'Functions that the underlying model chooses to invoke. The model is presented with a list of available tools and decides for itself when each is appropriate. The <a href="#sec-05">next section</a> returns to this, drawing out the distinction between MCP tools and Claude’s native tool use.',
        codeTitle: 'Server reply',
        code: '{\n  "tools": [\n    {\n      "name": "read_file",\n      "description": "Read contents of a file",\n      "inputSchema": {\n        "type": "object",\n        "properties": { "path": { "type": "string" } },\n        "required": ["path"]\n      }\n    }\n  ]\n}' },
      { id: 'resources', name: 'Resources', color: 'var(--coral)', colorLit: '#C96442',
        controlledBy: 'Host',
        controlledByTarget: 'host',
        example: 'file:///project/README.md',
        rpcMethod: 'resources/list',
        summary: 'Read-only data that the host can elect to pull into the model’s context (files, database rows, API documents, and so on). Each resource is identified by a URI and has an associated name and description, returned in the catalogue below; the host reads those descriptions to decide which resources are worth pulling in via <code class="inline">resources/read</code>.',
        codeTitle: 'Server reply',
        code: '{\n  "resources": [\n    {\n      "uri": "file:///project/README.md",\n      "name": "Project README",\n      "description": "Top-level project documentation",\n      "mimeType": "text/markdown"\n    }\n  ]\n}' },
      { id: 'prompts',   name: 'Prompts',   color: 'var(--coral)', colorLit: '#C96442',
        controlledBy: 'User',
        controlledByIcon: USER_ICON,
        controlledByTarget: null,
        example: '/review-pr',
        rpcMethod: 'prompts/list',
        summary: 'Server-defined templates that the user explicitly invokes (most commonly surfacing as slash commands within the host). The mapping is straightforward- each entry returned by <code class="inline">prompts/list</code> carries a <code class="inline">name</code>, and the host turns that into a slash command. Hosts that already have native slash commands (Claude Code is a good example) typically namespace MCP prompts behind the server name to avoid collisions, e.g. <code class="inline">/mcp__filesystem__find</code> rather than just <code class="inline">/find</code>. Prompts can take arguments, which means a server can offer fairly rich workflows whilst keeping them under the user’s direct control.',
        codeTitle: 'Server reply',
        code: '{\n  "prompts": [\n    {\n      "name": "review-pr",\n      "description": "Review a pull request for security issues",\n      "arguments": [\n        { "name": "pr_url", "required": true }\n      ]\n    }\n  ]\n}' },
      { id: 'sampling',  name: 'Sampling',  color: 'var(--coral)', colorLit: '#C96442',
        controlledBy: 'Server',
        controlledByTarget: 'server',
        example: 'Server asks model to summarise',
        rpcMethod: 'sampling/createMessage',
        summary: 'A server asks the host to run an LLM completion on its behalf. This arrangement allows servers to remain model-agnostic and to reuse whichever model the host has been configured with, which is a useful property for any server that wishes to remain portable.',
        codeTitle: 'Server-initiated request',
        code: '{\n  "method": "sampling/createMessage",\n  "params": {\n    "messages": [...],\n    "maxTokens": 1024,\n    "modelPreferences": {\n      "intelligencePriority": 0.8\n    }\n  }\n}' },
    ];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(4, 'The components', 'MCP Primitives'));

    var body = div('role-post-body');
    body.innerHTML = 'The protocol is intentionally small. The host learns which servers exist from a configuration file (<a href="#sec-07">covered below</a>). How and when those connections are formed is left to the host. Some hosts spawn or open every configured server at startup and keep it alive for the session, which sidesteps the per-invocation startup cost. Others take an ephemeral approach, spawning the server only when one of its tools is required and tearing it down afterwards, which keeps the resource footprint minimal. Either way, every fresh connection is preceded by the same brief <strong>handshake</strong>- the host sends an <code class="inline">initialize</code> request that names the protocol version it speaks and the capabilities it can act as a client for. The server replies with the protocol version it has settled on along with the primitives it supports, and the host closes the loop with an <code class="inline">initialized</code> notification. Only then does it begin enumerating and using whatever the server has on offer. Different primitives are controlled by different entities.';
    sec.appendChild(body);

    var panel = div('role-panel-frame');
    var active = 'tools';

    var tabsEl = div('role-tab-bar');
    PRIMS.forEach(function (p) {
      var tab = document.createElement('button');
      tab.className = 'role-tab' + (p.id === active ? ' active' : '');
      tab.textContent = p.name;
      tab.onclick = function () { setActive(p.id); };
      tabsEl.appendChild(tab);
    });
    panel.appendChild(tabsEl);

    var content = div('');
    content.style.padding = '20px';

    function renderContent() {
      var p = PRIMS.find(function (x) { return x.id === active; });
      // Subject is either a clickable accent or a static accent label. Both
      // borrow the upstream meta.label recipe (mono xs uppercase eyebrow
      // tracking) and override the colour to coral inline; the clickable
      // case additionally adds cursor + underline (interaction-only inline,
      // not a typography decision).
      var subjectAttrs = p.controlledByTarget
        ? ' class="role-meta-label" data-target="' + p.controlledByTarget + '" style="color: var(--coral); cursor: pointer; text-decoration: underline; text-underline-offset: 3px"'
        : ' class="role-meta-label" style="color: var(--coral)"';
      var meta =
        '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">' +
          '<div>' +
            '<span class="role-meta-label">controlled by </span>' +
            '<span' + subjectAttrs + '>' + (p.controlledByIcon || '') + p.controlledBy + '</span>' +
          '</div>' +
          '<div>' +
            '<span class="role-meta-label">example </span>' +
            '<span class="role-meta-value">' + p.example + '</span>' +
          '</div>' +
          '<div>' +
            '<span class="role-meta-label">json-rpc method </span>' +
            '<span class="role-meta-value">' + p.rpcMethod + '</span>' +
          '</div>' +
        '</div>';
      content.innerHTML =
        meta +
        '<p class="role-system-secondary" style="margin:0 0 20px">' + p.summary + '</p>' +
        '<div class="role-code-block-frame">' +
          '<div class="role-code-block-header">' + p.codeTitle + '</div>' +
          '<pre class="role-code-block role-code-block-inset">' + p.code + '</pre>' +
        '</div>';

      // The clickable subject is the one carrying data-target. Selector
      // matches that attribute directly rather than relying on a class.
      var subject = content.querySelector('span[data-target]');
      if (subject) {
        subject.onclick = function () {
          var t = subject.dataset.target;
          if (window.__mcpSelectArchNode) window.__mcpSelectArchNode(t);
        };
      }
    }

    panel.appendChild(content);

    sec.appendChild(panel);
    root.appendChild(sec);

    function setActive(id) {
      active = id;
      tabsEl.querySelectorAll('.role-tab').forEach(function (tab, i) {
        var p = PRIMS[i];
        tab.className = 'role-tab' + (p.id === active ? ' active' : '');
      });
      renderContent();
    }

    renderContent();
  }

  // ------------------------------------------------------------------
  // §04 MCP vs Tools, comparison table
  // ------------------------------------------------------------------
  function buildMCPvsTools(root) {
    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(5, 'The distinction', "MCP vs. Claude’s native Tool use"));

    var body1 = div('role-post-body');
    body1.innerHTML = 'LLM applications such as <a href="/jekyll/update/2026/04/22/The-Claude-Code-Environment.html">Claude Code</a> themselves contain a tool layer. A tool is, in effect, a function-like abstraction: a named operation with typed inputs that the model can invoke when it judges the moment appropriate. Both approaches end up offering the model functions to call, but the difference is where the functions live, who defines them, and how they travel between applications. Under the hood, MCP tools are surfaced to the model as Claude tools (so the model itself is essentially unaware of the difference).';
    sec.appendChild(body1);

    var body2 = div('role-post-body');
    body2.innerHTML = 'Native tool use is, in essence, <strong>application-defined</strong>- a function is described in the prompt, the model selects one, and the application’s code executes it. MCP, by contrast, is <strong>environment-defined</strong>- tools arrive from external servers configured at the host level, and the host quietly translates them into the tool-call format the model already understands. Whilst the two arrive at the same destination, the path is rather different.';
    sec.appendChild(body2);

    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §05 Prompt Flow, stepper
  // ------------------------------------------------------------------
  function buildPromptFlow(root) {
    var STEPS = [
      { actor: 'user',   label: 'User → Host',    payloadKind: 'input', title: 'User types in Claude Code', detail: 'The user enters a natural-language request, which Claude Code then passes into the model context. There is no special framing involved at this point; the request is, essentially, just text.', payload: '> Convert the typeface on my landing page to “Söhne”.' },
      { actor: 'host',   label: 'Host → LLM',     payloadKind: 'tools', title: 'Host assembles context',    detail: 'Claude Code sends along the prompt together with the list of tools advertised by every connected MCP server, formatted as standard tool definitions. The model itself, perhaps notably, has no awareness that any of these tools originated from an MCP server.', payload: 'tools available:\n• filesystem.read_file   (path)\n• filesystem.write_file  (path, contents)\n• web-preview.start      (root)\n• web-preview.refresh    ()' },
      { actor: 'model',  label: 'LLM reasons',         payloadKind: 'model', title: 'Claude picks a tool',       detail: 'The model determines that reading the stylesheet first is the appropriate next move and emits a tool_use call. It’s worth noting that the format here is identical to any other Claude tool call (which is rather the point).', payload: '{ "type": "tool_use",\n  "name": "filesystem.read_file",\n  "input": { "path": "src/styles/global.css" } }' },
      { actor: 'client', label: 'Client → Server', payloadKind: 'rpc',   title: 'Host translates to JSON-RPC', detail: "The host quietly strips the namespace prefix and forwards a tools/call request over the client’s stdio pipe to the filesystem server. This translation step is, in practice, where the MCP plumbing earns its keep.", payload: '{ "jsonrpc": "2.0", "id": 17,\n  "method": "tools/call",\n  "params": {\n    "name": "read_file",\n    "arguments": { "path": "src/styles/global.css" }\n  }\n}' },
      { actor: 'server', label: 'Server executes',     payloadKind: 'rpc',   title: 'Filesystem server reads the file', detail: 'The MCP server is, more or less, a regular process. It reads from disk, applies whatever sandboxing it was started with, and replies; there is fairly little ceremony involved.', payload: '{ "jsonrpc": "2.0", "id": 17,\n  "result": { "content": [{\n    "type": "text",\n    "text": "body { font-family: Inter, sans-serif; ... }"\n  }] }\n}' },
      { actor: 'model',  label: 'LLM iterates',        payloadKind: 'tools', title: 'Claude writes the change, then previews', detail: 'With the file content now in context, the model generates the modified CSS, calls write_file, and then calls the web-preview server to refresh. All of this is autonomous and, perhaps reassuringly, travels through the same MCP plumbing as the earlier read.', payload: '1.  filesystem.write_file  ({...})  → ok\n2.  web-preview.refresh    ()       → http://localhost:5173' },
      { actor: 'user',   label: 'Host → User',    payloadKind: 'input', title: 'Result back to the user',   detail: 'Claude Code surfaces a natural-language response together with an inline preview or link. The user, of course, never sees any of the JSON-RPC traffic, which is presumably the desired outcome.', payload: '✓ Updated global.css. Preview running at http://localhost:5173, typography is now Söhne.' },
    ];
    var ACTOR_COLORS = { user: 'var(--coral)', host: 'var(--coral)', model: 'var(--coral)', client: 'var(--coral)', server: 'var(--coral)' };
    var LANES = [{ id: 'user', label: 'User' }, { id: 'host', label: 'Host' }, { id: 'client', label: 'Client' }, { id: 'server', label: 'Server' }, { id: 'system', label: 'System' }];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(6, 'A worked example', '”Convert the typeface on my landing page”'));

    var body = div('role-post-body');
    body.textContent = 'The walkthrough below traces a single prompt from the user, through the host and down to the MCP servers it ends up exercising, and then back again.';
    sec.appendChild(body);

    var panel = div('role-panel-frame');
    var step = 0, playing = false, playTimer = null;

    // Controls
    var controls = div('role-control-bar');
    var resetBtn = document.createElement('button'); resetBtn.className = 'role-control-btn'; resetBtn.textContent = '↺ reset';
    var playBtn  = document.createElement('button'); playBtn.className  = 'role-control-btn accent'; playBtn.textContent = '▶ play';
    var prevBtn  = document.createElement('button'); prevBtn.className  = 'role-control-btn'; prevBtn.innerHTML = '← prev';
    var nextBtn  = document.createElement('button'); nextBtn.className  = 'role-control-btn accent'; nextBtn.innerHTML = 'next →';
    var spacer   = div(''); spacer.style.flex = '1';
    var counter  = div(''); counter.style.cssText = 'font-family:var(--font-mono);font-size:var(--size-xs);color:var(--ink-muted)';
    controls.append(resetBtn, playBtn, prevBtn, nextBtn, spacer, counter);
    panel.appendChild(controls);

    var swimlane = div('role-swimlane');
    panel.appendChild(swimlane);

    var detail = div('');
    detail.style.padding = '20px';
    panel.appendChild(detail);

    var stepStrip = div('role-step-strip');
    STEPS.forEach(function (_, i) {
      var btn = document.createElement('button');
      btn.className = 'role-step-btn';
      btn.textContent = String(i + 1).padStart(2, '0');
      btn.onclick = function () { setStep(i); };
      stepStrip.appendChild(btn);
    });
    panel.appendChild(stepStrip);
    sec.appendChild(panel);
    root.appendChild(sec);

    function renderStep() {
      var s = STEPS[step];
      var ac = ACTOR_COLORS[s.actor] || 'var(--ink-faint)';
      counter.textContent = 'step ' + String(step + 1).padStart(2, '0') + ' / ' + String(STEPS.length).padStart(2, '0');
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === STEPS.length - 1;

      swimlane.innerHTML = LANES.map(function (lane) {
        var isActive = s.actor === lane.id || (s.actor === 'model' && lane.id === 'host');
        var lc = ACTOR_COLORS[lane.id] || 'var(--ink-faint)';
        return '<div class="role-swimlane-lane" style="background:' + (isActive ? lc + '18' : 'transparent') + '">' +
          '<div class="role-swimlane-label" style="color:' + (isActive ? lc : 'var(--ink-faint)') + '">' + lane.label + '</div>' +
          (isActive ? '<div class="role-swimlane-dot" style="background:' + lc + ';box-shadow:0 0 8px ' + lc + '"></div>' : '') +
          '</div>';
      }).join('');

      var kindLabel = { rpc: 'JSON-RPC over stdio', model: 'Model output', tools: 'Host context', input: 'Plain text' }[s.payloadKind] || 'Plain text';
      detail.innerHTML =
        '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">' +
          '<div style="width:36px;height:36px;border-radius:6px;background:' + ac + '20;border:1px solid ' + ac + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:12px;color:' + ac + ';font-weight:600;flex-shrink:0">' + String(step + 1).padStart(2, '0') + '</div>' +
          '<div style="flex:1">' +
            '<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:var(--track-eyebrow);color:' + ac + ';margin-bottom:4px">' + s.label.toUpperCase() + '</div>' +
            '<h3 style="font-family:var(--font-display);font-size:20px;font-weight:400;color:var(--ink-primary);margin:0 0 8px">' + s.title + '</h3>' +
            '<p style="font-family:var(--font-text);font-size:14px;color:var(--ink-muted);line-height:var(--lh-body);margin:0">' + s.detail + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="role-code-block-frame">' +
          '<div class="role-code-block-header"><span style="color:' + ac + '">●</span> ' + kindLabel + '</div>' +
          '<pre class="role-code-block role-code-block-inset">' + s.payload + '</pre>' +
        '</div>';

      stepStrip.querySelectorAll('.role-step-btn').forEach(function (btn, i) {
        btn.className = 'role-step-btn' + (i === step ? ' active' : '');
        btn.style.background = i === step ? ac + '22' : '';
      });
    }

    function setStep(n) { step = n; renderStep(); }
    function stopPlay()  { playing = false; clearTimeout(playTimer); playBtn.textContent = '▶ play'; playBtn.className = 'role-control-btn accent'; }
    function tick() {
      playTimer = setTimeout(function () {
        if (!playing) return;
        if (step < STEPS.length - 1) { setStep(step + 1); tick(); }
        else { stopPlay(); }
      }, 2200);
    }
    function startPlay() { playing = true; playBtn.textContent = '⏸ pause'; playBtn.className = 'role-control-btn'; tick(); }

    resetBtn.onclick = function () { stopPlay(); setStep(0); };
    playBtn.onclick  = function () { if (playing) stopPlay(); else startPlay(); };
    prevBtn.onclick  = function () { if (step > 0) setStep(step - 1); };
    nextBtn.onclick  = function () { if (step < STEPS.length - 1) setStep(step + 1); };

    renderStep();
  }

  // ------------------------------------------------------------------
  // §06 Configuration, hover annotations
  // ------------------------------------------------------------------
  function buildConfiguration(root) {
    var ANNOTATIONS = {
      name:      { title: 'Logical name',         desc: 'How this server is identified inside the host. Tools from this server appear with this prefix in your model context (e.g. typeface.read_file).' },
      command:   { title: 'Launch command',        desc: 'For stdio servers, this is literally what the host shell-execs to start the process. uvx and npx are common because they download-and-run the server in one go.' },
      args:      { title: 'Arguments',             desc: 'Passed to the command. Often the package name (uvx) plus operational flags. Here, --root limits the filesystem server\'s reach to a specific directory.' },
      env:       { title: 'Environment variables', desc: "Secrets and configuration. The host injects these into the spawned server’s environment, never sent over the wire." },
      transport: { title: 'Transport',             desc: "Implicit here (default is stdio). For HTTP servers you’d specify type: 'http' and a url instead of command/args." },
    };

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(7, 'Inputs', 'How a server is configured and launched'));

    var body = div('role-post-body');
    body.innerHTML = 'For local stdio servers in particular, configuration reduces to little more than <em>“how to start this process.”</em> The host reads a config file, spawns each server in turn, and pipes JSON-RPC over stdin/stdout (the simplicity here is, arguably, deliberate). Hovering over any of the highlighted fields below should clarify its specific role.';
    sec.appendChild(body);

    var grid = div('role-config-grid');

    // Code panel
    var codePanel = div('role-panel-frame');
    var codeHeader = div('role-code-block-header');
    codeHeader.innerHTML = '<span style="color:var(--coral)">◈</span> ~/.claude.json <span style="color:var(--ink-faint);margin-left:4px">(or .mcp.json in project root)</span>';
    codePanel.appendChild(codeHeader);

    var pre = document.createElement('pre');
    pre.className = 'role-code-block role-code-block-inset';
    pre.style.cssText = 'padding:18px;font-size:13px;line-height:1.75;background:var(--paper)';

    function t(text, color) {
      var s = document.createElement('span');
      if (color) s.style.color = color;
      s.textContent = text;
      return s;
    }
    function ann(key) {
      var s = document.createElement('span');
      s.className = 'role-annotated';
      s.dataset.key = key;
      return s;
    }

    var nameSpan = ann('name');
    nameSpan.appendChild(t('"typeface"', 'var(--coral)'));

    var cmdSpan = ann('command');
    cmdSpan.appendChild(t('"command"', 'var(--sx-keyword)'));
    cmdSpan.appendChild(t(': ', 'var(--ink-faint)'));
    cmdSpan.appendChild(t('"uvx"', 'var(--sx-string)'));

    var argsSpan = ann('args');
    argsSpan.appendChild(t('"args"', 'var(--sx-keyword)'));
    argsSpan.appendChild(t(': [', 'var(--ink-faint)'));
    argsSpan.appendChild(t('"mcp-server-filesystem"', 'var(--sx-string)'));
    argsSpan.appendChild(t(', ', 'var(--ink-faint)'));
    argsSpan.appendChild(t('"--root"', 'var(--sx-string)'));
    argsSpan.appendChild(t(', ', 'var(--ink-faint)'));
    argsSpan.appendChild(t('"/Users/me/site"', 'var(--sx-string)'));
    argsSpan.appendChild(t(']', 'var(--ink-faint)'));

    var envSpan = ann('env');
    envSpan.appendChild(t('"env"', 'var(--sx-keyword)'));
    envSpan.appendChild(t(': {\n        ', 'var(--ink-faint)'));
    envSpan.appendChild(t('"LOG_LEVEL"', 'var(--sx-string)'));
    envSpan.appendChild(t(': ', 'var(--ink-faint)'));
    envSpan.appendChild(t('"info"', 'var(--sx-string)'));
    envSpan.appendChild(t('\n      }', 'var(--ink-faint)'));

    var transSpan = ann('transport');
    transSpan.appendChild(t('"type"', 'var(--sx-keyword)'));
    transSpan.appendChild(t(': ', 'var(--ink-faint)'));
    transSpan.appendChild(t('"http"', 'var(--sx-string)'));
    transSpan.appendChild(t(', ', 'var(--ink-faint)'));
    transSpan.appendChild(t('"url"', 'var(--sx-keyword)'));
    transSpan.appendChild(t(': ', 'var(--ink-faint)'));
    transSpan.appendChild(t('"http://localhost:7331/mcp"', 'var(--sx-string)'));

    pre.appendChild(t('// TODO', 'var(--ink-muted)'));

    codePanel.appendChild(pre);
    grid.appendChild(codePanel);

    // Annotation side panel
    var annotPanel = div('role-annotation-panel');
    function showEmpty() {
      annotPanel.innerHTML =
        '<div class="role-meta-label">Hover a field</div>' +
        '<div class="role-annotation-body" style="color:var(--ink-faint);font-style:italic">Hover any highlighted segment in the config to see what it does.</div>';
    }
    showEmpty();
    grid.appendChild(annotPanel);
    sec.appendChild(grid);

    [nameSpan, cmdSpan, argsSpan, envSpan, transSpan].forEach(function (span) {
      var key = span.dataset.key;
      span.addEventListener('mouseenter', function () {
        var info = ANNOTATIONS[key];
        annotPanel.innerHTML =
          '<div class="role-meta-label" style="color:var(--coral)">Annotation</div>' +
          '<div class="role-annotation-title">' + info.title + '</div>' +
          '<div class="role-annotation-body">' + info.desc + '</div>';
        annotPanel.style.background = 'var(--paper-inset)';
      });
      span.addEventListener('mouseleave', function () { showEmpty(); annotPanel.style.background = 'var(--paper-raised)'; });
    });

    // Startup sequence
    var startupCallout = div('role-info-panel');
    startupCallout.innerHTML =
      '<div class="role-info-label">Startup Sequence</div>' +
      '<div class="role-steps-grid">' +
        [
          { i: '01', label: 'Read config',       desc: 'Host parses mcpServers' },
          { i: '02', label: 'Spawn / connect',   desc: 'stdio: fork + exec. http: open session.' },
          { i: '03', label: 'Initialise',         desc: 'Capability handshake (JSON-RPC)' },
          { i: '04', label: 'List capabilities', desc: 'Pull tools/resources/prompts' },
        ].map(function (s) {
          return '<div class="role-step-card">' +
            '<div style="font-family:var(--font-mono);font-size:10px;color:var(--coral);margin-bottom:4px">' + s.i + '</div>' +
            '<div style="font-family:var(--font-text);font-size:13px;font-weight:500;color:var(--ink-primary);margin-bottom:4px">' + s.label + '</div>' +
            '<div style="font-family:var(--font-text);font-size:11px;color:var(--ink-muted);line-height:1.5">' + s.desc + '</div>' +
            '</div>';
        }).join('') +
      '</div>';
    sec.appendChild(startupCallout);
    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // §07 Multi-server, timeline
  // ------------------------------------------------------------------
  function buildMultiServer(root) {
    var SC = { github: 'var(--coral)', postgres: 'var(--coral)', filesystem: 'var(--coral)', slack: 'var(--coral)' };
    var MOVES = [
      { tool: 'github.list_issues',    server: 'github',     out: "→ 3 open bugs labelled 'auth'" },
      { tool: 'filesystem.read_file',  server: 'filesystem', out: '→ src/auth/oauth.ts (482 lines)' },
      { tool: 'postgres.query',        server: 'postgres',   out: '→ 47 failed login events in last 24h' },
      { tool: 'filesystem.write_file', server: 'filesystem', out: '→ patched, 28 lines changed' },
      { tool: 'github.create_pr',      server: 'github',     out: '→ PR #1287 opened' },
      { tool: 'slack.send_message',    server: 'slack',      out: '→ posted to #engineering' },
    ];
    var SERVERS = ['github', 'postgres', 'filesystem', 'slack'];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(8, 'Composition', 'Many servers, one conversation'));

    var body = div('role-post-body');
    body.innerHTML = "It’s perhaps worth being explicit here: MCP does not define server-to-server pipelines, and there is no built-in chaining mechanism. Instead, the <em>model</em> takes on the role of orchestrator, calling any connected server’s tools across a single turn and weaving the outputs of one into the inputs of another.";
    sec.appendChild(body);

    var note = div('');
    note.style.cssText = 'font-family:var(--font-text);font-size:14px;color:var(--ink-faint);line-height:var(--lh-body);max-width:680px;margin-bottom:18px;font-style:italic';
    note.textContent = "It’s reasonable to read this as a feature rather than an omission. Each server stays small and independent (which keeps the surface area of any individual implementation manageable), with the coordination work delegated to the host and model.";
    sec.appendChild(note);

    var panel = div('role-panel-frame');
    var active = 0;

    var scenHeader = div('');
    scenHeader.style.cssText = 'padding:16px 18px;border-bottom:1px solid var(--line);background:var(--paper-inset)';
    scenHeader.innerHTML =
      '<span class="role-pill" style="color:var(--ink-muted)">scenario</span>' +
      '<p style="font-family:var(--font-display);font-size:17px;color:var(--ink-primary);margin:10px 0 0;line-height:1.4;font-style:italic">“Find recently reported auth bugs, check the codebase and the login error logs, ship a fix, open a PR, and tell the team.”</p>';
    panel.appendChild(scenHeader);

    var pillsWrap = div('role-pill-row');
    panel.appendChild(pillsWrap);

    var timeline = div('');
    timeline.style.padding = '18px 20px';
    panel.appendChild(timeline);

    var navRow = div('');
    navRow.style.cssText = 'display:flex;gap:8px;padding:0 20px 18px';
    var prevBtn = document.createElement('button'); prevBtn.className = 'role-control-btn'; prevBtn.textContent = '← prev';
    var nextBtn = document.createElement('button'); nextBtn.className = 'role-control-btn accent'; nextBtn.textContent = 'next call →';
    var sp = div(''); sp.style.flex = '1';
    var rstBtn = document.createElement('button'); rstBtn.className = 'role-control-btn'; rstBtn.textContent = '↺ reset';
    navRow.append(prevBtn, nextBtn, sp, rstBtn);
    panel.appendChild(navRow);

    sec.appendChild(panel);

    var callout = div('role-info-panel');
    callout.innerHTML =
      '<div class="role-info-label">Note on “Chaining”</div>' +
      '<div class="role-info-body">A fairly common question is whether MCP servers can call each other directly. They can’t, and arguably shouldn’t: the protocol takes pains to keep each server a clean, self-contained unit of capability. The closest official mechanism is <code class="inline">sampling</code>, by which a server asks <em>the host</em> to run an LLM call on its behalf (which, in turn, may end up invoking other servers). Composition is therefore always mediated by the model, never server-to-server, and this is presumably by design.</div>';
    sec.appendChild(callout);
    root.appendChild(sec);

    function colorOf(srv) { return SC[srv] || 'var(--ink-muted)'; }

    function render() {
      prevBtn.disabled = active === 0;
      nextBtn.disabled = active === MOVES.length - 1;

      pillsWrap.innerHTML = SERVERS.map(function (s) {
        var used = MOVES.slice(0, active + 1).some(function (m) { return m.server === s; });
        var c = colorOf(s);
        return '<div class="role-pill-mono" style="border-color:' + (used ? c : 'var(--line)') + ';color:' + (used ? c : 'var(--ink-faint)') + ';background:' + (used ? c + '18' : 'transparent') + '">' +
          '▪ ' + s + (used ? ' ✓' : '') +
          '</div>';
      }).join('');

      timeline.innerHTML = MOVES.map(function (m, i) {
        var c = colorOf(m.server);
        var isA = i === active;
        return '<div class="role-flow-step" style="opacity:' + (i <= active ? 1 : 0.3) + '" data-step="' + i + '">' +
          '<div class="role-flow-num" style="background:' + (isA ? c : c + '20') + ';color:' + (isA ? 'var(--paper)' : c) + '">' + String(i + 1).padStart(2, '0') + '</div>' +
          '<div>' +
            '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px">' +
              '<code style="font-family:var(--font-mono);font-size:13px;color:' + c + '">' + m.tool + '()</code>' +
              '<span class="role-pill" style="color:' + c + '">' + m.server + '</span>' +
            '</div>' +
            '<div style="font-family:var(--font-mono);font-size:12px;color:var(--ink-muted)">' + m.out + '</div>' +
          '</div>' +
          '</div>';
      }).join('');

      timeline.querySelectorAll('.role-flow-step').forEach(function (item) {
        item.onclick = function () { setActive(parseInt(item.dataset.step)); };
      });
    }

    function setActive(n) { active = n; render(); }
    prevBtn.onclick = function () { if (active > 0) setActive(active - 1); };
    nextBtn.onclick = function () { if (active < MOVES.length - 1) setActive(active + 1); };
    rstBtn.onclick  = function () { setActive(0); };
    render();
  }

  // ------------------------------------------------------------------
  // §08 Agnosticism, host tabs
  // ------------------------------------------------------------------
  function buildAgnosticism(root) {
    var CLIENTS = [
      { id: 'claude-code', name: 'Claude Code', file: '~/.claude.json',              color: 'var(--coral)', colorLit: '#C96442',
        config: '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "uvx",\n      "args": ["mcp-server-filesystem", "--root", "."]\n    }\n  }\n}' },
      { id: 'cursor',      name: 'Cursor',      file: '~/.cursor/mcp.json',          color: 'var(--coral)', colorLit: '#C96442',
        config: '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "uvx",\n      "args": ["mcp-server-filesystem", "--root", "."]\n    }\n  }\n}' },
      { id: 'vscode',      name: 'VS Code',     file: '.vscode/mcp.json',            color: 'var(--coral)', colorLit: '#C96442',
        config: '{\n  "servers": {\n    "filesystem": {\n      "type": "stdio",\n      "command": "uvx",\n      "args": ["mcp-server-filesystem", "--root", "."]\n    }\n  }\n}' },
      { id: 'zed',         name: 'Zed',         file: '~/.config/zed/settings.json', color: 'var(--coral)', colorLit: '#C96442',
        config: '{\n  "context_servers": {\n    "filesystem": {\n      "command": {\n        "path": "uvx",\n        "args": ["mcp-server-filesystem", "--root", "."]\n      }\n    }\n  }\n}' },
    ];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(9, 'Portability', 'Same server. Same protocol. Any host'));

    var body = div('role-post-body');
    body.innerHTML = "This is, more or less, the whole point of an open protocol: a server author writes one thing, and every host that speaks MCP is able to make use of it. Config <em>files</em> do differ slightly between hosts (each one having its own preferred way to express what is fundamentally the same launch command), but the server binary, the protocol it speaks, and the tools it exposes are otherwise identical.";
    sec.appendChild(body);

    var panel = div('role-panel-frame');
    var active = 'claude-code';

    var tabsEl = div('role-tab-bar');
    CLIENTS.forEach(function (c) {
      var tab = document.createElement('button');
      tab.className = 'role-tab' + (c.id === active ? ' active' : '');
      tab.textContent = c.name;
      tab.onclick = function () { setActive(c.id); };
      tabsEl.appendChild(tab);
    });
    panel.appendChild(tabsEl);

    var codeArea = div('');

    function renderCode() {
      var c = CLIENTS.find(function (x) { return x.id === active; });
      codeArea.innerHTML =
        '<div class="role-code-block-header">' +
          '<span style="color:' + c.colorLit + '">◈</span> ' + c.file +
          ' <span style="color:var(--line)">·</span> <span style="color:' + c.colorLit + '">' + c.name + '</span>' +
        '</div>' +
        '<pre class="role-code-block role-code-block-inset" style="font-size:13px;padding:18px">' + c.config + '</pre>';
    }

    panel.appendChild(codeArea);

    var comparison = div('');
    comparison.style.cssText = 'padding:16px 18px;border-top:1px solid var(--line);background:var(--paper-inset);display:grid;grid-template-columns:1fr 1fr;gap:20px';
    comparison.innerHTML =
      '<div>' +
        '<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:var(--track-eyebrow);color:var(--ink-faint);margin-bottom:8px">What’s the Same</div>' +
        '<ul style="margin:0;padding:0;list-style:none;font-family:var(--font-text);font-size:13px;color:var(--ink-secondary);line-height:1.9">' +
          ['The MCP server binary', 'JSON-RPC message format', 'Tools / resources / prompts schemas', 'Capability handshake', 'Transport (stdio in this case)'].map(function (x) {
            return '<li style="display:flex;align-items:center;gap:8px"><span style="color:var(--coral)">✓</span>' + x + '</li>';
          }).join('') +
        '</ul>' +
      '</div>' +
      '<div>' +
        '<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:var(--track-eyebrow);color:var(--ink-faint);margin-bottom:8px">What Differs</div>' +
        '<ul style="margin:0;padding:0;list-style:none;font-family:var(--font-text);font-size:13px;color:var(--ink-secondary);line-height:1.9">' +
          ['Config file location', 'Top-level key (mcpServers, servers, etc.)', 'Optional fields the host uses for UX', 'How tool calls are surfaced in UI'].map(function (x) {
            return '<li style="display:flex;align-items:center;gap:8px"><span style="color:var(--ink-muted)">×</span>' + x + '</li>';
          }).join('') +
        '</ul>' +
      '</div>';
    panel.appendChild(comparison);
    sec.appendChild(panel);

    var callout = div('role-info-panel');
    callout.innerHTML =
      '<div class="role-info-label">The Open-Protocol Bet</div>' +
      '<div class="role-info-body">Whilst MCP was introduced by Anthropic, the specification itself is open and the implementations are decentralised, which is presumably the more important property in the long run. The same characteristic that allows a filesystem server to work in Claude Code and Cursor today is, in effect, what allows it to work in whatever new host happens to arrive next year. For a builder, this means writing the server once; for a user, it means a toolbelt that follows them across applications.</div>';
    sec.appendChild(callout);
    root.appendChild(sec);

    function setActive(id) {
      active = id;
      tabsEl.querySelectorAll('.role-tab').forEach(function (tab, i) {
        var c = CLIENTS[i];
        tab.className = 'role-tab' + (c.id === active ? ' active' : '');
      });
      renderCode();
    }

    renderCode();
  }

  // ------------------------------------------------------------------
  // §09 Closing, recap grid
  // ------------------------------------------------------------------
  function buildClosing(root) {
    var ITEMS = [
      { q: 'Why MCP exists',             a: 'M×N reduces to M+N. Each host implements the protocol once, and each system implements it once, with the combinatorics quietly disappearing as a result.',           c: 'var(--coral)' },
      { q: 'The architecture',           a: 'Host (the application), client (a 1:1 connector that lives inside it), and server (the integration). Three tiers in total, with JSON-RPC carrying messages between them.', c: 'var(--coral)' },
      { q: 'What servers expose',        a: 'Tools (model-controlled), resources (host-controlled), prompts (user-controlled), and sampling (server-initiated). The "who controls each" framing is, perhaps, the most useful one to keep in mind.',                                            c: 'var(--coral)' },
      { q: 'How prompts reach a server', a: 'The model emits tool_use; the host quietly translates it into a tools/call JSON-RPC request; the server executes; and the response flows back as context, more or less invisibly to the model.', c: 'var(--coral)' },
      { q: 'Multi-server work',          a: 'There is no native chaining mechanism, by design. The model itself orchestrates calls across all connected servers within a single turn.',                              c: 'var(--coral)' },
      { q: 'Why it’s portable',          a: 'The same server binary speaks the same protocol to any compliant host. Configuration syntax may differ slightly between hosts, but the semantics are otherwise identical.', c: 'var(--coral)' },
    ];

    var sec = div('mcp-section');
    sec.appendChild(sectionHeader(10, 'Recap', 'What you now have a model of'));

    var grid = div('role-summary-grid');
    ITEMS.forEach(function (item, i) {
      var card = div('role-summary-card');
      card.innerHTML =
        '<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:var(--track-eyebrow);color:' + item.c + ';margin-bottom:8px">#' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div style="font-family:var(--font-display);font-size:17px;font-weight:400;color:var(--ink-primary);margin-bottom:8px">' + item.q + '</div>' +
        '<div style="font-family:var(--font-text);font-size:13px;color:var(--ink-muted);line-height:var(--lh-body)">' + item.a + '</div>';
      grid.appendChild(card);
    });
    sec.appendChild(grid);

    var nextSteps = div('');
    nextSteps.style.cssText = 'margin-top:32px;padding:20px;border:1px dashed var(--line);border-radius:8px;text-align:center';
    nextSteps.innerHTML =
      '<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:var(--track-eyebrow);color:var(--ink-faint);margin-bottom:8px">Suggested Next Steps</div>' +
      '<div style="font-family:var(--font-text);font-size:14px;color:var(--ink-muted);line-height:var(--lh-body)">A reasonable next step, perhaps, would be to try <code class="inline">claude mcp add</code> with the filesystem server inside one of the reader’s own worktrees. From there, the specification at <code class="inline">modelcontextprotocol.io</code> documents the full JSON-RPC method list (initialize, tools/list, tools/call, resources/read, prompts/get, sampling/createMessage, and so on), which is fairly approachable once the architecture has been internalised.</div>';
    sec.appendChild(nextSteps);
    root.appendChild(sec);
  }

  // ------------------------------------------------------------------
  // Main export
  // ------------------------------------------------------------------
  window.createMCPExploration = function (containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.className = 'mcp';
    startTypewriter();
    buildTOC(container);
    buildProblem(container);
    buildWhenToUseMCP(container);
    buildArchitecture(container);
    buildPrimitives(container);
    buildMCPvsTools(container);
    buildPromptFlow(container);
    buildConfiguration(container);
    buildMultiServer(container);
    buildAgnosticism(container);
    buildClosing(container);
  };

})();
