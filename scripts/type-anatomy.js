/*
 * type-anatomy.js -- interactive field guide to letterform anatomy for the
 * "Components of a Type" post. Vanilla-JS widget: this file only builds DOM
 * and assigns class names; every paint value lives in _sass/_theme.scss under
 * "Widget specifics: type anatomy".
 *
 * Component locations are measured, not guessed. The specimen glyph is drawn
 * to an offscreen canvas in stage coordinates, and each term derives its
 * highlight region from that render:
 *   - reference lines come from canvas TextMetrics of canonical glyphs
 *     ('x' for x-height, 'H' for cap height, 'h' ascender, 'p' descender),
 *     so the guides sit exactly on the rendered font's real metrics;
 *   - stroke positions (stems, bars, counters, serifs) come from scanning
 *     ink runs in the pixel data, so the highlight snaps to the actual
 *     letterform of whatever serif face the reader's system renders.
 * The highlight itself is a coral copy of the same glyph clipped to the
 * measured region, so it tracks the letter's contour precisely.
 *
 * The specimen is set in a serif stack (Georgia) because serif-dependent
 * anatomy (serifs, brackets, ball terminals, contrast) needs a serif face;
 * the SERIF constant below must match --ta-serif in _sass/_theme.scss.
 */
(function () {
  'use strict';

  var SERIF = 'Georgia, "Times New Roman", Times, serif';
  // Swash forms simply do not exist in a text serif, so the one term that is
  // about them borrows a calligraphic face for its specimen. Snell Roundhand
  // leads the stack: its rounded, flowing Q reads as a flourish, where Apple
  // Chancery's angular loop looks harsh at specimen size. Must match
  // --ta-swash in _sass/_theme.scss.
  var SWASH = '"Snell Roundhand", "Apple Chancery", "Monotype Corsiva", "Lucida Calligraphy", cursive';
  // The body serif's G has no spur worth pointing at: its stem simply melts
  // into the bowl. Didot draws a pronounced one, so the spur borrows it, the
  // same way the swash borrows a calligraphic face. Must match --ta-didot in
  // _sass/_theme.scss.
  var DIDOT = 'Didot, "Bodoni 72", "Playfair Display", Georgia, serif';
  // Stress is a property of a typeface, not of a letter, so it can only be
  // shown by comparison. These two are the classic pair: an old-style face
  // leans its axis (Palatino measures about 11 degrees off vertical), a
  // modern one stands it upright (Bodoni measures 0). Must match
  // --ta-oldstyle / --ta-modern in _sass/_theme.scss.
  var OLDSTYLE = 'Palatino, "Palatino Linotype", "Iowan Old Style", "Times New Roman", Georgia, serif';
  var MODERN = '"Bodoni 72", Didot, "Playfair Display", Georgia, serif';
  var FACES = { swash: SWASH, didot: DIDOT, oldstyle: OLDSTYLE, modern: MODERN };
  var S = 470;             // default specimen font-size (stage units)
  var BASE_Y = 480;        // baseline y in stage coordinates
  var CX = 404;            // specimen horizontal centre
  var W = 850, H = 700;    // measurement canvas (stage coordinate space)

  // Every category is itself selectable: choosing one shows its description
  // in the inspector (no specimen letters, just prose) over a guides-only
  // stage. The old umbrella terms (Stroke, Terminal) folded into their
  // category's desc, so the general concept is described at the category
  // level and only genuine parts appear as pills.
  var CATS = [
    { id: 'ref',  label: 'Reference Lines',
      desc: 'The invisible horizontal guides that letterforms align to. Each anchors a different part of the alphabet, so capitals hang from the cap height, the lowercase body lives between the baseline and the x-height, and extenders reach for the outer lines.' },
    { id: 'ext',  label: 'Extenders',
      desc: 'The parts of lowercase letters that reach beyond the body, where [[Ascender|ascenders]] rise above the x-height and [[Descender|descenders]] drop below the baseline.' },
    { id: 'str',  label: 'Strokes',
      desc: 'General term for the lines that appear in a letter, be they straight, curved, thin or thick. Every letterform is assembled from them.' },
    { id: 'cur',  label: 'Curves & Flourishes',
      desc: 'The sweeping strokes, meaning central spines, hooks that lead into terminals, and ornamental swashes.' },
    { id: 'pts',  label: 'Points & Junctions',
      desc: 'The places where strokes meet or spring from one another, giving peaks, troughs, spurs, and the fillets that smooth the joins.' },
    { id: 'term', label: 'Terminals',
      desc: 'The ways a stroke ends when it carries no serif, in that it may stop plainly, taper away, or finish in a shape such as a ball.' },
    { id: 'spc',  label: 'Space & Contrast',
      desc: 'Not the ink but the space it shapes, meaning the white fully enclosed by a letter, and the openings that partly enclosed forms leave.' },
    { id: 'spacing', label: 'Spacing & Setting',
      desc: 'Concepts that only exist between glyphs, namely the space separating a pair of letters, and the space separating lines of type.' },
    { id: 'rel',  label: 'Related Terms',
      desc: 'The remaining vocabulary, covering serifs and the small distinctive strokes that give individual letters their character.' },
  ];

  // Shape helpers used by the per-term shape() functions. All coordinates
  // arrive from measured geometry (G), never hand-placed constants.
  function rc(x0, x1, y0, y1) { return { k: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
  function mid(iv) { return (iv[0] + iv[1]) / 2; }
  function poly(left, right) {
    if (left.length < 2) return null;
    return left.concat(right.slice().reverse())
      .map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
  }

  // Trace the one ink run containing xSeed at each sampled row between y0 and
  // y1. A serif, beak or ball at the end of the stroke is contiguous with it,
  // so it widens that run and comes along: this is what makes an extender's
  // highlight cover the whole extender rather than just its shaft. Where the
  // run balloons past maxW the stroke has fused with a neighbour (an n's
  // shoulder at x-height, say) and the band is clamped around the seed
  // instead of swallowing the neighbour.
  function seedBand(G, y0, y1, xSeed, pad, maxW) {
    var left = [], right = [], n = 64, i;
    for (i = 0; i <= n; i++) {
      var y = y0 + (y1 - y0) * (i / n), hit = null;
      G.runs(y).forEach(function (iv) { if (xSeed >= iv[0] - 3 && xSeed <= iv[1] + 3) hit = iv; });
      if (!hit) continue;
      var a = hit[0], b = hit[1];
      if (maxW && b - a > maxW) { a = Math.max(a, xSeed - maxW / 2); b = Math.min(b, xSeed + maxW / 2); }
      left.push([a - pad, y]); right.push([b + pad, y]);
    }
    capBand(left, right, pad);
    return poly(left, right);
  }

  // Extend a traced band past its first and last sampled rows by `pad`,
  // holding the x-extents of those rows. A serif tip or foot tapers to a
  // point between sampled rows, so without this the flat top of the band
  // slices a sliver off the very end of the stroke.
  function capBand(left, right, pad) {
    if (left.length < 2) return;
    var lf = left[0], rf = right[0], ll = left[left.length - 1], rl = right[right.length - 1];
    left.unshift([lf[0], lf[1] - pad]);   right.unshift([rf[0], rf[1] - pad]);
    left.push([ll[0], ll[1] + pad]);      right.push([rl[0], rl[1] + pad]);
  }

  // Trace a stroke whose horizontal position drifts as it descends, by
  // following a seed that interpolates from (x0, y0) to (x1, y1) and taking
  // whichever ink run on each row sits closest to it. A fixed seed cannot
  // follow a diagonal sweep: on the rows where the stroke has travelled far
  // from the seed the seed misses every run, and the trace stops early.
  function seekBand(G, y0, y1, x0, x1, pad) {
    var left = [], right = [], n = 64, i;
    for (i = 0; i <= n; i++) {
      var t = i / n, y = y0 + (y1 - y0) * t, seed = x0 + (x1 - x0) * t;
      var row = G.runs(y);
      if (!row.length) continue;
      var best = null, bd = Infinity;
      row.forEach(function (iv) {
        var d = Math.abs(mid(iv) - seed);
        if (d < bd) { bd = d; best = iv; }
      });
      left.push([best[0] - pad, y]); right.push([best[1] + pad, y]);
    }
    capBand(left, right, pad);
    return poly(left, right);
  }

  // Trace one of a row's ink runs, chosen by `pick`, down a span of rows.
  // Rows where the runs fuse into fewer than `minRuns` pieces are skipped and
  // the polygon bridges them in a straight line, which is exactly right when
  // the stroke being traced is itself straight (an A's diagonal crossing its
  // own crossbar, for instance).
  function pickBand(G, y0, y1, minRuns, pick, pad) {
    var left = [], right = [], n = 64, i, k;
    var step = (y1 - y0) / n;
    for (i = 0; i <= n; i++) {
      var y = y0 + step * i, a = null, b = null;
      // Union the run across the slice this sample stands for rather than
      // reading a single row. A serif's corner can turn within one unit,
      // far inside the sampling step, and straight-line interpolation
      // between two samples then cuts the corner off: taking the widest
      // run in the slice guarantees the band never falls inside the ink.
      for (k = -0.5; k <= 0.5; k += 0.25) {
        var row = G.runs(y + step * k);
        if (row.length < minRuns) continue;
        var iv = pick(row);
        if (a === null || iv[0] < a) a = iv[0];
        if (b === null || iv[1] > b) b = iv[1];
      }
      if (a === null) continue;
      left.push([a - pad, y]); right.push([b + pad, y]);
    }
    capBand(left, right, pad);
    return { points: poly(left, right), left: left, right: right };
  }

  // The inter-letter region of a kerning pair, traced row by row: at each
  // sampled height the region runs from the rightmost ink of the left letter
  // to the leftmost ink of the right letter (runs are grouped by which side
  // of the pair's own boundary, the measured advance width of the first
  // character, they fall on). The resulting polygon hugs both letters'
  // contours, following the A's right diagonal down and the V's left
  // diagonal up, instead of a straight-sided band that would overlap one
  // letter and miss space beside the other.
  function gapRegion(G) {
    var splitX = G.originX + G.measure(G.pairFirst);
    var left = [], right = [], n = 48, i, j;
    for (i = 0; i <= n; i++) {
      var y = G.L.cap + (G.L.base - G.L.cap) * (i / n);
      var row = G.runs(y);
      if (row.length < 2) continue;
      // Kerning can pull the second letter left of the first's advance
      // width, so runs cannot be classified by which side of the boundary
      // they fall on: instead take the white gap between adjacent runs
      // that lies closest to the boundary. That is the inter-letter gap
      // even where a diagonal has crossed the nominal split.
      var best = null, bestd = Infinity;
      for (j = 0; j < row.length - 1; j++) {
        var gl = row[j][1], gr = row[j + 1][0];
        if (gr - gl < 6) continue;
        var d = splitX < gl ? gl - splitX : (splitX > gr ? splitX - gr : 0);
        if (d < bestd) { bestd = d; best = [gl, gr]; }
      }
      if (best) { left.push([best[0] + 2, y]); right.push([best[1] - 2, y]); }
    }
    return poly(left, right);
  }

  // Trace the inner hole of a closed letterform (an o's counter): rows with
  // at least two ink runs contribute the gap between the first run's right
  // edge and the last run's left edge, so the filled polygon follows the
  // counter's real contour rather than approximating it with an ellipse.
  function holeBand(G, y0, y1) {
    var left = [], right = [], n = 64, i;
    for (i = 0; i <= n; i++) {
      var y = y0 + (y1 - y0) * (i / n), row = G.runs(y);
      if (row.length < 2) continue;
      left.push([row[0][1], y]); right.push([row[row.length - 1][0], y]);
    }
    return poly(left, right);
  }

  // Each term: category, name, sample letters, specimen glyph, active guides,
  // definition, and shape(G) returning { clips, deco, nodes } in stage
  // coordinates derived from the measured geometry G (see measure()).
  var TERMS = [
    // Reference lines
    // Baseline's whole concept IS the guide line already drawn behind every
    // specimen: no separate highlight to add, just let the guide itself
    // carry the emphasis.
    { cat: 'ref', name: 'Baseline', letters: 'R g y', spec: 'R', guides: ['base'],
      def: "The invisible line the letters stand on. Almost every character rests here and it's the anchor that keeps a line of type visually level.",
      shape: function (G) { return { clips: [], deco: [], nodes: [] }; } },
    // Every Reference Lines term names a span between guides that are
    // already drawn on the stage by default (the specimen letter is chosen
    // specifically to touch that guide, e.g. 'x' sits exactly on the
    // x-height line). No separate highlight is needed on top: both guides
    // in the span are emphasised instead, same as Baseline.
    { cat: 'ref', name: 'X-height', letters: 'x n o', spec: 'x', guides: ['xh', 'base'],
      def: 'The height of the lowercase body, measured from the [[Baseline|baseline]] to the top of a letter like x, with [[Ascender|ascenders]] and [[Descender|descenders]] left out.',
      shape: function (G) { return { clips: [], deco: [], nodes: [] }; } },
    { cat: 'ref', name: 'Cap height', letters: 'H E I', spec: 'H', guides: ['cap', 'base'],
      def: 'The distance from the [[Baseline|baseline]] to the top of the capitals.',
      shape: function (G) { return { clips: [], deco: [], nodes: [] }; } },
    { cat: 'ref', name: 'Ascender line', letters: 'h b l', spec: 'h', guides: ['asc'],
      def: 'The upper guide marking how far the tallest lowercase [[Strokes|strokes]] reach.',
      shape: function (G) { return { clips: [], deco: [], nodes: [] }; } },
    // Stress is a reference axis rather than a piece of ink, so it draws no
    // shaded region: just the dashed axis through the letter's thinnest
    // points. It also needs two specimens in two faces to make its point,
    // so like Leading it bypasses the single-specimen pipeline (see
    // buildStressStage).
    { cat: 'ref', name: 'Stress', letters: 'o', spec: 'o', stress: true, guides: [],
      def: 'The axis specifying the location of transition from thin to thick stroke. An old-style face leans that axis, and a modern one stands it upright',
      shape: function () { return { clips: [], deco: [], nodes: [] }; } },

    // Extenders (and every category below it): the coral region drawn on
    // the glyph itself is the highlight, so no guide is emphasised here --
    // guide emphasis is reserved for the Reference Lines terms above, which
    // measure a distance/line rather than highlight a region.
    // Extenders are traced rather than boxed: the beak at the top of the
    // ascender and the foot serif under the descender flare wider than the
    // shaft, and a box sized to the shaft leaves them uncoloured.
    { cat: 'ext', name: 'Ascender', letters: 'b d f h k l', spec: 'b', guides: [],
      def: 'The part of a lowercase letter that rises above the [[X-height|x-height]], as in b, d, f, h, k, and l.',
      shape: function (G) {
        var stem = G.run((G.L.asc + G.L.xh) / 2, 0), seed = mid(stem);
        var pts = seedBand(G, G.B.t - 4, G.L.xh, seed, 5, (stem[1] - stem[0]) * 2.8);
        if (!pts) return { clips: [rc(stem[0] - 5, stem[1] + 5, G.B.t - 4, G.L.xh)], deco: [], nodes: [[seed, G.B.t]] };
        return { clips: [{ k: 'poly', points: pts }], deco: [], nodes: [[seed, G.B.t]] };
      } },
    { cat: 'ext', name: 'Descender', letters: 'g j p q y', spec: 'p', guides: [],
      def: 'The part of a letter that drops below the [[Baseline|baseline]], as in g, j, p, q, and y.',
      shape: function (G) {
        // The foot serif flares well past the shaft, so the width clamp is
        // looser than the ascender's and the pad slightly larger: tight
        // values clipped the serif's bottom-right corner.
        var stem = G.run((G.L.base + G.B.b) / 2, 0), seed = mid(stem);
        var pts = seedBand(G, G.L.base, G.B.b + 6, seed, 6, (stem[1] - stem[0]) * 3.6);
        if (!pts) return { clips: [rc(stem[0] - 5, stem[1] + 5, G.L.base, G.B.b + 4)], deco: [], nodes: [[seed, G.B.b]] };
        return { clips: [{ k: 'poly', points: pts }], deco: [], nodes: [[seed, G.B.b]] };
      } },

    // Strokes. The umbrella concept ("stroke" itself) is described by the
    // category's own entry, so only genuine kinds of stroke appear here.
    { cat: 'str', name: 'Stem', letters: 'n h l', spec: 'n', guides: [],
      def: 'The main upright [[Strokes|stroke]] of a letter, forming the vertical spine of letters like n, h, and l.',
      shape: function (G) {
        // Only the bare shaft: the trace is inset from both ends so the
        // highlight stops short of the entry serif at the x-height (which
        // slants off toward the shoulder) and the foot serif at the
        // baseline. A plain rect at the shaft's measured width cannot creep
        // into either.
        var stem = G.run((G.L.xh + G.L.base) / 2, 0);
        var h = G.L.base - G.L.xh;
        return { clips: [rc(stem[0] - 3, stem[1] + 3, G.L.xh + h * 0.16, G.L.base - h * 0.14)],
          deco: [], nodes: [[mid(stem), G.L.xh + h * 0.16], [mid(stem), G.L.base - h * 0.14]] };
      } },
    { cat: 'str', name: 'Crossbar', letters: 'H A e', spec: 'H', guides: [],
      def: 'The horizontal [[Strokes|stroke]] that spans a letter, joining the [[Stem|stems]] of H or A, or crossing the middle of e.',
      shape: function (G) {
        var bar = G.colRun(CX, 0);                       // bar thickness at centre
        var stems = G.runs(bar[0] - 8);                  // the two stems just above it
        var x0 = stems.length >= 2 ? stems[0][1] - 3 : G.B.l;
        var x1 = stems.length >= 2 ? stems[stems.length - 1][0] + 3 : G.B.r;
        return { clips: [rc(x0, x1, bar[0] - 4, bar[1] + 4)],
          deco: [], nodes: [[x0, mid(bar)], [x1, mid(bar)]] };
      } },
    { cat: 'str', name: 'Arm', letters: 'V K E F T', spec: 'V', guides: [],
      def: 'A straight [[Strokes|stroke]] that does not connect to another stroke on one or both ends, such as the diagonals of a V or K, the outstretched strokes of E and F, or the top of a T.',
      shape: function (G) {
        // The V's thick left diagonal, traced row by row (its two strokes
        // read as separate runs until they fuse near the vertex, where the
        // trace stops: that junction belongs to the vertex, not the arm).
        var b = pickBand(G, G.B.t - 4, G.L.base - (G.L.base - G.L.cap) * 0.2, 2,
          function (row) { return row[0]; }, 5);
        if (!b.points) return { clips: [rc(G.B.l, G.B.cx, G.L.cap, G.L.base)], deco: [], nodes: [[G.B.l, G.L.cap]] };
        return { clips: [{ k: 'poly', points: b.points }], deco: [],
          nodes: [[mid([b.left[0][0], b.right[0][0]]), b.left[0][1]]] };
      } },
    { cat: 'str', name: 'Leg', letters: 'K R', spec: 'K', guides: [],
      def: 'The short descending [[Strokes|stroke]] that kicks out from the body of a K or R.',
      shape: function (G) {
        // Below the junction the K reads as two runs, the stem on the left
        // and the leg on the right, so the rightmost run is the leg. Above
        // the junction the arm would answer to the same test, hence starting
        // the trace just under it.
        var y0 = G.L.cap + (G.L.base - G.L.cap) * 0.52;
        var b = pickBand(G, y0, G.L.base + 5, 2, function (row) { return row[row.length - 1]; }, 5);
        if (!b.points) return { clips: [rc(G.B.cx, G.B.r + 5, y0, G.L.base + 5)], deco: [], nodes: [[G.B.r, G.L.base]] };
        return { clips: [{ k: 'poly', points: b.points }], deco: [],
          nodes: [[mid([b.left[0][0], b.right[0][0]]), b.left[0][1]]] };
      } },
    { cat: 'str', name: 'Bowl', letters: 'b d o p', spec: 'b', guides: [],
      def: 'The rounded [[Strokes|stroke]] that encloses a [[Counter|counter]], as in the round of b, d, p, or o.',
      shape: function (G) {
        // Everything except the stem is the bowl. A straight cut to the
        // right of the stem left a gap at the join and still clipped the
        // bowl's overshoot below the baseline, so instead the whole glyph
        // is shown and the stem is masked out of it: the mask's hidden
        // region traces the stem's own right edge row by row, clamped so
        // the rows where the bowl merges into the shaft do not drag the
        // mask out across the bowl.
        var stem = G.run((G.L.xh + G.L.base) / 2, 0);
        var cy = (G.L.xh + G.L.base) / 2;
        var lim = stem[1] + (stem[1] - stem[0]) * 0.3;
        var y0 = G.B.t - 8, y1 = G.B.b + 8, n = 96, i;
        var left = [], right = [];
        for (i = 0; i <= n; i++) {
          var y = y0 + (y1 - y0) * (i / n), row = G.runs(y);
          left.push([G.B.l - 14, y]);
          right.push([row.length ? Math.min(row[0][1] + 1, lim) : lim, y]);
        }
        return { clips: [],
          masks: { show: [rc(G.B.l - 14, G.B.r + 8, y0, y1)],
                   hide: [{ k: 'poly', points: poly(left, right) }] },
          deco: [], nodes: [[(stem[1] + G.B.r) / 2 + 20, cy]] };
      } },
    { cat: 'str', name: 'Hairline', letters: 'A', spec: 'A', guides: [],
      def: 'Thinnest [[Strokes|stroke]] in a typeface consisting of strokes with variable widths.',
      shape: function (G) {
        // The A's left diagonal is the thin one. Rows where the two diagonals
        // read as separate runs give its edges directly; where they fuse (at
        // the apex, and across the crossbar) the row is skipped and the
        // polygon bridges the gap in a straight line, which is what a
        // straight diagonal does regardless. The trace stops short of the
        // baseline: the foot serif is its own part, not hairline.
        var b = pickBand(G, G.B.t, G.L.base - (G.L.base - G.L.cap) * 0.12, 2,
          function (row) { return row[0]; }, 5);
        if (!b.points) return { clips: [rc(G.B.l, G.B.cx, G.L.cap, G.L.base)], deco: [], nodes: [[G.B.l, G.L.cap]] };
        return { clips: [{ k: 'poly', points: b.points }], deco: [],
          nodes: [[mid([b.left[0][0], b.right[0][0]]), b.left[0][1]]] };
      } },

    // Curves & flourishes
    { cat: 'cur', name: 'Spine', letters: 'S s', spec: 'S', guides: [],
      def: 'The central curving [[Strokes|stroke]] of the S, sweeping from top to bottom. Its tilt can be nearly upright or strongly diagonal depending on the face.',
      shape: function (G) {
        // The sweep travels from the upper left to the lower right, so the
        // trace follows a seed that travels with it (a fixed seed loses the
        // stroke as soon as it moves away, which is why the highlight used
        // to cover only a short band around the waist). Its own ends give
        // the seed's endpoints: the arc's left run up top, its right run
        // down below. The trace stops clear of both terminals.
        var h = G.L.base - G.L.cap;
        var y0 = G.L.cap + h * 0.14, y1 = G.L.base - h * 0.14;
        var r0 = G.runs(y0), r1 = G.runs(y1);
        var x0 = r0.length ? mid(r0[0]) : G.B.cx;
        var x1 = r1.length ? mid(r1[r1.length - 1]) : G.B.cx;
        var pts = seekBand(G, y0, y1, x0, x1, 5);
        if (!pts) return { clips: [{ k: 'ellipse', cx: G.B.cx, cy: (G.L.cap + G.L.base) / 2, rx: G.B.w * 0.4, ry: h * 0.14 }], deco: [], nodes: [[G.B.cx, (G.L.cap + G.L.base) / 2]] };
        return { clips: [{ k: 'poly', points: pts }], deco: [],
          nodes: [[G.B.cx, (G.L.cap + G.L.base) / 2]] };
      } },
    { cat: 'cur', name: 'Hook', letters: 'f', spec: 'f', guides: [],
      def: 'Curved [[Strokes|stroke]] prior to a [[Terminals|terminal]].',
      shape: function (G) {
        // The hook curls inward (to the right) going down, so a fixed left
        // edge leaves a white gap where the curve has receded past it. Trace
        // the actual left edge of the ink at each sampled row instead. The
        // right edge stops short of the glyph's own bounding box by roughly
        // the width of the ball the beak ends in: that ball is the terminal,
        // and the hook is what runs up to it.
        var stem = G.run((G.L.xh + G.L.base) / 2, 0);
        var yTop = G.B.t - 5, yBot = G.B.t + (G.L.base - G.B.t) * 0.3;
        var xRight = G.B.r - (stem[1] - stem[0]) * 1.5;
        var left = [];
        for (var t = 0; t <= 1; t += 0.1) {
          var y = yTop + (yBot - yTop) * t, row = G.runs(y);
          if (row.length) left.push([Math.min(row[0][0] - 4, xRight), y]);
        }
        if (!left.length) return { clips: [rc(G.B.l, xRight, yTop, yBot)], deco: [], nodes: [[G.B.cx, yTop]] };
        var pts = [[xRight, yTop]].concat(left, [[xRight, yBot]]).map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        return { clips: [{ k: 'poly', points: pts }], deco: [], nodes: [[left[0][0], left[0][1]]] };
      } },
    // The specimen serif has no swash forms at all, so this one term borrows
    // a calligraphic face (see FACES/SWASH) rather than pointing at a
    // flourish the reader cannot actually see.
    { cat: 'cur', name: 'Swash', letters: 'R K y', spec: 'y', face: 'swash', size: 430, guides: [],
      def: 'Exaggerated [[Serif|serif]] that is ornamental in nature',
      shape: function (G) {
        // The flourish is what the calligraphic y makes of its descender:
        // a long sweep down and away to the left, curling back into a loop.
        // The cut sits below the baseline rather than on it, so the letter's
        // working body stays plain and only the ornament is marked.
        return { clips: [rc(G.B.l - 6, G.B.r + 6, G.L.base + (G.B.b - G.L.base) * 0.22, G.B.b + 6)],
          deco: [], nodes: [[G.B.cx, G.B.b - 6]] };
      } },

    // Points & junctions
    { cat: 'pts', name: 'Apex', letters: 'A M', spec: 'A', guides: [],
      def: 'The point at the top of a letter where two diagonal [[Strokes|strokes]] meet, as at the peak of a capital A. It can be sharp, flat, or rounded.',
      shape: function (G) {
        // The apex ends exactly where the two strokes stop being one: the
        // first row whose ink splits in two is where their inner edges
        // intersect, and that is the bottom of the region. Above it the
        // ink's real left/right edge is traced at each row, so the
        // highlight covers the taper rather than leaving a triangular gap
        // where the legs widen out. The very tip's runs are too narrow for
        // the scanner to keep (sub-2px), so the polygon is explicitly
        // capped at the apex point.
        var yTop = G.B.t - 4, yBot = G.B.t + (G.L.base - G.B.t) * 0.3, yy2;
        for (yy2 = G.B.t; yy2 < G.L.base; yy2++) { if (G.runs(yy2).length >= 2) { yBot = yy2; break; } }
        var left = [], right = [];
        for (var t = 0; t <= 1; t += 0.1) {
          var y = yTop + (yBot - yTop) * t, row = G.runs(y);
          if (row.length) { left.push([row[0][0] - 4, y]); right.push([row[row.length - 1][1] + 4, y]); }
        }
        if (!left.length) return { clips: [rc(G.B.cx - 48, G.B.cx + 48, yTop, yBot)], deco: [], nodes: [[G.B.cx, yTop]] };
        var tipRow = G.runs(G.B.t + 3);
        var tipX = tipRow.length ? mid(tipRow[0]) : (left[0][0] + right[0][0]) / 2;
        left.unshift([tipX - 5, yTop]); right.unshift([tipX + 5, yTop]);
        var pts = left.concat(right.slice().reverse()).map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        return { clips: [{ k: 'poly', points: pts }], deco: [],
          nodes: [[tipX, G.B.t]] };
      } },
    { cat: 'pts', name: 'Vertex', letters: 'V W', spec: 'V', guides: [],
      def: "The point at the bottom where two [[Strokes|strokes]] meet, as in the base of a V or W, the [[Apex|apex]]'s mirror image.",
      shape: function (G) {
        // Mirror of Apex: the region starts where the two strokes' inner
        // edges intersect, found by scanning up from the tip for the first
        // row whose ink splits in two. The actual left/right ink edge is
        // traced at each row so the highlight covers the legs as they
        // widen going up, and the polygon is explicitly capped at the
        // bottom tip, whose runs are too narrow for the scanner to keep.
        var yBot = G.B.b + 4, yTop = G.L.base - (G.L.base - G.B.t) * 0.3, yy2;
        for (yy2 = G.B.b; yy2 > G.B.t; yy2--) { if (G.runs(yy2).length >= 2) { yTop = yy2; break; } }
        var left = [], right = [];
        for (var t = 0; t <= 1; t += 0.1) {
          var y = yTop + (yBot - yTop) * t, row = G.runs(y);
          if (row.length) { left.push([row[0][0] - 4, y]); right.push([row[row.length - 1][1] + 4, y]); }
        }
        if (!left.length) return { clips: [rc(G.B.cx - 48, G.B.cx + 48, yTop, yBot)], deco: [], nodes: [[G.B.cx, yBot]] };
        var tipRow = G.runs(G.B.b - 3);
        var tipX = tipRow.length ? mid(tipRow[0]) : (left[left.length - 1][0] + right[right.length - 1][0]) / 2;
        left.push([tipX - 5, yBot]); right.push([tipX + 5, yBot]);
        var pts = left.concat(right.slice().reverse()).map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        return { clips: [{ k: 'poly', points: pts }], deco: [],
          nodes: [[tipX, G.B.b]] };
      } },
    { cat: 'pts', name: 'Spur', letters: 'G', spec: 'G', face: 'didot', fit: 'cap', guides: [],
      def: 'A small projection where a curved [[Strokes|stroke]] meets a [[Stem|stem]], most famously at the foot of a capital G. Shown here in Didot, since the body serif of this page draws no spur worth the name, its stem simply melting into the bowl.',
      shape: function (G) {
        // Where the bowl's curve peels away from the foot of the stem, the
        // stem carries on for a moment as a small tapering beak: the spur.
        // Those are exactly the rows whose ink reads as three runs (the
        // bowl's left side, its bottom curve, and the beak), so the spur is
        // the last run on the first such row. The scan starts below the
        // crossbar, since the G's upper terminal splits into three runs too.
        var h = G.L.base - G.L.cap, y, yTop = null, yBot = null, spur = null;
        for (y = G.L.cap + h * 0.6; y < G.L.base; y++) {
          var rr = G.runs(y);
          if (rr.length >= 3) {
            if (yTop === null) { yTop = y; spur = rr[rr.length - 1]; }
            yBot = y;
          }
        }
        // Fallback for a face with no such split: the stem's outer corner.
        if (!spur) {
          var st = G.run(G.L.cap + h * 0.82, -1), w = st[1] - st[0];
          return { clips: [rc(st[1] - w * 0.6, st[1] + 8, G.L.base - h * 0.075, G.L.base + 4)],
            deco: [], nodes: [[st[1] - w * 0.25, G.L.base - h * 0.04]] };
        }
        return { clips: [rc(spur[0] - 10, spur[1] + 8, yTop - 3, yBot + 8)],
          deco: [], nodes: [[mid(spur), yBot]] };
      } },
    { cat: 'pts', name: 'Bracket', letters: 'I H L', spec: 'I', guides: [],
      def: 'The curved fillet that eases the join between a [[Stem|stem]] and its [[Serif|serif]].',
      shape: function (G) {
        // What is left of the I once its serif slabs and its stem shaft are
        // accounted for: the four concave fillets that flare the shaft out
        // into the slabs. The slab depth is the same one the Serif term
        // shades, and the fillet runs from there down to where the profile
        // has narrowed back to the stem's own width.
        var h = G.L.base - G.L.cap;
        var slab = h * 0.055, flare = h * 0.13;
        var stem = G.run((G.L.cap + G.L.base) / 2, 0);
        var top = G.run(G.L.cap + slab + 3, 0);
        var bot = G.run(G.L.base - slab - 3, 0);
        return { clips: [rc(top[0] - 3, stem[0], G.L.cap + slab, G.L.cap + flare),
                         rc(stem[1], top[1] + 3, G.L.cap + slab, G.L.cap + flare),
                         rc(bot[0] - 3, stem[0], G.L.base - flare, G.L.base - slab),
                         rc(stem[1], bot[1] + 3, G.L.base - flare, G.L.base - slab)],
          deco: [], nodes: [[stem[1] + 6, G.L.cap + flare], [stem[1] + 6, G.L.base - flare]] };
      } },

    // Terminals. The umbrella concept ("terminal" itself) is described by
    // the category's own entry, so only specific terminal shapes appear.
    { cat: 'term', name: 'Ball terminal', letters: 'a c f r', spec: 'c', guides: [],
      def: 'A [[Terminals|terminal]] that ends in a small round shape, the dot capping the [[Arm|arm]] of an a, c, f, or r.',
      shape: function (G) {
        // The ball is the detached-looking blob ending the c's upper arc:
        // in the top half of the body, rows crossing it read as two runs
        // (arc on the left, ball on the right), and the ball's centre row
        // is where that last run is widest. Sizing the circle from the
        // widest row covers the whole ball (a fixed-radius circle at an
        // assumed height left slivers unshaded, or caught the lower
        // terminal instead).
        var bestW = 0, bestY = null, bestX = null;
        for (var t = 0.02; t <= 0.5; t += 0.03) {
          var y = G.L.xh + (G.L.base - G.L.xh) * t, row = G.runs(y);
          if (row.length < 2) continue;
          var last = row[row.length - 1], w = last[1] - last[0];
          if (w > bestW) { bestW = w; bestY = y; bestX = mid(last); }
        }
        if (bestY === null) {
          var yy = G.L.xh + (G.L.base - G.L.xh) * 0.18, end = G.run(yy, -1);
          return { clips: [{ k: 'circle', cx: mid(end), cy: yy, r: 30 }], deco: [], nodes: [[mid(end), yy]] };
        }
        return { clips: [{ k: 'circle', cx: bestX, cy: bestY, r: bestW / 2 + 10 }],
          deco: [], nodes: [[bestX, bestY]] };
      } },

    // Space & contrast
    { cat: 'spc', name: 'Counter', letters: 'o e a', spec: 'o', guides: [],
      def: 'The enclosed or partly enclosed white space inside a letter, such as the hole in o, e, or a. Fully closed and open counters both count.',
      shape: function (G) {
        // The counter is whitespace, so there is no ink to recolour: it is
        // shaded with a filled region traced from the hole's real contour
        // (holeBand follows the strokes' inner edges row by row), not an
        // ellipse approximation whose outline drifted off the letterform.
        var c = G.col(CX);
        if (c.length < 2) return { clips: [], deco: [{ k: 'fillellipse', cx: G.B.cx, cy: (G.L.xh + G.L.base) / 2, rx: G.B.w * 0.28, ry: (G.L.base - G.L.xh) * 0.3 }], nodes: [[G.B.cx, (G.L.xh + G.L.base) / 2]] };
        var top = c[0], bot = c[c.length - 1];
        var pts = holeBand(G, top[1] + 1, bot[0] - 1);
        var holeY = (top[1] + bot[0]) / 2;
        return { clips: [], deco: pts ? [{ k: 'fillpoly', points: pts }] : [],
          nodes: [[CX, holeY]] };
      } },
    { cat: 'spc', name: 'Aperture', letters: 'c e s', spec: 'c', guides: [],
      def: 'The opening of a partly closed [[Counter|counter]], as in c, e, or s.',
      shape: function (G) {
        // The aperture is the mouth of the c: the opening left between its
        // two terminals. Scanning out from the middle finds the first row
        // in each direction whose ink splits in two, which is where a
        // terminal begins; between those rows the region runs from the
        // arc's inner edge out to the chord joining the two terminal tips.
        // Bounding it by the tips keeps the fill inside the letter's own
        // silhouette, where a box out to the glyph's right extent spilled
        // past the letter entirely.
        // The region spans the full mouth, tip to tip: the rows scanned are
        // those between the two terminals' outermost points, not just the
        // narrow band where the arc stands alone. On rows where a terminal
        // is present the region stops at its inner edge, so the fill hugs
        // the terminals above and below and bulges out to the tips between
        // them, instead of sitting as a flat-topped block in the middle.
        var cy = (G.L.xh + G.L.base) / 2, y, yTop = null, yBot = null, xT = 0, xB = 0;
        for (y = cy; y > G.L.xh; y--) {
          var ru = G.runs(y);
          if (ru.length < 2) continue;
          if (ru[ru.length - 1][1] >= xT) { xT = ru[ru.length - 1][1]; yTop = y; }
        }
        for (y = cy; y < G.L.base; y++) {
          var rd = G.runs(y);
          if (rd.length < 2) continue;
          if (rd[rd.length - 1][1] >= xB) { xB = rd[rd.length - 1][1]; yBot = y; }
        }
        if (yTop === null || yBot === null) return { clips: [], deco: [], nodes: [[G.B.r - 20, cy]] };
        var left = [], right = [], n = 40, i;
        for (i = 0; i <= n; i++) {
          var t = i / n, yy = yTop + (yBot - yTop) * t, row = G.runs(yy);
          if (!row.length) continue;
          // The first run is always the arc; where a second run exists it is
          // the terminal, and the opening stops at its inner edge.
          var chord = xT + (xB - xT) * t;
          left.push([row[0][1] + 2, yy]);
          right.push([row.length >= 2 ? Math.min(chord, row[row.length - 1][0]) : chord, yy]);
        }
        var pts = poly(left, right);
        if (!pts) return { clips: [], deco: [], nodes: [[G.B.r - 20, cy]] };
        return { clips: [], deco: [{ k: 'fillpoly', points: pts }],
          nodes: [[(left[Math.floor(left.length / 2)][0] + xT) / 2, cy]] };
      } },

    // Spacing & setting -- multi-glyph/multi-line concepts, distinct from
    // single-letterform anatomy above. Kerning uses the ordinary specimen
    // pipeline (its spec is just a two-character string); Leading needs an
    // actual second line, so it bypasses the pipeline via buildLeadingStage.
    { cat: 'spacing', name: 'Kerning', letters: 'AV', spec: 'AV', guides: [],
      def: 'The adjustment of space between two specific letters so their gap matches the rhythm of the surrounding text. Pairs like AV or To are tightened, since their diagonals or curves would otherwise look too far apart at the default advance width.',
      shape: function (G) {
        // The kerned space itself: the wedge between the A's right edge and
        // the V's left edge, traced row by row so it follows both diagonals
        // instead of a vertical band that overlapped the A's leg and missed
        // the space under the V's slant.
        var pts = gapRegion(G);
        if (!pts) return { clips: [], deco: [], nodes: [] };
        var cy = (G.L.cap + G.L.base) / 2;
        var row = G.runs(cy), splitX = G.originX + G.measure(G.pairFirst), le = null, re = null;
        row.forEach(function (iv) {
          if (iv[1] < splitX) { if (le === null || iv[1] > le) le = iv[1]; }
          else if (iv[0] > splitX) { if (re === null || iv[0] < re) re = iv[0]; }
        });
        return { clips: [], deco: [{ k: 'fillband', points: pts }],
          nodes: [[le !== null && re !== null ? (le + re) / 2 : G.B.cx, cy]] };
      } },
    { cat: 'spacing', name: 'Leading', letters: 'Hg', spec: 'Hg', size: 165, leading: true, guides: [],
      def: "The vertical space from one line's [[Baseline|baseline]] to the next, named for the strips of lead metal typesetters once inserted between lines of set type. Tight leading crowds a paragraph, and generous leading opens it up.",
      shape: function () { return { clips: [], deco: [], nodes: [] }; } },

    // Related terms
    { cat: 'rel', name: 'Serif', letters: 'I H n', spec: 'I', guides: [],
      def: 'The small finishing [[Strokes|stroke]] at the end of a main stroke.',
      shape: function (G) {
        // Only the serif slabs' wings: the four boxes stop at the stem's
        // edges (so the shaft is not recoloured) and stay shallow enough to
        // leave the brackets, which are their own part, unshaded.
        var stem = G.run((G.L.cap + G.L.base) / 2, 0);
        var top = G.run(G.L.cap + 4, 0);
        var bot = G.run(G.L.base - 4, 0);
        var h = (G.L.base - G.L.cap) * 0.055;
        return { clips: [rc(top[0] - 3, stem[0] - 1, G.L.cap - 3, G.L.cap + h),
                         rc(stem[1] + 1, top[1] + 3, G.L.cap - 3, G.L.cap + h),
                         rc(bot[0] - 3, stem[0] - 1, G.L.base - h, G.L.base + 3),
                         rc(stem[1] + 1, bot[1] + 3, G.L.base - h, G.L.base + 3)],
          deco: [], nodes: [[mid(top), G.L.cap], [mid(bot), G.L.base]] };
      } },
    { cat: 'rel', name: 'Ear', letters: 'g', spec: 'g', guides: [],
      def: 'The tiny [[Strokes|stroke]] that pokes out from the top-right of a double-storey lowercase g.',
      shape: function (G) {
        // The ear is the ink that reaches out past the bowl near the top of
        // the g. The inner cut is the bowl's widest point, scanned across
        // the whole bowl below the ear: a single sampled row is no good,
        // since the bowl has already curved back in by its lower reaches
        // and would put the cut far too far left. The region then ends at
        // the last row still reaching past that width, so the highlight
        // stops with the ear instead of running on down the bowl's side.
        var body = G.L.base - G.L.xh, y;
        var bowlR = 0;
        for (y = G.L.xh + body * 0.15; y < G.L.xh + body * 0.75; y += 3) {
          var e = G.run(y, -1)[1];
          if (e > bowlR) bowlR = e;
        }
        var yEnd = G.B.t;
        for (y = G.B.t; y < G.L.xh + body * 0.25; y += 2) {
          if (G.run(y, -1)[1] > bowlR + 4) yEnd = y;
        }
        return { clips: [rc(bowlR - 6, G.B.r + 6, G.B.t - 6, yEnd + 6)],
          deco: [], nodes: [[(bowlR + G.B.r) / 2, G.B.t + 4]] };
      } },
    { cat: 'rel', name: 'Tail', letters: 'y j Q', spec: 'y', guides: [],
      def: "The descending [[Strokes|stroke]] that hangs below the [[Baseline|baseline]] of a y, j, or Q. Unlike a [[Swash|swash]], which is ornament added for flourish, the tail is part of the letter's working skeleton.",
      shape: function (G) {
        // Everything the letter paints below the baseline is the tail.
        return { clips: [rc(G.B.l - 6, G.B.r + 6, G.L.base + 2, G.B.b + 6)],
          deco: [], nodes: [[G.B.cx, G.B.b - 4]] };
      } },
    { cat: 'rel', name: 'Tittle', letters: 'i j', spec: 'i', guides: [],
      def: 'The proper name for the dot above a lowercase i and j.',
      shape: function (G) {
        var stem = G.run((G.L.xh + G.L.base) / 2, 0);
        var c = G.col(mid(stem));
        if (c.length < 2) return { clips: [{ k: 'circle', cx: mid(stem), cy: G.B.t + 16, r: 26 }], deco: [], nodes: [[mid(stem), G.B.t + 16]] };
        var dot = c[0];
        return { clips: [{ k: 'circle', cx: mid(stem), cy: mid(dot), r: (dot[1] - dot[0]) / 2 + 8 }],
          deco: [], nodes: [[mid(stem), mid(dot)]] };
      } },
  ].map(function (t, i) { t.no = i + 1; return t; });

  // The selectable sequence: each category followed by its terms, so
  // prev/next walks through category introductions and their parts in
  // reading order. ITEMS_BY_NAME resolves [[Name|display]] cross-references
  // in definition text (term names and category labels alike) into links.
  var ITEMS = [];
  CATS.forEach(function (c) {
    ITEMS.push({ kind: 'cat', cat: c });
    TERMS.forEach(function (t) { if (t.cat === c.id) ITEMS.push({ kind: 'term', term: t }); });
  });
  ITEMS.forEach(function (it, i) { it.idx = i; });
  var ITEMS_BY_NAME = {};
  ITEMS.forEach(function (it) {
    ITEMS_BY_NAME[(it.kind === 'cat' ? it.cat.label : it.term.name).toLowerCase()] = it;
  });

  // ──────────────────── measurement (canvas ink scan) ─────────────────

  var measureCtx = null;
  function getCtx() {
    if (!measureCtx) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      measureCtx = c.getContext('2d', { willReadFrequently: true });
    }
    return measureCtx;
  }

  function faceOf(term) { return FACES[term.face] || SERIF; }
  function faceClass(term) { return term.face ? ' ta-' + term.face : ''; }
  function fontStr(size, italic, face) { return (italic ? 'italic ' : '') + size + 'px ' + face; }

  // Render the term's specimen and return measured geometry:
  //   L: reference-line y positions from real font metrics
  //   B: ink bounding box of the rendered glyph
  //   runs(y)/col(x): ink intervals along a row / column
  //   run/colRun: safe accessors with bbox fallback
  function measure(term) {
    var size = term.size || S;
    var ctx = getCtx();
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';

    // Reference lines always come from the standard serif at the standard
    // size, even when the specimen borrows another face or size (Swash),
    // so every stage shares the same guides and the same em values.
    ctx.font = fontStr(S, false, SERIF);
    function asc(ch) { return ctx.measureText(ch).actualBoundingBoxAscent; }
    function desc(ch) { return ctx.measureText(ch).actualBoundingBoxDescent; }
    var L = {
      asc:  BASE_Y - asc('h'),
      cap:  BASE_Y - asc('H'),
      xh:   BASE_Y - asc('x'),
      base: BASE_Y,
      desc: BASE_Y + desc('p'),
    };

    // A borrowed face draws its capitals at its own proportions, so it would
    // not sit on the shared cap-height guide. `fit: 'cap'` rescales it until
    // its capitals match, which is what keeps the Spur's Didot G aligned
    // with every other specimen.
    if (term.fit) {
      ctx.font = fontStr(S, term.italic, faceOf(term));
      var probe = term.fit === 'xh' ? 'x' : 'H';
      var want = term.fit === 'xh' ? BASE_Y - L.xh : BASE_Y - L.cap;
      var got = ctx.measureText(probe).actualBoundingBoxAscent;
      if (got > 0) size = Math.round(size * want / got);
    }

    ctx.font = fontStr(size, term.italic, faceOf(term));
    ctx.fillText(term.spec, CX, BASE_Y);
    var adv = ctx.measureText(term.spec).width;

    var data = ctx.getImageData(0, 0, W, H).data;
    function ink(x, y) { return data[(y * W + x) * 4 + 3] > 60; }

    // Ink bounding box.
    var l = W, r = 0, t = H, b = 0, x, y;
    for (y = 60; y < H - 10; y++) {
      for (x = 60; x < W - 60; x++) {
        if (ink(x, y)) {
          if (x < l) l = x; if (x > r) r = x;
          if (y < t) t = y; if (y > b) b = y;
        }
      }
    }
    var B = { l: l, r: r, t: t, b: b, w: r - l, h: b - t, cx: (l + r) / 2 };

    function intervals(get, from, to) {
      var out = [], start = -1, i;
      for (i = from; i <= to; i++) {
        if (get(i)) { if (start < 0) start = i; }
        else if (start >= 0) {
          if (i - start >= 2) out.push([start, i - 1]);
          start = -1;
        }
      }
      if (start >= 0) out.push([start, to]);
      // Merge gaps under 3px (anti-aliasing seams).
      var merged = [];
      out.forEach(function (iv) {
        if (merged.length && iv[0] - merged[merged.length - 1][1] <= 3) merged[merged.length - 1][1] = iv[1];
        else merged.push(iv);
      });
      return merged;
    }
    function runs(yy) { yy = Math.round(yy); return intervals(function (xx) { return ink(xx, yy); }, 60, W - 60); }
    function col(xx) { xx = Math.round(xx); return intervals(function (yy) { return ink(xx, yy); }, 60, H - 10); }
    function run(yy, i) {
      var arr = runs(yy);
      if (!arr.length) return [B.l, B.r];
      if (i < 0) i = arr.length + i;
      return arr[Math.max(0, Math.min(arr.length - 1, i))];
    }
    function colRun(xx, i) {
      var arr = col(xx);
      if (!arr.length) return [B.t, B.b];
      if (i < 0) i = arr.length + i;
      return arr[Math.max(0, Math.min(arr.length - 1, i))];
    }

    return {
      L: L, B: B, size: size, adv: adv, originX: CX - adv / 2,
      runs: runs, col: col, run: run, colRun: colRun,
      pairFirst: term.spec.charAt(0),
      measure: function (text) { return ctx.measureText(text).width; },
    };
  }

  // ─────────────────────────── DOM helpers ────────────────────────────

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }

  // A lone sentence in the inspector reads as a label, not prose, so it is
  // set without its full stop. Anything with a second sentence keeps its
  // punctuation throughout.
  function trimPeriod(text) {
    var body = text.replace(/\s+$/, '');
    if (!/[.!?]$/.test(body)) return body;
    return /[.!?]["')\]]?\s/.test(body.slice(0, -1)) ? body : body.slice(0, -1);
  }

  // Minimal inline renderer: **bold** -> <b>, [[Term|display]] -> a button
  // that calls onLink with the referenced term (falls back to plain text
  // for [[Term]] with no display, or if the name doesn't match a term).
  function renderBold(text, onLink) {
    var frag = document.createDocumentFragment();
    text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/).forEach(function (part) {
      if (!part) return;
      if (part.substr(0, 2) === '**' && part.substr(-2) === '**') {
        frag.appendChild(el('b', null, part.slice(2, -2)));
        return;
      }
      if (part.substr(0, 2) === '[[' && part.substr(-2) === ']]') {
        var inner = part.slice(2, -2), bar = inner.indexOf('|');
        var name = bar === -1 ? inner : inner.slice(0, bar);
        var display = bar === -1 ? inner : inner.slice(bar + 1);
        var target = ITEMS_BY_NAME[name.toLowerCase()];
        if (target && onLink) {
          var link = el('button', { class: 'ta-def-link', type: 'button' }, display);
          link.addEventListener('click', function () { onLink(target); });
          frag.appendChild(link);
        } else {
          frag.appendChild(document.createTextNode(display));
        }
        return;
      }
      frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  // ─────────────────────────── stage (SVG) ────────────────────────────

  function clipShape(m) {
    if (m.k === 'rect') return '<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h + '" rx="6"/>';
    if (m.k === 'circle') return '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + m.r + '"/>';
    if (m.k === 'ellipse') return '<ellipse cx="' + m.cx + '" cy="' + m.cy + '" rx="' + m.rx + '" ry="' + m.ry + '"' +
      (m.rot ? ' transform="rotate(' + m.rot + ' ' + m.cx + ' ' + m.cy + ')"' : '') + '/>';
    if (m.k === 'poly') return '<polygon points="' + m.points + '"/>';
    return '';
  }

  var GUIDE_META = [
    { key: 'asc',  label: 'ascender line' },
    { key: 'cap',  label: 'cap height' },
    { key: 'xh',   label: 'x-height' },
    { key: 'base', label: 'baseline' },
    { key: 'desc', label: 'descender line' },
  ];

  // Leading needs two full lines of text -- an entirely different layout
  // from every other term's single specimen -- so it bypasses the standard
  // pipeline. The line-to-line distance is a deliberate typographic choice,
  // not a font-intrinsic metric, so this illustrates a representative ratio
  // (1.3x the em) rather than "measuring" anything.
  function buildLeadingStage(term) {
    var size = term.size, lead = Math.round(size * 1.3);
    var y1 = 260, y2 = y1 + lead;
    var attrs1 = 'x="' + CX + '" y="' + y1 + '" text-anchor="middle" font-size="' + size + '"';
    var attrs2 = 'x="' + CX + '" y="' + y2 + '" text-anchor="middle" font-size="' + size + '"';
    var s = [];
    s.push('<svg class="ta-svg" viewBox="-150 0 950 680" role="img" aria-hidden="true">');
    // The two baselines are drawn and labelled with the standard guide
    // recipe: they are the reference points the measurement runs between,
    // and the coral bracket alone marks the measured span (no extra label).
    [y1, y2].forEach(function (yy) {
      s.push('<g class="ta-g">');
      s.push('<line x1="96" y1="' + yy + '" x2="712" y2="' + yy + '"/>');
      s.push('<text class="ta-g-label" x="88" y="' + yy + '" dy="0.35em" text-anchor="end">baseline</text>');
      s.push('</g>');
    });
    s.push('<text class="ta-specimen ta-enter" ' + attrs1 + '>' + term.spec + '</text>');
    s.push('<text class="ta-specimen ta-enter" ' + attrs2 + '>' + term.spec + '</text>');
    s.push('<line class="ta-lead-bracket" x1="640" y1="' + y1 + '" x2="640" y2="' + y2 + '"/>');
    s.push('<line class="ta-lead-tick" x1="632" y1="' + y1 + '" x2="648" y2="' + y1 + '"/>');
    s.push('<line class="ta-lead-tick" x1="632" y1="' + y2 + '" x2="648" y2="' + y2 + '"/>');
    s.push('</svg>');
    return s.join('');
  }

  // Sidebearings and metric guides, shared by every stage. Label and em-unit
  // value are vertically centred on the line; when two lines sit too close,
  // labels are pushed apart and a curved leader connects each back to its
  // line. Every active guide gets the same emphasis (large bold label, thick
  // line) regardless of whether the term also highlights something on the
  // glyph: consistent weight is what tells the reader "this line matters for
  // the current term".
  function guidesSvg(term, G) {
    var s = [];
    // Sidebearings come from the glyph's real origin and advance, and are
    // skipped where there is no single specimen to bear them (the
    // guides-only stage a category selection shows, and the stress pair).
    if (term.spec && !term.stress) {
      s.push('<line class="ta-sidebearing" x1="' + G.originX + '" y1="120" x2="' + G.originX + '" y2="628"/>');
      s.push('<line class="ta-sidebearing" x1="' + (G.originX + G.adv) + '" y1="120" x2="' + (G.originX + G.adv) + '" y2="628"/>');
    }
    var placed = GUIDE_META.map(function (g) {
      var active = term.guides.indexOf(g.key) !== -1;
      return { key: g.key, label: g.label, y: G.L[g.key], ly: G.L[g.key], active: active };
    }).sort(function (a, b) { return a.y - b.y; });
    var i;
    for (i = 1; i < placed.length; i++) {
      var need = ((placed[i - 1].active ? 17 : 11) + (placed[i].active ? 17 : 11));
      var gap = placed[i].ly - placed[i - 1].ly;
      if (gap < need) {
        var push = (need - gap) / 2;
        placed[i - 1].ly -= push;
        placed[i].ly += push;
      }
    }
    placed.forEach(function (g) {
      var active = g.active;
      // Em values are relative to the standard specimen size, matching the
      // standard-face metrics the guides are drawn from, so every stage
      // reports identical values.
      var em = Math.round((BASE_Y - g.y) / S * 1000);
      var val = em > 0 ? '+' + em : em < 0 ? '−' + Math.abs(em) : '0';
      var curved = Math.abs(g.ly - g.y) > 0.5;
      s.push('<g class="ta-g' + (active ? ' on' : '') + '">');
      s.push('<line x1="96" y1="' + g.y + '" x2="712" y2="' + g.y + '"/>');
      if (curved) {
        s.push('<path class="ta-glead" d="M 96 ' + g.y + ' C 82 ' + g.y + ', 82 ' + g.ly + ', 72 ' + g.ly + '" fill="none"/>');
        s.push('<path class="ta-glead" d="M 712 ' + g.y + ' C 726 ' + g.y + ', 726 ' + g.ly + ', 736 ' + g.ly + '" fill="none"/>');
      }
      var lx = curved ? 66 : 88, vx = curved ? 742 : 722;
      s.push('<text class="ta-g-label' + (active ? ' on' : '') + '" x="' + lx + '" y="' + g.ly + '" dy="0.35em" text-anchor="end">' + g.label + '</text>');
      s.push('<text class="ta-g-val' + (active ? ' on' : '') + '" x="' + vx + '" y="' + g.ly + '" dy="0.35em" text-anchor="start">' + val + '</text>');
      s.push('</g>');
    });
    return s.join('');
  }

  // The axis through a ring letter's two thinnest points, measured rather
  // than assumed: scanning every column, the top stroke is at its thinnest
  // somewhere, and so is the bottom, and the line joining those two places
  // is the stress. On an old-style face the two land either side of centre,
  // which is exactly what makes the axis lean.
  function stressAxis(G) {
    var x, a = null, b = null;
    for (x = G.B.l + 6; x <= G.B.r - 6; x++) {
      var c = G.col(x);
      if (c.length < 2) continue;
      var top = c[0], bot = c[c.length - 1];
      if (!a || top[1] - top[0] < a.t) a = { t: top[1] - top[0], x: x, y: mid(top) };
      if (!b || bot[1] - bot[0] < b.t) b = { t: bot[1] - bot[0], x: x, y: mid(bot) };
    }
    return (a && b) ? [a, b] : null;
  }

  // Stress can only be shown by comparison, so this stage sets the same
  // letter twice in two faces and draws each one's measured axis. Both are
  // fitted to the shared x-height, and each is drawn at CX then translated
  // into place, so the measured geometry needs no re-mapping.
  var STRESS_PAIR = [
    { face: 'oldstyle', dx: -168, label: 'old style, leaning' },
    { face: 'modern',   dx:  168, label: 'modern, upright' },
  ];

  function buildStressStage(term) {
    var base = measure({ spec: '', guides: [] });
    var s = [];
    s.push('<svg class="ta-svg" viewBox="-150 0 950 680" role="img" aria-hidden="true">');
    s.push(guidesSvg({ spec: '', guides: term.guides, stress: true }, base));
    STRESS_PAIR.forEach(function (p) {
      var G = measure({ spec: 'o', face: p.face, fit: 'xh', guides: [] });
      var ax = stressAxis(G);
      s.push('<g transform="translate(' + p.dx + ' 0)">');
      s.push('<text class="ta-specimen ta-enter ta-' + p.face + '" x="' + CX + '" y="' + BASE_Y +
        '" text-anchor="middle" font-size="' + G.size + '">o</text>');
      if (ax) {
        // Extended past both thin points so the axis reads as a direction
        // rather than a chord between two dots.
        var ex = (ax[1].x - ax[0].x) * 0.22, ey = (ax[1].y - ax[0].y) * 0.22;
        s.push('<g class="ta-mark"><line class="ta-mk-line ta-dash" x1="' + (ax[0].x - ex) + '" y1="' + (ax[0].y - ey) +
          '" x2="' + (ax[1].x + ex) + '" y2="' + (ax[1].y + ey) + '" stroke-width="5" stroke-linecap="round"/></g>');
      }
      s.push('<text class="ta-g-label" x="' + CX + '" y="' + (BASE_Y + 78) + '" text-anchor="middle">' + p.label + '</text>');
      s.push('</g>');
    });
    s.push('</svg>');
    return s.join('');
  }

  function buildStage(term, G, marks) {
    if (term.leading) return buildLeadingStage(term);
    if (term.stress) return buildStressStage(term);
    var italic = (term.italic ? ' ta-i' : '') + faceClass(term);
    var specAttrs = 'x="' + CX + '" y="' + BASE_Y + '" text-anchor="middle" font-size="' + G.size + '"';
    // A term whose concept IS a metric guide (e.g. Baseline) has nothing to
    // clip or decorate on the glyph itself: the guide line rendered below
    // already shows it. Detect that case so we can skip a redundant leader
    // pointing at nothing.
    var noHighlight = !marks.clips.length && !marks.deco.length && !marks.masks;
    var s = [];
    // The left margin is wide enough to fit the longest guide label
    // ("descender line") at the enlarged active size, even when a curved
    // leader pulls it further left -- see the active-pair gap sizing below.
    s.push('<svg class="ta-svg" viewBox="-150 0 950 680" role="img" aria-hidden="true">');
    s.push(guidesSvg(term, G));

    // specimen glyph (ink)
    s.push('<text class="ta-specimen ta-enter' + italic + '" ' + specAttrs + '>' + term.spec + '</text>');

    // leader from the primary node to the inspector edge. Skipped when the
    // term has no highlight: its guide line already spans the full stage
    // width, so a second coral line drawn on top would only double up.
    if (!noHighlight) {
      var primary = marks.nodes[0] || [G.B.cx, G.L.base];
      s.push('<line class="ta-leader" x1="' + primary[0] + '" y1="' + primary[1] + '" x2="758" y2="' + primary[1] + '"/>');
    }

    // highlight: coral copy of the glyph clipped to the measured region
    s.push('<g class="ta-mark ta-enter">');
    if (marks.clips.length) {
      var clipId = 'ta-clip-' + term.no;
      s.push('<clipPath id="' + clipId + '">');
      marks.clips.forEach(function (m) { s.push(clipShape(m)); });
      s.push('</clipPath>');
      s.push('<text class="ta-hl' + italic + '" ' + specAttrs + ' clip-path="url(#' + clipId + ')">' + term.spec + '</text>');
    }
    // A mask, unlike a clip, can subtract: the shown region is painted white
    // and the excluded part black over it. That is what lets a highlight run
    // right up against a neighbouring part (the bowl against its stem)
    // without a safety gap and without recolouring the neighbour.
    if (marks.masks) {
      var maskId = 'ta-mask-' + term.no;
      s.push('<mask id="' + maskId + '" maskUnits="userSpaceOnUse">');
      marks.masks.show.forEach(function (m) { s.push('<g fill="#fff">' + clipShape(m) + '</g>'); });
      marks.masks.hide.forEach(function (m) { s.push('<g fill="#000">' + clipShape(m) + '</g>'); });
      s.push('</mask>');
      s.push('<text class="ta-hl' + italic + '" ' + specAttrs + ' mask="url(#' + maskId + ')">' + term.spec + '</text>');
    }
    marks.deco.forEach(function (m) {
      if (m.k === 'line')
        s.push('<line class="ta-mk-line' + (m.dash ? ' ta-dash' : '') + '" x1="' + m.x1 + '" y1="' + m.y1 + '" x2="' + m.x2 + '" y2="' + m.y2 + '" stroke-width="' + m.w + '" stroke-linecap="round"/>');
      else if (m.k === 'ellipse')
        s.push('<ellipse class="ta-mk ta-hollow" cx="' + m.cx + '" cy="' + m.cy + '" rx="' + m.rx + '" ry="' + m.ry + '"/>');
      else if (m.k === 'fillellipse')
        s.push('<ellipse class="ta-mk-fill" cx="' + m.cx + '" cy="' + m.cy + '" rx="' + m.rx + '" ry="' + m.ry + '"/>');
      else if (m.k === 'fillpoly')
        s.push('<polygon class="ta-mk-fill" points="' + m.points + '"/>');
      else if (m.k === 'fillband')
        s.push('<polygon class="ta-mk-band" points="' + m.points + '"/>');
      else if (m.k === 'band')
        s.push('<rect class="ta-mk-band" x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h + '" rx="4"/>');
    });
    s.push('</g>');

    s.push('</svg>');
    return s.join('');
  }

  // ─────────────────────────── widget build ───────────────────────────

  // `tableId`, when given, receives the components table instead of it being
  // appended below the explorer, so the page can wrap the two in its own
  // section scaffolding.
  window.createTypeAnatomy = function (containerId, tableId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    root.classList.add('ta-root');

    var idx = 0;
    ITEMS.forEach(function (it) { if (it.kind === 'term' && it.term.name === 'Baseline') idx = it.idx; });
    var geomCache = {};  // cache key -> { G, marks }

    var main = el('div', { class: 'ta-main role-panel-frame' });
    var stage = el('div', { class: 'ta-stage' });
    var insp = el('aside', { class: 'ta-insp', 'aria-live': 'polite' });
    main.appendChild(stage);
    main.appendChild(insp);
    root.appendChild(main);

    var host = tableId ? document.getElementById(tableId) : null;
    var nav = el('nav', { class: 'ta-nav' + (host ? ' ta-nav-hosted' : '') });
    if (host) { host.classList.add('ta-root'); host.appendChild(nav); }
    else root.appendChild(nav);

    var linkEls = {};

    function geom(term) {
      if (!geomCache[term.no]) {
        var G = measure(term);
        geomCache[term.no] = { G: G, marks: term.shape(G) };
      }
      return geomCache[term.no];
    }

    // A category's stage is guides-only: the same metric lines every term
    // shares, with no specimen, sidebearings, highlight, or leader. An
    // empty spec makes measure() return standard-face metrics and
    // buildStage skip everything specimen-related.
    function catGeom(c) {
      var key = 'cat-' + c.id;
      if (!geomCache[key]) {
        geomCache[key] = { G: measure({ spec: '', guides: [] }), marks: { clips: [], deco: [], nodes: [] } };
      }
      return geomCache[key];
    }

    function go(d) { idx = (idx + d + ITEMS.length) % ITEMS.length; render(); }
    function select(i) { idx = i; render(); }

    function render() {
      var item = ITEMS[idx];
      if (item.kind === 'term') {
        var g = geom(item.term);
        stage.innerHTML = buildStage(item.term, g.G, g.marks);
      } else {
        var cg = catGeom(item.cat);
        stage.innerHTML = buildStage({ spec: '', guides: [], no: 'cat-' + item.cat.id }, cg.G, cg.marks);
      }
      buildInspector(item);
      Object.keys(linkEls).forEach(function (i) { linkEls[i].classList.toggle('sel', (+i) === item.idx); });
    }

    function buildInspector(item) {
      insp.innerHTML = '';

      // Controls first, ahead of the identity/definition: prev/next steps
      // through terms far more often than the reader scrolls the panel, so
      // they sit where the eye already is rather than below the copy.
      var prev = el('button', { class: 'role-control-btn', type: 'button', 'aria-label': 'Previous term' }, '‹ Prev');
      prev.addEventListener('click', function () { go(-1); });
      var next = el('button', { class: 'role-control-btn', type: 'button', 'aria-label': 'Next term' }, 'Next ›');
      next.addEventListener('click', function () { go(1); });
      insp.appendChild(el('div', { class: 'ta-insp-controls' }, [
        el('div', { class: 'ta-controls' }, [prev, next]),
      ]));

      // Name, sample letters, definition. The name alone carries the
      // identity; the pill in the table below already shows which category
      // the reader is in, so no eyebrow is repeated here.
      var body;
      if (item.kind === 'term') {
        var term = item.term;
        body = el('div', { class: 'ta-insp-body' }, [
          el('div', { class: 'ta-name' }, term.name),
          el('div', { class: 'ta-mini' + (term.italic ? ' ta-i' : '') + faceClass(term) }, term.letters),
        ]);
      } else {
        body = el('div', { class: 'ta-insp-body' }, [
          el('div', { class: 'ta-name' }, item.cat.label),
        ]);
      }
      var def = el('p', { class: 'ta-def' });
      def.appendChild(renderBold(trimPeriod(item.kind === 'term' ? item.term.def : item.cat.desc),
        function (target) { select(target.idx); }));
      body.appendChild(def);
      insp.appendChild(body);
    }

    function buildNav() {
      var head = el('thead', { class: 'role-table-head' }, el('tr', null, [
        el('th', { class: 'role-table-head-cell' }, 'Category'),
        el('th', { class: 'role-table-head-cell' }, 'Components'),
      ]));

      // One row per category; every category label is a selectable pill in
      // the same shape as the component pills beside it, and the second
      // cell lists that category's parts.
      var body = el('tbody');
      ITEMS.forEach(function (it) {
        if (it.kind !== 'cat') return;
        var c = it.cat;
        var label = el('button', { class: 'ta-term-link', type: 'button' }, c.label);
        label.addEventListener('click', function () { select(it.idx); });
        linkEls[it.idx] = label;

        var parts = el('div', { class: 'ta-parts' });
        ITEMS.forEach(function (child) {
          if (child.kind !== 'term' || child.term.cat !== c.id) return;
          var link = el('button', { class: 'ta-term-link', type: 'button' }, child.term.name);
          link.addEventListener('click', function () { select(child.idx); });
          linkEls[child.idx] = link;
          parts.appendChild(link);
        });
        body.appendChild(el('tr', { class: it.idx > 0 ? 'role-table-divider' : '' }, [
          el('td', { class: 'role-table-cell-meta ta-cat-cell' }, label),
          el('td', { class: 'role-table-cell' }, parts),
        ]));
      });

      var table = el('table', { class: 'ta-table' }, [head, body]);
      nav.appendChild(el('div', { class: 'role-table-frame' }, table));
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    });

    buildNav();
    render();

    // If the serif face loads after first paint, re-measure everything.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { geomCache = {}; render(); });
    }
  };
})();
