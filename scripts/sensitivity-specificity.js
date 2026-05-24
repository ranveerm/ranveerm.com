// Interactive sensitivity & specificity widget.
// Vanilla JS port of the original React component. Renders a draggable-
// slider demo over a simulated population of 100 people, showing how
// prevalence / sensitivity / specificity translate to the confusion
// matrix and to PPV / NPV.
//
// Usage:  <div id="sensspec-demo"></div>
//         <script>createSensitivitySpecificity('sensspec-demo');</script>

(function() {
  var TOTAL = 100;

  // Categorical hues for the four outcome groups (kept from the original
  // -- they carry information). Chrome colours route through the design
  // language tokens declared in _sass/_theme.scss so dark-mode and any
  // future palette retune happens at the foundation layer.
  var COLORS = {
    tp: '#22c55e',  // green  - true positive
    fn: '#ef4444',  // red    - false negative
    fp: '#a855f7',  // purple - false positive
    tn: '#3b82f6',  // blue   - true negative
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

  // Styles now live in _sass/_theme.scss under "Widget specifics: Sensitivity & Specificity".

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
      previewed: null,
      pop: null    // last computed population; read by renderNotes() for live calculations
    };

    // Builds a 3-line calculation block for each metric:
    //   line 1 — abstract formula     TP / (TP + FN)
    //   line 2 — values substituted   72 / (72 + 13)
    //   line 3 — result               = 85.0%
    var METRIC_CALC = {
      sensitivity: function(p) {
        var num = p.tp, den = p.tp + p.fn;
        var pct = den > 0 ? (num / den * 100).toFixed(1) : '–';
        return 'TP / (TP + FN)\n' +
               p.tp + ' / (' + p.tp + ' + ' + p.fn + ')\n' +
               '= ' + pct + '%';
      },
      specificity: function(p) {
        var num = p.tn, den = p.tn + p.fp;
        var pct = den > 0 ? (num / den * 100).toFixed(1) : '–';
        return 'TN / (TN + FP)\n' +
               p.tn + ' / (' + p.tn + ' + ' + p.fp + ')\n' +
               '= ' + pct + '%';
      },
      ppv: function(p) {
        var num = p.tp, den = p.tp + p.fp;
        var pct = den > 0 ? (num / den * 100).toFixed(1) : '–';
        return 'TP / (TP + FP)\n' +
               p.tp + ' / (' + p.tp + ' + ' + p.fp + ')\n' +
               '= ' + pct + '%';
      },
      npv: function(p) {
        var num = p.tn, den = p.tn + p.fn;
        var pct = den > 0 ? (num / den * 100).toFixed(1) : '–';
        return 'TN / (TN + FN)\n' +
               p.tn + ' / (' + p.tn + ' + ' + p.fn + ')\n' +
               '= ' + pct + '%';
      }
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
    var notesTitleEl   = el('p', { class: 'sensspec-notes-title' }, '');
    var notesFormulaEl = el('pre', { class: 'role-code-block sensspec-notes-formula' }, '');
    var notesBodyEl    = el('p', { class: 'sensspec-notes-body' }, '');
    var notesHintEl    = el('p', { class: 'sensspec-notes-hint' },
      'Click a metric to lock its definition; hover to preview.');
    var notesPanel = el('div', { class: 'sensspec-notes' }, [
      notesTitleEl, notesFormulaEl, notesBodyEl, notesHintEl
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
      var cols = 10, gap = 32, dotSize = 17;
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
      state.pop = pop; // persist so renderNotes() can read live counts

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
        notesTitleEl.textContent   = METRIC_NOTES[active].title;
        notesFormulaEl.textContent = state.pop ? METRIC_CALC[active](state.pop) : '';
        notesBodyEl.textContent    = METRIC_NOTES[active].body;
        notesTitleEl.style.display   = '';
        notesFormulaEl.style.display = '';
        notesBodyEl.style.display    = '';
        notesHintEl.style.display    = 'none';
      } else {
        notesTitleEl.style.display   = 'none';
        notesFormulaEl.style.display = 'none';
        notesBodyEl.style.display    = 'none';
        notesHintEl.style.display    = '';
      }
    }

    function setHovered(key) {
      state.hovered = key;
      render();
    }

    render();
  };
})();
