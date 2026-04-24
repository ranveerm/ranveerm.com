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

  // Colours: semantic hues for the four outcome groups are kept from the
  // original (green/orange/red/blue carry information), surrounding chrome
  // retuned for the light site theme.
  var COLORS = {
    tp: '#22c55e',  // green   — true positive
    fn: '#f97316',  // orange  — false negative
    fp: '#ef4444',  // red     — false positive
    tn: '#3b82f6',  // blue    — true negative
    card: '#ffffff',
    cardBorder: 'rgba(106, 159, 181, 0.22)',
    hairline: 'rgba(106, 159, 181, 0.12)',
    text: '#333',
    muted: '#777',
    accent: '#6a9fb5'
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
      '.sensspec { max-width: 960px; margin: 0 auto; padding: 8px 0 24px; color: ' + COLORS.text + '; }',
      '.sensspec .sensspec-intro { text-align: center; color: ' + COLORS.muted + '; font-size: 0.92rem; max-width: 520px; margin: 0 auto 22px; line-height: 1.5; }',
      '.sensspec .sensspec-legend { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin-bottom: 22px; }',
      '.sensspec .sensspec-legend-item { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.8rem; color: ' + COLORS.muted + '; transition: opacity 0.25s ease; }',
      '.sensspec .sensspec-legend-swatch { width: 12px; height: 12px; }',
      '.sensspec .sensspec-legend-swatch.square { border-radius: 2px; }',
      '.sensspec .sensspec-legend-swatch.circle { border-radius: 50%; }',
      '.sensspec .sensspec-legend-shapes { width: 100%; text-align: center; font-size: 0.75rem; color: ' + COLORS.muted + '; }',
      /* 2x2 layout. align-items: stretch lets each row pull both cells
         to the taller side's height so the left-hand and right-hand cards
         line up. */
      '.sensspec .sensspec-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, auto); gap: 18px 22px; align-items: stretch; }',
      '@media (max-width: 720px) { .sensspec .sensspec-grid { grid-template-columns: 1fr; } }',
      '.sensspec .sensspec-card { background: ' + COLORS.card + '; border: 1px solid ' + COLORS.cardBorder + '; border-radius: 10px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; }',
      /* Sliders card: spread vertically so extra height stretches the
         gaps between sliders rather than leaving an empty block below. */
      '.sensspec .sensspec-card.sliders { justify-content: space-around; }',
      /* Population grid card: centre the SVG both axes so stretched height
         doesn\'t leave the dots floating at the top. */
      '.sensspec .sensspec-card.center { justify-content: center; align-items: center; }',
      /* Confusion-matrix card: centre vertically too, same reason. */
      '.sensspec .sensspec-card.matrix { justify-content: center; }',

      /* Slider */
      '.sensspec-slider { margin-bottom: 18px; }',
      '.sensspec-slider:last-child { margin-bottom: 0; }',
      '.sensspec-slider-row { display: flex; justify-content: space-between; margin-bottom: 6px; }',
      '.sensspec-slider-label { font-size: 0.82rem; font-weight: 600; color: ' + COLORS.text + '; }',
      '.sensspec-slider-value { font-size: 0.9rem; font-weight: 700; font-variant-numeric: tabular-nums; }',
      '.sensspec-slider input[type=range] { width: 100%; height: 5px; border-radius: 3px; appearance: none; -webkit-appearance: none; outline: none; cursor: pointer; }',
      '.sensspec-slider input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid ' + COLORS.accent + '; box-shadow: 0 1px 3px rgba(106,159,181,0.3); cursor: pointer; }',
      '.sensspec-slider input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid ' + COLORS.accent + '; cursor: pointer; }',

      /* Confusion matrix */
      '.sensspec-matrix-header { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 4px; margin-bottom: 4px; }',
      '.sensspec-matrix-header > div { text-align: center; color: ' + COLORS.muted + '; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.09em; padding: 6px 0; }',
      '.sensspec-matrix-row { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 4px; margin-bottom: 4px; }',
      '.sensspec-matrix-rowlabel { display: flex; align-items: center; justify-content: center; color: ' + COLORS.muted + '; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.09em; text-align: center; }',
      '.sensspec-matrix-cell { background: #fff; border: 2px solid ' + COLORS.cardBorder + '; border-radius: 10px; padding: 14px 10px; text-align: center; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease; }',
      '.sensspec-matrix-cell-count { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }',
      '.sensspec-matrix-cell-label { color: ' + COLORS.muted + '; font-size: 0.72rem; margin-top: 2px; }',

      /* Metrics — uniform heights within a row (and across rows) so the
         four cards form a clean 2x2 regardless of label length. */
      '.sensspec-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; grid-auto-rows: 1fr; align-items: stretch; }',
      '.sensspec-metric { background: ' + COLORS.card + '; border: 1px solid ' + COLORS.cardBorder + '; border-radius: 8px; padding: 12px 14px; transition: background 0.25s ease, border-color 0.25s ease; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px; }',
      '.sensspec-metric-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }',
      '.sensspec-metric-label { font-size: 0.82rem; font-weight: 600; color: ' + COLORS.text + '; }',
      '.sensspec-metric-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }',
      '.sensspec-metric-bar { height: 4px; border-radius: 2px; background: ' + COLORS.hairline + '; overflow: hidden; margin-bottom: 5px; }',
      '.sensspec-metric-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }',
      '.sensspec-metric-formula { color: ' + COLORS.muted + '; font-size: 0.72rem; font-family: ui-monospace, "SF Mono", Menlo, monospace; }',

      /* Explanation — spans the full container width beneath the two-column grid */
      '.sensspec-notes { margin-top: 18px; border: 1px solid ' + COLORS.cardBorder + '; border-radius: 10px; padding: 16px 20px; font-size: 0.88rem; line-height: 1.65; color: ' + COLORS.muted + '; background: ' + COLORS.card + '; }',
      '.sensspec-notes p { margin: 0 0 8px; }',
      '.sensspec-notes p:last-child { margin-bottom: 0; }',

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
    var state = {
      prevalence: 0.3,
      sensitivity: 0.85,
      specificity: 0.9,
      hovered: null
    };

    // --------------------------- intro & legend ------------------------
    root.appendChild(el('p', { class: 'sensspec-intro' },
      'Drag the sliders to see how a diagnostic test performs on a population of ' + TOTAL +
      ' people. Hover over the confusion matrix or the legend to highlight groups.'
    ));

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
    // Flat 2x2 CSS grid so each row can stretch independently — keeping
    // the sliders card and the matrix card at matching heights, and
    // likewise the population grid and the metrics cluster.
    var grid = el('div', { class: 'sensspec-grid' });
    root.appendChild(grid);

    // ------ sliders ------
    function buildSlider(key, label, color, min, max) {
      var valueSpan = el('span', { class: 'sensspec-slider-value', style: 'color:' + color }, '');
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
      return { wrap: wrap, input: input, value: valueSpan, color: color, min: min, max: max };
    }

    var prevalenceSlider  = buildSlider('prevalence',  'Prevalence',  COLORS.accent, 0.05, 0.95);
    var sensitivitySlider = buildSlider('sensitivity', 'Sensitivity', COLORS.tp,     0,    1);
    var specificitySlider = buildSlider('specificity', 'Specificity', COLORS.tn,     0,    1);

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

    // ------ metrics ------
    function buildMetric(label, formula, color) {
      var valueEl = el('span', { class: 'sensspec-metric-value', style: 'color:' + color }, '—');
      var barFill = el('div', { class: 'sensspec-metric-bar-fill', style: 'background:' + color + '; width: 0%' });
      var metric = el('div', { class: 'sensspec-metric' }, [
        el('div', { class: 'sensspec-metric-row' }, [
          el('span', { class: 'sensspec-metric-label' }, label),
          valueEl
        ]),
        el('div', { class: 'sensspec-metric-bar' }, barFill),
        el('div', { class: 'sensspec-metric-formula' }, formula)
      ]);
      return { el: metric, value: valueEl, bar: barFill, color: color };
    }

    var metrics = {
      sensitivity: buildMetric('Sensitivity', 'TP / (TP + FN)', COLORS.tp),
      specificity: buildMetric('Specificity', 'TN / (TN + FP)', COLORS.tn),
      ppv:         buildMetric('PPV',         'TP / (TP + FP)', '#d4a017'),
      npv:         buildMetric('NPV',         'TN / (TN + FN)', '#0899a9')
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
    root.appendChild(el('div', { class: 'sensspec-notes' }, [
      buildNote(COLORS.tp, 'Sensitivity',
        ' — Of all truly positive cases, what fraction does the classifier correctly flag?'),
      buildNote(COLORS.tn, 'Specificity',
        ' — Of all truly negative cases, what fraction does the classifier correctly leave alone?'),
      buildNote('#d4a017', 'PPV (Positive Predictive Value)',
        ' — When the classifier flags a case, what is the chance it is truly positive?'),
      buildNote('#0899a9', 'NPV (Negative Predictive Value)',
        ' — When the classifier leaves a case alone, what is the chance it is truly negative?')
    ]));

    function buildNote(color, name, rest) {
      return el('p', null, [
        el('strong', { style: 'color:' + color }, name),
        rest
      ]);
    }

    // ----------------------------- rendering ---------------------------
    function setSliderFill(s) {
      var pct = ((s.input.value - s.min) / (s.max - s.min)) * 100;
      s.input.style.background =
        'linear-gradient(to right, ' + s.color + ' ' + pct + '%, ' + COLORS.hairline + ' ' + pct + '%)';
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
        matrixCells[key].cell.style.borderColor =
          isHovered ? COLORS[key] : COLORS.cardBorder;
      });

      var sens = pop.sick    > 0 ? pop.tp / pop.sick    : NaN;
      var spec = pop.healthy > 0 ? pop.tn / pop.healthy : NaN;
      var ppv  = pop.tp + pop.fp > 0 ? pop.tp / (pop.tp + pop.fp) : NaN;
      var npv  = pop.tn + pop.fn > 0 ? pop.tn / (pop.tn + pop.fn) : NaN;

      setMetric(metrics.sensitivity, sens,
        state.hovered === 'tp' || state.hovered === 'fn');
      setMetric(metrics.specificity, spec,
        state.hovered === 'fp' || state.hovered === 'tn');
      setMetric(metrics.ppv, ppv, false);
      setMetric(metrics.npv, npv, false);

      renderPopulationGrid(pop, state.hovered);

      // Dim unselected legend items
      Array.prototype.forEach.call(legend.querySelectorAll('.sensspec-legend-item'), function(item) {
        item.style.opacity = (state.hovered && state.hovered !== item.dataset.key) ? 0.35 : 1;
      });
    }

    function setMetric(m, v, highlight) {
      m.value.textContent = isNaN(v) ? '—' : (v * 100).toFixed(1) + '%';
      m.bar.style.width   = (isNaN(v) ? 0 : v * 100) + '%';
      m.el.style.background  = highlight ? m.color + '14' : COLORS.card;
      m.el.style.borderColor = highlight ? m.color + '66' : COLORS.cardBorder;
    }

    function setHovered(key) {
      state.hovered = key;
      render();
    }

    render();
  };
})();
