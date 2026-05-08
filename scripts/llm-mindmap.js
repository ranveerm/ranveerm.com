// The Shape of a Language Model -- concept-map widget.
//
// Vanilla-JS port of the original React mind-map. Twenty-three concepts
// grouped into five clusters (input, core, output, training, theory),
// connected by dependency edges. Clicking a node fades the rest so the
// surrounding wiring is easier to follow.
//
// Adapted to the site's design language: every colour, spacing and
// typeface comes from the foundation tokens declared in _sass/_theme.scss
// (--paper-*, --ink-*, --line, --coral*, --font-*). No new palette is
// introduced. Cluster identity is conveyed by spatial grouping and
// eyebrow-style labels instead of categorical hues.
//
// Usage:  <div id="llmmap-demo"></div>
//         <script>createLLMMindMap('llmmap-demo');</script>

(function () {

  var CLUSTERS = {
    input:    { label: 'INPUT' },
    core:     { label: 'CORE' },
    output:   { label: 'OUTPUT' },
    training: { label: 'TRAINING' },
    theory:   { label: 'FOUNDATIONS' },
  };

  // Node positions are given as percentages of the SVG viewBox (1000×760).
  // Each circle has radius R=50px. Minimum centre-to-centre distance to avoid
  // overlap is 110px (100px diameter + 10px gap). This translates to:
  //   same-x columns: y difference > 14.5%
  //   same-y rows:    x difference > 11%
  // All pairs below satisfy these constraints.
  var NODES = [
    { id: 'text',    cluster: 'input',    x: 8,  y: 18, label: 'Raw text',
      summary: 'Language in its native form: letters, words, whitespace, before any processing.',
      plain: 'Just text as a human wrote it. The model cannot work with characters directly; everything after this is about turning the text into something mathematical.',
      feel:  'Think of it as the unopened letter. Still sealed, still continuous, still in human form.',
      session: null },

    { id: 'tok',     cluster: 'input',    x: 24, y: 10, label: 'Tokenisation',
      summary: 'Breaks text into a finite inventory of pieces, each with an integer ID.',
      plain: 'The text is chopped into pieces drawn from a fixed list, often around 50,000 to 200,000 of them. Common words become one token; rare words get split into smaller pieces. Each piece is replaced by its ID number.',
      feel:  'Like transcribing speech into a phonetic alphabet. You fix the set of symbols first; then everything you ever write has to be spelled using only those.',
      session: 'S8' },

    { id: 'embed',   cluster: 'input',    x: 40, y: 22, label: 'Embedding',
      summary: 'Each token ID becomes a vector of numbers that captures its meaning.',
      plain: 'The model has a giant lookup table: token ID in, a list of (typically) several hundred to several thousand numbers out. That list of numbers is the token\'s location in a high-dimensional space where related words sit near each other.',
      feel:  'Every word gets a pin stuck in a vast map. Words about food cluster in one region, words about weather in another. The map has far too many dimensions to picture, but the principle is the same as any map.',
      session: 'S1' },

    { id: 'pos',     cluster: 'input',    x: 24, y: 30, label: 'Position info',
      summary: 'Injects information about where each token sits in the sequence.',
      plain: 'The core operation treats its inputs as an unordered bag. Without extra help, “dog bites man” and “man bites dog” would look identical. A position signal is mixed into each token\'s vector (or applied when tokens interact) so order is preserved.',
      feel:  'Like numbering the pages of a manuscript before shuffling them for editing. The content is the same; the numbering tells you how it should eventually line up.',
      session: 'S7' },

    { id: 'resid',   cluster: 'core',     x: 56, y: 40, label: 'Residual stream',
      summary: 'The main channel running through the whole model. Every layer reads from it and writes back.',
      plain: 'Every token carries a running vector that starts as its embedding and gets updated by each layer. Updates are added on top, not replaced. By the end, this vector has accumulated everything the model has learned to say about that token in this context.',
      feel:  'A painter working in translucent layers. Earlier brushwork shows through the glazes added on top. The final image is every pass combined, not the last pass alone.',
      session: 'S6' },

    { id: 'attn',    cluster: 'core',     x: 42, y: 52, label: 'Attention',
      summary: 'Each token pulls information from other tokens in the sequence.',
      plain: 'For every token, the model works out how much each other token is worth listening to right now, and builds a weighted average of their content. This is how context moves between positions: the only place in the whole architecture where tokens actually interact.',
      feel:  'Like reading a detective novel. When you hit the word “she”, you glance backward to figure out who “she” is. Attention is that glance, happening in parallel for every word, toward every other word.',
      session: 'S3' },

    { id: 'mha',     cluster: 'core',     x: 42, y: 67, label: 'Multiple heads',
      summary: 'Attention is run several times in parallel, each looking for different patterns.',
      plain: 'Instead of one attention operation, the model runs many (often 8 to 96) in parallel on different slices of the vector. Each can specialise: one head might track subject–verb agreement, another might track what a pronoun refers to, another might copy recent text.',
      feel:  'Like a committee of readers, each listening for one thing (rhythm, plot, character voice, foreshadowing) then pooling their notes.',
      session: 'S4' },

    { id: 'mlp',     cluster: 'core',     x: 70, y: 52, label: 'Processing layer',
      summary: 'Each token is transformed independently through a learned nonlinear function.',
      plain: 'After attention mixes information between tokens, this stage processes each token on its own. It expands the vector to a much larger size, applies a nonlinearity, then projects back. A lot of the model\'s factual knowledge appears to live here.',
      feel:  'If attention is the conversation in the room, this is each person going home and thinking it over. No mixing here, just private processing of what was just heard.',
      session: 'S5' },

    { id: 'norm',    cluster: 'core',     x: 70, y: 67, label: 'Normalisation',
      summary: 'Keeps the size of numbers stable as signals travel through many layers.',
      plain: 'Without this, values in the residual stream would drift to very large or very small magnitudes over dozens of layers and the model would fail to train. Normalisation re-centres and rescales each token\'s vector so it stays in a healthy range.',
      feel:  'Tuning the volume between tracks so nothing gets drowned out or clipped. Invisible when it works; a disaster when it doesn\'t.',
      session: 'S6' },

    { id: 'stack',   cluster: 'core',     x: 56, y: 76, label: 'Repeat ×N',
      summary: 'The whole attention-plus-processing block is stacked dozens of times.',
      plain: 'A single block only does so much. Stacking (12 layers in small models, 80+ in frontier ones) lets the model build increasingly abstract representations: early layers deal with surface patterns, deeper layers with meaning.',
      feel:  'Drafts. First draft gets the sentences down; second draft tightens them; tenth draft is about rhythm and implication. Each pass sees and refines what the last pass produced.',
      session: null },

    { id: 'unembed', cluster: 'output',   x: 74, y: 28, label: 'To vocabulary',
      summary: 'The final vector is turned into a score for every possible next token.',
      plain: 'Multiplying by a large matrix projects the hidden vector back onto the vocabulary. The result is a raw score for every token: how plausible each one is as the next token.',
      feel:  'The moment a writer has narrowed things down and is now weighing candidate words, giving each one a rough score before picking.',
      session: 'S2' },

    { id: 'softmax', cluster: 'output',   x: 88, y: 16, label: 'Softmax',
      summary: 'Converts raw scores into a proper probability distribution.',
      plain: 'Raw scores can be any real numbers. Softmax exponentiates each one and divides by the total, producing a set of positive values that sum to one. Now they can be read as probabilities: the model\'s belief about what comes next.',
      feel:  'Like sorting candidates by enthusiasm, then expressing each as a share of total enthusiasm. The loudest voice wins the most weight, but the quieter ones still count.',
      session: 'S2' },

    { id: 'sample',  cluster: 'output',   x: 93, y: 32, label: 'Pick a token',
      summary: 'One token is chosen from the distribution and emitted as output.',
      plain: 'Several strategies: always pick the highest-probability token (deterministic), sample proportionally (adds variation), scale probabilities by a temperature (controls boldness), or restrict to the top few candidates. This is the one irreversible step.',
      feel:  'The writer finally commits. All the deliberation collapses into a single word on the page, and the sentence moves forward.',
      session: 'S10' },

    { id: 'loop',    cluster: 'output',   x: 80, y: 46, label: 'Feedback loop',
      summary: 'The chosen token is appended to the input and the whole process restarts.',
      plain: 'Generation is not one forward pass but many. Each new token joins the input, the model runs again, and the next token is produced. What the model writes becomes what it reads.',
      feel:  'The novelist rereading the last sentence before writing the next. The story so far is the prompt for the story still to come.',
      session: null },

    { id: 'loss',    cluster: 'training', x: 28, y: 88, label: 'Loss',
      summary: 'A number measuring how wrong the model was about the next token.',
      plain: 'During training, the true next token is known. The loss compares the predicted distribution to that truth. It is large when the correct token had low predicted probability and small when it had high probability. The model\'s only job is to make this number small on average.',
      feel:  'The red pen. One number that summarises every complaint about the model\'s guess, rolled up for every position and every example.',
      session: 'T1' },

    { id: 'backprop', cluster: 'training', x: 46, y: 92, label: 'Backprop',
      summary: 'Works out how much each parameter contributed to the error.',
      plain: 'Starting from the loss, the chain rule is applied backward through the network to compute, for each weight, how a small change would affect the loss. This is pure calculus on a very large graph: the same technique as manual gradient calculation, just automated and done for billions of parameters at once.',
      feel:  'Forensics. The output was wrong; now trace every stroke back through every layer and tag each one with its share of responsibility.',
      session: 'T2' },

    { id: 'optim',   cluster: 'training', x: 64, y: 92, label: 'Optimiser',
      summary: 'Uses the gradients to nudge each weight in a direction that reduces the loss.',
      plain: 'The simplest rule: subtract a small multiple of the gradient from the weight. Modern optimisers (Adam, AdamW) add momentum and per-parameter scaling so weights that have been moving consistently keep moving, and weights with noisy gradients move cautiously.',
      feel:  'A sculptor tapping a chisel. Thousands of tiny corrective taps, each smaller than you would expect, gradually shaping the piece toward its target form.',
      session: 'T3' },

    { id: 'scale',   cluster: 'training', x: 82, y: 88, label: 'Scale',
      summary: 'Loss falls predictably as you add more parameters, more data, and more compute.',
      plain: 'Empirically, bigger models trained on more data give lower loss, and the relationship follows a clean mathematical law. Some abilities appear abruptly at certain scales: the loss curve is smooth but the behaviours it produces are not.',
      feel:  'A skill curve. Hours of practice translate to smooth, predictable progress, until a threshold is crossed and suddenly something new is possible.',
      session: 'T4' },

    { id: 'linalg',  cluster: 'theory',   x: 8,  y: 56, label: 'Linear algebra',
      summary: 'The language of vectors and their transformations.',
      plain: 'Almost every operation in the model is a matrix multiply, a projection, or a normalisation. If you can read what a matrix does to a vector, you can read what any layer does. Matrix multiplication is essentially the model\'s one true verb.',
      feel:  'The grammar underneath. Nothing is said in the model that isn\'t a rotation, a stretch, or a projection of something that came before.',
      session: null },

    { id: 'prob',    cluster: 'theory',   x: 8,  y: 70, label: 'Probability',
      summary: 'How the model expresses uncertainty and how training measures mistakes.',
      plain: 'The output is a distribution. The loss is an expectation. The training process is essentially maximum-likelihood estimation: the model is being tuned to assign high probability to the text it was trained on.',
      feel:  'The model never says “this word”; it says “this word 40%, that word 15%, the next one 9%…”. Everything that follows respects that this is a guess.',
      session: null },

    { id: 'calc',    cluster: 'theory',   x: 8,  y: 84, label: 'Calculus',
      summary: 'Gradients tell us which direction to nudge each weight.',
      plain: 'Training requires knowing how the loss responds to tiny changes in every weight. That is exactly what the derivative measures. The chain rule propagates this information backward through compositions of functions, which is all a neural network is.',
      feel:  'A compass, billions of them, one per weight. Each points toward less error; the optimiser decides how far to walk along each.',
      session: null },

    { id: 'info',    cluster: 'theory',   x: 8,  y: 42, label: 'Information',
      summary: 'Measures how surprised the model is, which is what training penalises.',
      plain: 'Cross-entropy is the average number of bits you would waste encoding real text with the model\'s predicted distribution. Minimising it is equivalent to compressing the training data as well as possible. A good language model is, in a precise sense, a good compressor of language.',
      feel:  'Surprise has a price. The model learns not to be surprised by text that people actually write.',
      session: null },
  ];

  var EDGES = [
    ['text', 'tok'], ['tok', 'embed'], ['pos', 'embed'], ['embed', 'resid'],
    ['resid', 'attn'], ['attn', 'mha'], ['mha', 'resid'],
    ['resid', 'mlp'], ['mlp', 'norm'], ['norm', 'resid'],
    ['resid', 'stack'], ['stack', 'resid'],
    ['resid', 'unembed'], ['unembed', 'softmax'], ['softmax', 'sample'],
    ['sample', 'loop'], ['loop', 'tok'],
    ['softmax', 'loss'], ['loss', 'backprop'], ['backprop', 'optim'],
    ['optim', 'stack'], ['optim', 'embed'],
    ['linalg', 'embed'], ['linalg', 'attn'],
    ['prob', 'softmax'], ['prob', 'loss'],
    ['calc', 'backprop'], ['info', 'loss'],
  ];

  // ------------------------------------------------------------------
  // Styles. Every value resolves to a token from _sass/_theme.scss.
  // The widget reuses the same recipe as .role-panel-frame for cards,
  // .role-meta-* for key/value text, .role-pill for the legend chips,
  // and .role-tab style hover affordances on the connected pills.
  // ------------------------------------------------------------------
  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      // Root
      '.llmmap { font-family: var(--font-text); color: var(--ink-primary); padding: 8px 0 24px; }',

      // Cluster filter tabs. These reuse the site-wide .mcp-tabs / .mcp-tab
      // recipe. The styles are also defined here so the widget is self-contained
      // on pages that do not load mcp-exploration.js.
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
      // Outer panel (mirrors .mcp-panel from §02 of the MCP exploration).
      // Tabs sit at the top; the canvas section uses --paper-inset for visual
      // separation; the detail section sits below on --paper-raised, divided
      // by a hairline. The whole thing reads as a single rounded surface.
      '.llmmap-panel { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }',

      // Canvas section (paper-inset, mirroring the SVG area in MCP §02)
      '.llmmap-canvas { background: var(--paper-inset); padding: 20px 18px 12px; }',
      '.llmmap-canvas svg { width: 100%; height: auto; display: block; }',

      // SVG element transitions
      '.llmmap-edge { transition: stroke 200ms ease, stroke-width 200ms ease, opacity 200ms ease; }',
      '.llmmap-node-g { cursor: pointer; }',
      '.llmmap-node-g rect { transition: fill 180ms ease, stroke 180ms ease, stroke-width 180ms ease; }',

      // Detail section (mirrors .mcp-arch-desc: top hairline, paper-raised bg)
      '.llmmap-detail { border-top: 1px solid var(--line); background: var(--paper-raised); padding: 20px; }',

      // Detail header
      '.llmmap-detail-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }',
      '.llmmap-detail-cluster { font-family: var(--font-mono); font-size: var(--size-xs); font-weight: 500; letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--coral); }',
      '.llmmap-detail-session { font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); }',

      // Detail title
      '.llmmap-detail-title { font-family: var(--font-display); font-size: var(--size-h2); font-weight: 400; line-height: var(--lh-snug); letter-spacing: var(--track-snug); color: var(--ink-primary); margin: 4px 0 12px; }',

      // Detail summary
      '.llmmap-detail-summary { color: var(--ink-secondary); font-family: var(--font-display); font-size: var(--size-md); line-height: var(--lh-normal); margin: 0 0 16px; }',

      // Lens blocks (label + body, separated by hairline)
      '.llmmap-lens { padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--line); }',
      '.llmmap-lens:first-of-type { padding-top: 0; margin-top: 0; border-top: none; }',
      '.llmmap-lens-label { font-family: var(--font-mono); font-size: var(--size-xs); font-weight: 400; letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }',
      '.llmmap-lens-body { color: var(--ink-secondary); font-family: var(--font-display); font-size: var(--size-md); line-height: var(--lh-body); margin: 0; }',
      '.llmmap-lens-body.feel { color: var(--ink-muted); }',

      // Footer strip (post.section-rule + meta)
      '.llmmap-footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--size-xs); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--ink-faint); }',
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      });
    }
    return n;
  }
  function findNode(id) { for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i]; return null; }

  function connectedSet(id) {
    var s = {};
    EDGES.forEach(function (e) {
      if (e[0] === id) s[e[1]] = true;
      if (e[1] === id) s[e[0]] = true;
    });
    return s;
  }

  // ------------------------------------------------------------------
  // Factory
  // ------------------------------------------------------------------
  window.createLLMMindMap = function (rootId) {
    injectStyles();

    var root = document.getElementById(rootId);
    if (!root) return;
    root.className = 'llmmap';

    var state = { selectedId: 'attn', clusterFilter: null };

    // Tab labels use title-case for the display-font tab bar; the all-caps
    // CLUSTERS[k].label is kept for the SVG eyebrow text inside the canvas.
    var TAB_LABELS = { input: 'Input', core: 'Core', output: 'Output', training: 'Training', theory: 'Foundations' };

    // ---------- Single panel: tabs + canvas + detail (mirrors .mcp-panel) ----------
    var panel = el('div', 'llmmap-panel');

    // Cluster filter tabs at the top of the panel
    var tabsBar = el('div', 'mcp-tabs');
    var clusterTabEls = {};

    var allTab = el('button', 'mcp-tab active');
    allTab.type = 'button';
    allTab.textContent = 'All';
    allTab.addEventListener('click', function () { setClusterFilter(null); });
    tabsBar.appendChild(allTab);
    clusterTabEls['all'] = allTab;

    Object.keys(CLUSTERS).forEach(function (k) {
      var tab = el('button', 'mcp-tab');
      tab.type = 'button';
      tab.textContent = TAB_LABELS[k] || CLUSTERS[k].label;
      tab.addEventListener('click', function () { setClusterFilter(k); });
      tabsBar.appendChild(tab);
      clusterTabEls[k] = tab;
    });
    panel.appendChild(tabsBar);

    // Canvas (paper-inset background, sits below the tabs)
    var canvas = el('div', 'llmmap-canvas');
    var svg = svgEl('svg', {
      viewBox: '0 0 1000 760',
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': 'Concept map of language-model components'
    });
    canvas.appendChild(svg);
    panel.appendChild(canvas);

    // Detail section (paper-raised, top hairline)
    var detailCard = el('div', 'llmmap-detail');
    panel.appendChild(detailCard);

    root.appendChild(panel);

    // ---------- SVG layout helpers ----------
    var W = 1000, H = 760;
    // Node box dimensions matching MCP §02 "Host, Client and Server" exactly:
    // bw=100, bh=40, rx=3, font-size=11.
    var CAP_W = 100;  // fixed width
    var CAP_H = 40;   // fixed height
    var CAP_R = 3;    // corner radius

    function toX(p) { return (p / 100) * W; }
    function toY(p) { return (p / 100) * H; }

    // Distance from box centre to its edge in direction (ux, uy).
    // Uses an ellipse approximation with semi-axes = half-width / half-height.
    function capTrim(ux, uy) {
      var hw = CAP_W / 2;
      var hh = CAP_H / 2;
      var d  = Math.sqrt((ux / hw) * (ux / hw) + (uy / hh) * (uy / hh));
      return (d > 0 ? 1 / d : hw) + 6; // +6 for arrowhead clearance
    }

    // Returns true if line segment (ax,ay)-(bx,by) intersects segment (cx,cy)-(dx,dy).
    function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
      var d1x = bx - ax, d1y = by - ay;
      var d2x = dx - cx, d2y = dy - cy;
      var cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 1e-8) return false;
      var tx = cx - ax, ty = cy - ay;
      var t = (tx * d2y - ty * d2x) / cross;
      var u = (tx * d1y - ty * d1x) / cross;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    // Returns true if line segment (x1,y1)-(x2,y2) passes through rectangle
    // defined by corners (rx1,ry1) top-left and (rx2,ry2) bottom-right.
    function lineIntersectsRect(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
      if (x1 >= rx1 && x1 <= rx2 && y1 >= ry1 && y1 <= ry2) return true;
      if (x2 >= rx1 && x2 <= rx2 && y2 >= ry1 && y2 <= ry2) return true;
      return segmentsIntersect(x1, y1, x2, y2, rx1, ry1, rx2, ry1) ||
             segmentsIntersect(x1, y1, x2, y2, rx2, ry1, rx2, ry2) ||
             segmentsIntersect(x1, y1, x2, y2, rx2, ry2, rx1, ry2) ||
             segmentsIntersect(x1, y1, x2, y2, rx1, ry2, rx1, ry1);
    }

    // Arrow markers. Two variants: hairline default, coral when an edge
    // is "hot" (connected to the selected node). Markers do not inherit
    // strokes, so we set fill explicitly via design tokens.
    var defs = svgEl('defs');
    var mk = function (id, fill) {
      var m = svgEl('marker', { id: id, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '4', markerHeight: '4', orient: 'auto' });
      m.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: fill }));
      return m;
    };
    defs.appendChild(mk('llmmap-arr',     'var(--ink-faint)'));
    defs.appendChild(mk('llmmap-arr-hot', 'var(--coral)'));
    svg.appendChild(defs);

    // Cluster labels at strategic corners. Position is empirical, mirroring
    // the source design.
    var clusterLabels = [
      { key: 'input',    x: 8,  y: 6,  anchor: 'start'  },
      { key: 'core',     x: 56, y: 32, anchor: 'middle' },
      { key: 'output',   x: 93, y: 8,  anchor: 'end'    },
      { key: 'training', y: 82, x: 28, anchor: 'start'  },
      { key: 'theory',   x: 8,  y: 32, anchor: 'start'  },
    ];
    clusterLabels.forEach(function (c) {
      var t = svgEl('text', {
        x: toX(c.x), y: toY(c.y),
        'text-anchor': c.anchor,
        'font-family': 'var(--font-mono)',
        'font-size': '11',
        'letter-spacing': '2',
        fill: 'var(--ink-faint)'
      });
      t.textContent = CLUSTERS[c.key].label;
      svg.appendChild(t);
    });

    // Edge layer first (behind nodes)
    var edgesLayer = svgEl('g', { 'stroke-linecap': 'round' });
    svg.appendChild(edgesLayer);

    var edgeEls = EDGES.map(function (pair) {
      var a = findNode(pair[0]);
      var b = findNode(pair[1]);
      var line = svgEl('line', {
        class: 'llmmap-edge',
        x1: 0, y1: 0, x2: 0, y2: 0,
        stroke: 'var(--line)',
        'stroke-width': '1',
        opacity: '0.75',
        'marker-end': 'url(#llmmap-arr)',
      });
      line.__from = a.id;
      line.__to   = b.id;
      edgesLayer.appendChild(line);
      return line;
    });

    // Node layer
    var nodesLayer = svgEl('g');
    svg.appendChild(nodesLayer);

    // Build a node group per concept
    var nodeEls = NODES.map(function (n) {
      var g  = svgEl('g', { class: 'llmmap-node-g' });
      var cx = toX(n.x), cy = toY(n.y);
      var hw = CAP_W / 2;

      // Outer ring (slightly larger box, shown only when selected).
      var ring = svgEl('rect', {
        x: cx - hw - 6, y: cy - CAP_H / 2 - 6,
        width: (hw + 6) * 2, height: CAP_H + 12,
        rx: CAP_R + 6, ry: CAP_R + 6,
        fill: 'none',
        stroke: 'var(--coral)',
        'stroke-width': '1',
        opacity: '0',
      });

      // Main box (matching MCP §02 bw=100, bh=40, rx=3).
      var cap = svgEl('rect', {
        x: cx - hw, y: cy - CAP_H / 2,
        width: hw * 2, height: CAP_H,
        rx: CAP_R, ry: CAP_R,
        fill: 'var(--paper-raised)',
        stroke: 'var(--line)',
        'stroke-width': '1',
      });

      // Word-wrap: split if label is longer than 12 chars.
      // dy centres the text block vertically, +4 baseline offset matches MCP §02.
      var words = n.label.length > 12 ? n.label.split(' ') : [n.label];
      var labels = words.map(function (w, i) {
        var dy = 4 + (i - (words.length - 1) / 2) * 12;
        var t = svgEl('text', {
          x: cx,
          y: cy + dy,
          'text-anchor': 'middle',
          'font-family': 'var(--font-mono)',
          'font-size': '11',
          'font-weight': '500',
          fill: 'var(--ink-secondary)',
        });
        t.textContent = w;
        t.style.pointerEvents = 'none';
        return t;
      });

      g.appendChild(ring);
      g.appendChild(cap);
      labels.forEach(function (t) { g.appendChild(t); });

      g.addEventListener('click', function () { setSelected(n.id); });

      nodesLayer.appendChild(g);
      return { node: n, g: g, ring: ring, cap: cap, labels: labels };
    });

    // ---------- Render passes ----------
    function renderEdges() {
      var sel    = state.selectedId;
      var filter = state.clusterFilter;
      edgeEls.forEach(function (line) {
        var hot = sel && (line.__from === sel || line.__to === sel);
        var a = findNode(line.__from);
        var b = findNode(line.__to);
        // An edge is filtered out if either endpoint is outside the active cluster.
        var filteredOut = filter && (a.cluster !== filter || b.cluster !== filter);
        var dimmed = (sel && !hot) || (!sel && filteredOut);

        // Trim line endpoints to capsule perimeter so arrow tips meet edges.
        var ax = toX(a.x), ay = toY(a.y), bx = toX(b.x), by = toY(b.y);
        var dx = bx - ax, dy = by - ay;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / len, uy = dy / len;
        line.setAttribute('x1', ax + ux * capTrim(ux, uy));
        line.setAttribute('y1', ay + uy * capTrim(ux, uy));
        line.setAttribute('x2', bx - ux * capTrim(ux, uy));
        line.setAttribute('y2', by - uy * capTrim(ux, uy));

        line.setAttribute('stroke', hot ? 'var(--coral)' : 'var(--line)');
        line.setAttribute('stroke-width', hot ? '1.6' : '1');
        line.setAttribute('opacity', dimmed ? '0.22' : (hot ? '0.95' : '0.7'));
        line.setAttribute('marker-end', hot ? 'url(#llmmap-arr-hot)' : 'url(#llmmap-arr)');
      });
    }

    function renderNodes() {
      var sel    = state.selectedId;
      var filter = state.clusterFilter;
      var conn = sel ? connectedSet(sel) : {};
      nodeEls.forEach(function (ne) {
        var isSel         = ne.node.id === sel;
        var isConn        = !isSel && !!conn[ne.node.id];
        var isDimByFilter = filter && ne.node.cluster !== filter;

        // Dim an unrelated node only if a hot (selected-relationship) edge line
        // visually passes through its bounding box, which could be mistaken for
        // a connection. The coral border on selected/connected nodes is enough
        // to signal the active relationship without dimming everything else.
        var isDimByPassThrough = false;
        if (!isSel && !isConn && sel) {
          var cx  = toX(ne.node.x), cy = toY(ne.node.y);
          var hw  = CAP_W / 2;
          var pad = 4; // slight expansion so near-misses also trigger
          var bx1 = cx - hw - pad, by1 = cy - CAP_H / 2 - pad;
          var bx2 = cx + hw + pad, by2 = cy + CAP_H / 2 + pad;
          edgeEls.forEach(function (line) {
            if (isDimByPassThrough) return;
            if (line.__from !== sel && line.__to !== sel) return; // not a hot edge
            var ex1 = parseFloat(line.getAttribute('x1'));
            var ey1 = parseFloat(line.getAttribute('y1'));
            var ex2 = parseFloat(line.getAttribute('x2'));
            var ey2 = parseFloat(line.getAttribute('y2'));
            if (lineIntersectsRect(ex1, ey1, ex2, ey2, bx1, by1, bx2, by2)) {
              isDimByPassThrough = true;
            }
          });
        }

        var isDim = isDimByFilter || isDimByPassThrough;
        ne.g.setAttribute('opacity', isDim ? '0.35' : '1');

        // Outer ring shows only on the selected node.
        ne.ring.setAttribute('opacity', isSel ? '0.5' : '0');

        // Circle styling. We never fill with --coral directly because the
        // light-mode coral has poor contrast against any text; instead,
        // selected uses --coral-wash plus a thicker --coral border, and
        // connected uses --coral border on --paper-inset. Both states keep
        // text in --ink-primary so legibility holds in both palettes.
        if (isSel) {
          ne.cap.setAttribute('fill', 'var(--coral-wash)');
          ne.cap.setAttribute('stroke', 'var(--coral)');
          ne.cap.setAttribute('stroke-width', '2');
        } else if (isConn) {
          ne.cap.setAttribute('fill', 'var(--paper-raised)');
          ne.cap.setAttribute('stroke', 'var(--coral)');
          ne.cap.setAttribute('stroke-width', '1.5');
        } else {
          ne.cap.setAttribute('fill', 'var(--paper-raised)');
          ne.cap.setAttribute('stroke', 'var(--line)');
          ne.cap.setAttribute('stroke-width', '1');
        }

        ne.labels.forEach(function (t) {
          t.setAttribute('fill', isSel ? 'var(--ink-primary)' : 'var(--ink-secondary)');
        });
      });
    }

    function renderDetail() {
      var n = findNode(state.selectedId);
      if (!n) return;
      detailCard.innerHTML = '';

      var head = el('div', 'llmmap-detail-head');
      var clusterEl = el('span', 'llmmap-detail-cluster');
      clusterEl.textContent = CLUSTERS[n.cluster].label;
      head.appendChild(clusterEl);
      if (n.session) {
        var sessEl = el('span', 'llmmap-detail-session');
        sessEl.textContent = '→ Session ' + n.session;
        head.appendChild(sessEl);
      }
      detailCard.appendChild(head);

      var title = el('h3', 'llmmap-detail-title');
      title.textContent = n.label;
      detailCard.appendChild(title);

      var sum = el('p', 'llmmap-detail-summary');
      sum.textContent = n.summary;
      detailCard.appendChild(sum);

      var lens1 = el('div', 'llmmap-lens');
      var lab1 = el('div', 'llmmap-lens-label'); lab1.textContent = 'What happens';
      var bod1 = el('p', 'llmmap-lens-body');    bod1.textContent = n.plain;
      lens1.appendChild(lab1); lens1.appendChild(bod1);
      detailCard.appendChild(lens1);

      var lens2 = el('div', 'llmmap-lens');
      var lab2 = el('div', 'llmmap-lens-label'); lab2.textContent = 'By analogy';
      var bod2 = el('p', 'llmmap-lens-body feel'); bod2.textContent = n.feel;
      lens2.appendChild(lab2); lens2.appendChild(bod2);
      detailCard.appendChild(lens2);
    }

    function renderTabs() {
      Object.keys(clusterTabEls).forEach(function (k) {
        var isActive = (k === 'all') ? state.clusterFilter === null : state.clusterFilter === k;
        clusterTabEls[k].className = 'mcp-tab' + (isActive ? ' active' : '');
      });
    }

    function setClusterFilter(k) {
      state.clusterFilter = k; // null means "All"
      renderTabs();
      renderEdges();
      renderNodes();
    }

    function setSelected(id) {
      state.selectedId = id;
      renderEdges();
      renderNodes();
      renderDetail();
    }

    // Initial render
    setSelected(state.selectedId);
  };

})();
