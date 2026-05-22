// Interactive sensitivity & specificity widget.
// Vanilla JS port of the original React component. Renders a draggable-
// slider demo over a simulated population of 200 people, showing how
// prevalence / sensitivity / specificity translate to the confusion
// matrix and to PPV / NPV.
//
// Usage:  <div id="sensspec-demo"></div>
//         <script>createSensitivitySpecificity('sensspec-demo');</script>

(function() {
  var TOTAL = 200;

  // Categorical hues for the four outcome groups (kept from the original
  // -- they carry information). Chrome colours route through the design
  // language tokens declared in _sass/_theme.scss so dark-mode and any
  // future palette retune happens at the foundation layer.
  var COLORS = {
    tp: '#22c55e',  // green   - true positive
    fn: '#f97316',  // orange  - false negative
    fp: '#ef4444',  // red     - false positive
    tn: '#3b82f6',  // blue    - true negative
    card:       'var(--paper-raised)',
    cardBorder: 'var(--line)',
    hairline:   'var(--line)',
    text:       'var(--ink-primary)',
    muted:      'var(--ink-muted)',
    accent:     'var(--coral)'
  };

  var LABELS = {
    tp: 'True Positive',
    fn: 'False Negative',
    fp: 'False Positive',
    tn: 'True Negative'
  };

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      /* Widget root -- inherits font-text from the design language. */
      '.sensspec { max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: var(--ink-primary); font-family: var(--font-text); }',
      /* post.body baseline for the intro paragraph. */
      '.sensspec .sensspec-intro { text-align: center; color: var(--ink-secondary); font-family: var(--font-display); font-size: var(--size-md); max-width: 60ch; margin: 0 auto 22px; line-height: var(--lh-normal); }',
      '.sensspec .sensspec-legend { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin-bottom: 22px; }',
      '.sensspec .sensspec-legend-item { display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-muted); transition: opacity 0.25s ease; }',
      '.sensspec .sensspec-legend-swatch { width: 12px; height: 12px; }',
      '.sensspec .sensspec-legend-swatch.square { border-radius: 2px; }',
      '.sensspec .sensspec-legend-swatch.circle { border-radius: 50%; }',
      '.sensspec .sensspec-legend-shapes { width: 100%; text-align: center; font-family: var(--font-text); font-size: var(--size-xs); color: var(--ink-faint); letter-spacing: var(--track-eyebrow); text-transform: uppercase; }',
      /* 2x2 layout. align-items: stretch lets each row pull both cells
         to the taller side\'s height so the left-hand and right-hand cards
         line up. */
      '.sensspec .sensspec-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, auto); gap: 18px 22px; align-items: stretch; }',
      '@media (max-width: 720px) { .sensspec .sensspec-grid { grid-template-columns: 1fr; } }',
      /* viz.frame: paper-raised, line border, radius 10. */
      '.sensspec .sensspec-card { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; }',
      /* Sliders card: spread vertically so extra height stretches the
         gaps between sliders rather than leaving an empty block below. */
      '.sensspec .sensspec-card.sliders { justify-content: space-around; }',
      /* Population grid card: centre the SVG both axes so stretched height
         doesn\'t leave the dots floating at the top. */
      '.sensspec .sensspec-card.center { justify-content: center; align-items: center; }',
      /* Confusion-matrix card: centre vertically too, same reason. */
      '.sensspec .sensspec-card.matrix { justify-content: center; }',

      /* Slider -- viz.row-title for the label, mono for the value. */
      '.sensspec-slider { margin-bottom: 18px; }',
      '.sensspec-slider:last-child { margin-bottom: 0; }',
      '.sensspec-slider-row { display: flex; justify-content: space-between; margin-bottom: 6px; }',
      '.sensspec-slider-label { font-family: var(--font-display); font-size: var(--size-md); font-weight: 500; color: var(--ink-primary); letter-spacing: var(--track-snug); }',
      '.sensspec-slider-value { font-family: var(--font-mono); font-size: var(--size-md); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-primary); }',
      /* Neutral slider styling that matches the MCP post: native accent-color
         routed through --ink-muted, no per-slider categorical hues. */
      '.sensspec-slider input[type=range] { width: 100%; accent-color: var(--ink-muted); cursor: pointer; }',

      /* Confusion matrix -- viz.section-label for headers / row labels. */
      '.sensspec-matrix-header { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 4px; margin-bottom: 4px; }',
      '.sensspec-matrix-header > div { text-align: center; color: var(--ink-faint); font-family: var(--font-mono); font-size: var(--size-xs); text-transform: uppercase; letter-spacing: var(--track-eyebrow); padding: 6px 0; }',
      '.sensspec-matrix-row { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 4px; margin-bottom: 4px; }',
      '.sensspec-matrix-rowlabel { display: flex; align-items: center; justify-content: center; color: var(--ink-faint); font-family: var(--font-mono); font-size: var(--size-xs); text-transform: uppercase; letter-spacing: var(--track-eyebrow); text-align: center; }',
      /* Higher-contrast border (--ink-faint) so the cells don\'t fade into the card on cooler graphite. */
      '.sensspec-matrix-cell { background: var(--paper-raised); border: 2px solid var(--ink-faint); border-radius: 10px; padding: 14px 10px; text-align: center; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease; }',
      '.sensspec-matrix-cell-count { font-family: var(--font-mono); font-size: 1.5rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-primary); }',
      '.sensspec-matrix-cell-label { color: var(--ink-muted); font-family: var(--font-text); font-size: var(--size-xs); margin-top: 2px; }',

      /* Metric cells -- default visual matches the confusion-matrix cells.
         Highlight states adopt the LAYER ROWS recipe from the Claude Code
         Environment widget (viz.row-hover and viz.row-selected): the
         preview lifts the background to paper-inset, and the locked
         selection adds a coral inset rail on the left edge. */
      '.sensspec-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; grid-auto-rows: 1fr; align-items: stretch; }',
      '.sensspec-metric-cell { background: var(--paper-raised); border: 2px solid var(--ink-faint); border-radius: 10px; padding: 14px 10px; text-align: center; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; display: flex; flex-direction: column; justify-content: center; }',
      '.sensspec-metric-cell.is-previewed { background: var(--paper-inset); border-color: var(--ink-faint); }',
      '.sensspec-metric-cell.is-selected { background: var(--paper-inset); border-color: var(--ink-muted); box-shadow: inset 3px 0 0 var(--coral); }',
      '.sensspec-metric-value { font-family: var(--font-mono); font-size: 1.5rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-primary); }',
      '.sensspec-metric-label { color: var(--ink-muted); font-family: var(--font-text); font-size: var(--size-xs); margin-top: 2px; }',

      /* Notes panel -- single live entry, driven by the active metric cell.
         Title matches the inspector section-label recipe (e.g. the "Intent"
         heading inside the Claude Code Environment widget's layer 1
         inspector view): display, size-h2b, weight 500, lh-snug, track-snug,
         ink-primary. Body uses post.body. Empty state shows a muted hint. */
      '.sensspec-notes { margin-top: 18px; border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; background: var(--paper-raised); min-height: 84px; }',
      '.sensspec-notes-title { font-family: var(--font-display); font-size: var(--size-h2b); font-weight: 500; line-height: var(--lh-snug); letter-spacing: var(--track-snug); color: var(--ink-primary); margin: 0 0 8px; }',
      '.sensspec-notes-body { font-family: var(--font-display); font-size: var(--size-md); line-height: var(--lh-normal); color: var(--ink-secondary); margin: 0; }',
      '.sensspec-notes-hint { font-family: var(--font-text); font-size: var(--size-smd); color: var(--ink-faint); margin: 0; font-style: italic; }',

      /* Dot-grid SVG */
      '.sensspec-popgrid { width: 100%; max-width: 460px; height: auto; }',
      '.sensspec-popgrid .sensspec-dot { transition: opacity 0.3s ease; }'
    ].join('\n');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function generatePopulation(prev, sens, spec) {
    var sick = Math.round(TOTAL * prev);
    var healthy = TOTAL - sick;
    var tp = Math.round(sick * sens);
    var fn = sick - tp;
    var tn = Math.round(healthy * spec);
    var fp = healthy - tn;
    return { tp: tp, fn: fn, fp: fp, tn: tn, sick: sick, healthy: healthy };
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'style') e.style.cssText = attrs[k];
        else if (k.substr(0, 2) === 'on') e.addEventListener(k.substr(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function(c) {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  window.createSensitivitySpecificity = function(containerId) {
    injectStyles();
    var root = document.getElementById(containerId);
    if (!root) return;
    root.classList.add('sensspec');

    // ------------------------------- state -----------------------------
    // `hovered`   - active confusion-matrix cell (drives population-grid dimming).
    // `selected`  - locked metric cell (persists until clicked again).
    // `previewed` - transient metric cell under the cursor (overrides selected
    //               for the notes panel, reverts on mouseleave).
    var state = {
      prevalence: 0.3,
      sensitivity: 0.85,
      specificity: 0.9,
      hovered: null,
      selected: null,
      previewed: null
    };

    var METRIC_NOTES = {
      sensitivity: {
        title: 'Sensitivity',
        body: 'Of all truly positive cases, what fraction does the classifier correctly flag?'
      },
      specificity: {
        title: 'Specificity',
        body: 'Of all truly negative cases, what fraction does the classifier correctly leave alone?'
      },
      ppv: {
        title: 'PPV (Positive Predictive Value)',
        body: 'When the classifier flags a case, what is the chance it is truly positive?'
      },
      npv: {
        title: 'NPV (Negative Predictive Value)',
        body: 'When the classifier leaves a case alone, what is the chance it is truly negative?'
      }
    };

    // --------------------------- legend --------------------------------
    var legend = el('div', { class: 'sensspec-legend' });
    ['tp', 'fn', 'fp', 'tn'].forEach(function(key) {
      var isPositive = key === 'tp' || key === 'fp';
      var item = el('div', { class: 'sensspec-legend-item' }, [
        el('span', {
          class: 'sensspec-legend-swatch ' + (isPositive ? 'square' : 'circle'),
          style: 'background:' + COLORS[key]
        }),
        el('span', null, LABELS[key])
      ]);
      item.addEventListener('mouseenter', function() { setHovered(key); });
      item.addEventListener('mouseleave', function() { setHovered(null); });
      item.dataset.key = key;
      legend.appendChild(item);
    });
    legend.appendChild(el('div', { class: 'sensspec-legend-shapes' },
      '■ = test positive   ● = test negative'));
    root.appendChild(legend);

    // ---------------------------- main grid ----------------------------
    // Flat 2x2 CSS grid so each row can stretch independently - keeping
    // the sliders card and the matrix card at matching heights, and
    // likewise the population grid and the metrics cluster.
    var grid = el('div', { class: 'sensspec-grid' });
    root.appendChild(grid);

    // ------ sliders ------
    // Neutral styling now: no per-slider hue. The track uses the browser's
    // native rendering with accent-color: var(--ink-muted) applied via CSS.
    function buildSlider(key, label, min, max) {
      var valueSpan = el('span', { class: 'sensspec-slider-value' }, '');
      var input = el('input', {
        type: 'range', min: String(min), max: String(max), step: '0.01',
        value: String(state[key])
      });
      input.addEventListener('input', function() {
        state[key] = parseFloat(input.value);
        render();
      });
      var wrap = el('div', { class: 'sensspec-slider' }, [
        el('div', { class: 'sensspec-slider-row' }, [
          el('span', { class: 'sensspec-slider-label' }, label),
          valueSpan
        ]),
        input
      ]);
      return { wrap: wrap, input: input, value: valueSpan, min: min, max: max };
    }

    var prevalenceSlider  = buildSlider('prevalence',  'Prevalence',  0.05, 0.95);
    var sensitivitySlider = buildSlider('sensitivity', 'Sensitivity', 0,    1);
    var specificitySlider = buildSlider('specificity', 'Specificity', 0,    1);

    var slidersCard = el('div', { class: 'sensspec-card sliders' }, [
      prevalenceSlider.wrap, sensitivitySlider.wrap, specificitySlider.wrap
    ]);

    // ------ population grid ------
    var popCard = el('div', { class: 'sensspec-card center' });
    var popSvg  = svgEl('svg', { class: 'sensspec-popgrid' });
    popCard.appendChild(popSvg);

    // ------ confusion matrix ------
    var matrixContainer = el('div', null);
    var matrixCells = {};
    var headerRow = el('div', { class: 'sensspec-matrix-header' }, [
      el('div', null, ''),
      el('div', null, 'Predicted +'),
      el('div', null, 'Predicted −')
    ]);
    matrixContainer.appendChild(headerRow);

    [['Actually +', ['tp', 'fn']], ['Actually \u2212', ['fp', 'tn']]].forEach(function(row) {
      var r = el('div', { class: 'sensspec-matrix-row' });
      r.appendChild(el('div', { class: 'sensspec-matrix-rowlabel' }, row[0]));
      row[1].forEach(function(key) {
        var countEl = el('div', { class: 'sensspec-matrix-cell-count', style: 'color:' + COLORS[key] }, '0');
        var cell = el('div', { class: 'sensspec-matrix-cell' }, [
          countEl,
          el('div', { class: 'sensspec-matrix-cell-label' }, LABELS[key])
        ]);
        cell.addEventListener('mouseenter', function() { setHovered(key); });
        cell.addEventListener('mouseleave', function() { setHovered(null); });
        matrixCells[key] = { cell: cell, count: countEl };
        r.appendChild(cell);
      });
      matrixContainer.appendChild(r);
    });

    var matrixCard = el('div', { class: 'sensspec-card matrix' }, matrixContainer);

    // ------ metric cells ------
    // Mirrors the confusion-matrix cell shape (paper-raised + ink-faint border,
    // mono value, muted label). Click toggles a sticky selection; hover sets
    // a transient preview that overrides the selection for the notes panel.
    function buildMetricCell(key, label) {
      var valueEl = el('div', { class: 'sensspec-metric-value' }, '-');
      var labelEl = el('div', { class: 'sensspec-metric-label' }, label);
      var cell = el('div', { class: 'sensspec-metric-cell' }, [valueEl, labelEl]);
      cell.addEventListener('mouseenter', function() {
        state.previewed = key;
        renderNotes();
        renderMetricStates();
      });
      cell.addEventListener('mouseleave', function() {
        state.previewed = null;
        renderNotes();
        renderMetricStates();
      });
      cell.addEventListener('click', function() {
        state.selected = (state.selected === key) ? null : key;
        renderNotes();
        renderMetricStates();
      });
      return { el: cell, value: valueEl, key: key };
    }

    var metrics = {
      sensitivity: buildMetricCell('sensitivity', 'Sensitivity'),
      specificity: buildMetricCell('specificity', 'Specificity'),
      ppv:         buildMetricCell('ppv',         'PPV'),
      npv:         buildMetricCell('npv',         'NPV')
    };

    var metricsGrid = el('div', { class: 'sensspec-metrics' }, [
      metrics.sensitivity.el, metrics.specificity.el, metrics.ppv.el, metrics.npv.el
    ]);

    // Populate the outer grid in row-major order: (sliders, matrix) / (popgrid, metrics)
    grid.appendChild(slidersCard);
    grid.appendChild(matrixCard);
    grid.appendChild(popCard);
    grid.appendChild(metricsGrid);

    // ------ explanation (spans full width below the two-column grid) ------
    // Single live note: shows the previewed metric (if hovering) else the
    // selected metric (if locked) else a muted placeholder hint.
    var notesTitleEl = el('p', { class: 'sensspec-notes-title' }, '');
    var notesBodyEl  = el('p', { class: 'sensspec-notes-body' }, '');
    var notesHintEl  = el('p', { class: 'sensspec-notes-hint' },
      'Click a metric to lock its definition; hover to preview.');
    var notesPanel = el('div', { class: 'sensspec-notes' }, [
      notesTitleEl, notesBodyEl, notesHintEl
    ]);
    root.appendChild(notesPanel);

    // ----------------------------- rendering ---------------------------
    // Sliders are styled natively (accent-color), so the renderer only
    // needs to keep the trailing % readout in sync with the input value.
    function setSliderFill(s) {
      s.value.textContent = Math.round(parseFloat(s.input.value) * 100) + '%';
    }

    function renderPopulationGrid(pop, hovered) {
      while (popSvg.firstChild) popSvg.removeChild(popSvg.firstChild);
      var cols = 20, gap = 22, dotSize = 14;
      var total = pop.tp + pop.fn + pop.fp + pop.tn;
      var rows = Math.ceil(total / cols);
      popSvg.setAttribute('viewBox', '-4 -4 ' + (cols * gap + 8) + ' ' + (rows * gap + 8));

      var order = [];
      function push(type, n) { for (var i = 0; i < n; i++) order.push(type); }
      push('tp', pop.tp); push('fn', pop.fn); push('fp', pop.fp); push('tn', pop.tn);

      order.forEach(function(type, i) {
        var x = (i % cols) * gap + gap / 2;
        var y = Math.floor(i / cols) * gap + gap / 2;
        var dimmed = hovered && hovered !== type;
        var g = svgEl('g', {
          transform: 'translate(' + x + ', ' + y + ')',
          class: 'sensspec-dot',
          style: 'opacity:' + (dimmed ? 0.15 : 1)
        });
        var isPositive = type === 'tp' || type === 'fp';
        if (isPositive) {
          g.appendChild(svgEl('rect', {
            x: -dotSize / 2, y: -dotSize / 2,
            width: dotSize, height: dotSize,
            rx: 2, fill: COLORS[type], opacity: 0.9
          }));
        } else {
          g.appendChild(svgEl('circle', { r: dotSize / 2, fill: COLORS[type], opacity: 0.9 }));
        }
        popSvg.appendChild(g);
      });
    }

    function render() {
      setSliderFill(prevalenceSlider);
      setSliderFill(sensitivitySlider);
      setSliderFill(specificitySlider);

      var pop = generatePopulation(state.prevalence, state.sensitivity, state.specificity);

      ['tp', 'fn', 'fp', 'tn'].forEach(function(key) {
        matrixCells[key].count.textContent = pop[key];
        var isHovered = state.hovered === key;
        matrixCells[key].cell.style.background =
          isHovered ? COLORS[key] + '22' : COLORS.card;
        // Default border is the higher-contrast --ink-faint so cells
        // separate cleanly from the paper-raised card on dark mode;
        // hover swap to the categorical hue keeps the highlight legible.
        matrixCells[key].cell.style.borderColor =
          isHovered ? COLORS[key] : 'var(--ink-faint)';
      });

      var sens = pop.sick    > 0 ? pop.tp / pop.sick    : NaN;
      var spec = pop.healthy > 0 ? pop.tn / pop.healthy : NaN;
      var ppv  = pop.tp + pop.fp > 0 ? pop.tp / (pop.tp + pop.fp) : NaN;
      var npv  = pop.tn + pop.fn > 0 ? pop.tn / (pop.tn + pop.fn) : NaN;

      setMetricValue(metrics.sensitivity, sens);
      setMetricValue(metrics.specificity, spec);
      setMetricValue(metrics.ppv, ppv);
      setMetricValue(metrics.npv, npv);

      renderMetricStates();
      renderNotes();

      renderPopulationGrid(pop, state.hovered);

      // Dim unselected legend items
      Array.prototype.forEach.call(legend.querySelectorAll('.sensspec-legend-item'), function(item) {
        item.style.opacity = (state.hovered && state.hovered !== item.dataset.key) ? 0.35 : 1;
      });
    }

    function setMetricValue(m, v) {
      m.value.textContent = isNaN(v) ? '-' : (v * 100).toFixed(1) + '%';
    }

    // Apply preview/selected class state to each metric cell. Kept separate
    // from setMetricValue so cell hover/click handlers can repaint the
    // selection without recomputing the underlying population numbers.
    function renderMetricStates() {
      Object.keys(metrics).forEach(function(key) {
        var cell = metrics[key].el;
        cell.classList.toggle('is-selected', state.selected === key);
        cell.classList.toggle('is-previewed',
          state.previewed === key && state.selected !== key);
      });
    }

    // Notes panel content reflects the active metric: hover preview wins
    // over a locked selection; when neither is set, show the muted hint.
    function renderNotes() {
      var active = state.previewed || state.selected;
      if (active && METRIC_NOTES[active]) {
        notesTitleEl.textContent = METRIC_NOTES[active].title;
        notesBodyEl.textContent  = METRIC_NOTES[active].body;
        notesTitleEl.style.display = '';
        notesBodyEl.style.display  = '';
        notesHintEl.style.display  = 'none';
      } else {
        notesTitleEl.style.display = 'none';
        notesBodyEl.style.display  = 'none';
        notesHintEl.style.display  = '';
      }
    }

    function setHovered(key) {
      state.hovered = key;
      render();
    }

    render();
  };
})();
