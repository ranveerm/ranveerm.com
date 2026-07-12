/*
 * title-transform.js -- post-title easter egg.
 *
 * Clicking (or Enter/Space on) a post's <h1 class="post-title"> cycles it
 * through thematic representations of the same text:
 *
 *   0. normal    -- the title as set
 *   1. binary    -- the title fades out and its 8-bit character codes resolve
 *                   in one octet at a time, left to right
 *   2. letterpress -- the title shown mirrored (scaleX(-1)) in the serif face,
 *                   as type sits backwards on the press, then flips the right
 *                   way round as if printed
 *   3. mediaeval -- a scribal blackletter, inked in glyph by glyph left to
 *                   right, as if written by hand
 *
 * A fourth click returns to normal. The accessible name stays the original
 * title (aria-label) so screen readers never read binary/mirrored glyphs.
 *
 * The binary and mediaeval states reveal per character via .tt-ch spans (built
 * already hidden, then unhidden one at a time); the normal and letterpress
 * states cross-dissolve via the .tt-face wrapper. Class names only: every paint
 * value lives in _sass/_theme.scss (Widget specifics: title transform). Display
 * faces (IM Fell English, UnifrakturMaguntia) are lazy-loaded from Google Fonts
 * on first intent.
 */
(function () {
  'use strict';

  var STAGES = 4;         // normal, binary, letterpress, mediaeval
  var DISSOLVE = 300;     // ms the outgoing state stays hidden mid-fade
  var BIT_STEP = 60;      // ms between octets revealing left to right
  var REVEAL_DUR = 350;   // ms a single octet takes to settle in
  var INK_STEP = 65;      // ms between glyphs inking in for the scribe hand
  var INK_DUR = 500;      // ms a single glyph takes to settle
  var PRINT_DELAY = 1100; // ms the type sits mirrored before the press prints it

  function toBinaryChar(ch) {
    var bits = ch.charCodeAt(0).toString(2);
    while (bits.length < 8) bits = '0' + bits;
    return bits;
  }

  // Inject the display faces once, on first intent, so pages nobody
  // interacts with never pay for them.
  function ensureFonts() {
    if (document.getElementById('tt-fonts')) return;
    var pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    var pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
    var css = document.createElement('link');
    css.id = 'tt-fonts'; css.rel = 'stylesheet';
    css.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=UnifrakturMaguntia&display=swap';
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(css);
  }

  function init() {
    var h1 = document.querySelector('article.post .post-title');
    if (!h1 || h1.classList.contains('tt')) return;
    var original = (h1.textContent || '').trim();
    if (!original) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    h1.classList.add('tt');
    h1.setAttribute('tabindex', '0');
    h1.setAttribute('aria-label', original);   // lock the accessible name to the real title
    h1.title = 'Click to transform';

    var face = document.createElement('span'); face.className = 'tt-face';
    var type = document.createElement('span'); type.className = 'tt-type';
    type.textContent = original;
    face.appendChild(type);
    h1.textContent = '';
    h1.appendChild(face);

    var state = 0, busy = false, timers = [];
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
    }

    function setStateClass(next) {
      h1.classList.remove('tt-binary', 'tt-mirror', 'tt-medieval', 'tt-printed');
      if (next === 1) h1.classList.add('tt-binary');
      else if (next === 2) h1.classList.add('tt-mirror');
      else if (next === 3) h1.classList.add('tt-medieval');
    }

    // One span per character of the original, each carrying contentFn(i).
    function buildSpans(contentFn) {
      type.textContent = '';
      var spans = [];
      for (var i = 0; i < original.length; i++) {
        var s = document.createElement('span');
        s.className = 'tt-ch';
        s.textContent = contentFn(i);
        type.appendChild(s);
        spans.push(s);
      }
      return spans;
    }
    function letterAt(i) { return original.charAt(i); }
    function octetAt(i) { return toBinaryChar(original.charAt(i)); }

    // Plain-text states (normal, letterpress): fade out, swap while hidden, fade in.
    function dissolveTo(paint, done) {
      face.classList.add('tt-out');
      after(DISSOLVE, function () {
        type.classList.add('tt-instant');
        paint();
        void type.offsetWidth;               // commit the swap before re-enabling transitions
        type.classList.remove('tt-instant');
        face.classList.remove('tt-out');
        if (done) done();
      });
    }

    // Staged states (binary, mediaeval): fade the old state out, build the new
    // glyphs already hidden, then reveal them one at a time, left to right. The
    // glyphs are built in their final form (octet / blackletter letter), so no
    // intermediate representation ever flashes.
    function revealSequence(stateIdx, contentFn, step, dur, done) {
      face.classList.add('tt-out');
      after(DISSOLVE, function () {
        type.classList.add('tt-instant');
        setStateClass(stateIdx);
        var spans = buildSpans(contentFn);
        for (var i = 0; i < spans.length; i++) spans[i].classList.add('tt-ch-hidden');
        void type.offsetWidth;
        type.classList.remove('tt-instant');
        face.classList.remove('tt-out');     // wrapper visible; glyphs still individually hidden
        spans.forEach(function (s, i) {
          after(i * step, function () { s.classList.remove('tt-ch-hidden'); });
        });
        after((spans.length - 1) * step + dur, done);
      });
    }

    function toNormal(done) {
      dissolveTo(function () { setStateClass(0); type.textContent = original; }, done);
    }

    // Letterpress: the type sits backwards, then the press prints it the right
    // way round (scaleX flip). No caption -- the flip alone tells the story.
    function toMirror(done) {
      dissolveTo(
        function () { setStateClass(2); type.textContent = original; },
        function () {
          done();
          after(PRINT_DELAY, function () { h1.classList.add('tt-printed'); });
        }
      );
    }

    function toBinary(done) { revealSequence(1, octetAt, BIT_STEP, REVEAL_DUR, done); }
    function toMedieval(done) { revealSequence(3, letterAt, INK_STEP, INK_DUR, done); }

    function paintInstant(next) {
      setStateClass(next);
      if (next === 1) { buildSpans(octetAt); }
      else { type.textContent = original; if (next === 2) h1.classList.add('tt-printed'); }
    }

    function advance() {
      if (busy) return;
      ensureFonts();
      clearTimers();
      var next = (state + 1) % STAGES;

      if (reduce) { paintInstant(next); state = next; return; }

      busy = true;
      var done = function () { state = next; busy = false; };
      if (next === 1) toBinary(done);
      else if (next === 2) toMirror(done);
      else if (next === 3) toMedieval(done);
      else toNormal(done);
    }

    h1.addEventListener('click', advance);
    h1.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    });
    h1.addEventListener('pointerenter', ensureFonts, { once: true });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
