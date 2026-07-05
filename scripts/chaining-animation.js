/*
 * chaining-animation.js -- interactive "agentic chaining" diagram for the
 * Call My "Agent" post.
 *
 * One iteration of the chain is laid out like the other figures in the post:
 *   Input -> LLM -> Output -> Verify, with a Tools node hanging *below* the
 *   LLM (a call arrow down and a response arrow back up).
 * The first iteration reveals one element at a time, in place. Once built, a
 * pass/fail decision appears above the Verify circle:
 *   - PASS (check): an arrow grows out of Verify into a fresh Input and the
 *     build replays node-by-node, while a fixed horizontal window pans left
 *     at a constant speed -- new nodes fade in as they cross into view and
 *     spent ones clip off the left edge, until the next Verify parks again.
 *     The reader cannot scroll it by hand; the animation drives it.
 *   - FAIL (cross): the flow routes down to a Fail node and a Restart control
 *     appears.
 *
 * Node/connector colour + type come from the upstream .role-viz-graphic-*
 * classes; the Verify node uses .role-viz-graphic-node-circle. This file only
 * assigns class names, toggles a `.chain-on` visibility class, and sets the
 * track's translateX -- every paint value lives in _sass/_theme.scss (Widget
 * specifics: chaining animation).
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var PITCH = 550;        // horizontal distance between successive iterations
  var BASE = 60;          // track offset that parks iteration 0's Verify at the decision point (x=470)
  var STAGGER = 380;      // gap between reveals during the in-place first build
  var SCROLL_MS = 2600;   // pan duration on pass; must match the .chain-track transition
  // Reveal progress (fraction of the pan) for each appended element, indexed
  // by its data-seq: 0 = the Verify->Input link arrow, 1..10 = Input, arrow,
  // LLM, call-down, Tools, response-up, arrow, Output, arrow, Verify. Tuned so
  // each element fades in roughly as it reaches the build front on the right.
  var SCROLL_P = [0.03, 0.18, 0.30, 0.42, 0.49, 0.55, 0.61, 0.71, 0.81, 0.90, 0.97];

  // One iteration block, drawn in local coords then shifted by i * PITCH.
  // Every element starts hidden (revealed by timing). `withLink` prepends the
  // arrow from the previous iteration's Verify into this iteration's Input.
  function blockSVG(i, withLink) {
    function el(n, inner) { return '<g class="chain-el" data-seq="' + n + '">' + inner + '</g>'; }
    function nodeBox(cx, y, label) {
      return '<rect class="role-viz-graphic-node-outline" x="' + (cx - 42) + '" y="' + y + '" width="84" height="48" rx="8"/>' +
        '<text class="role-viz-graphic-node-outline" x="' + cx + '" y="' + (y + 29) + '" text-anchor="middle">' + label + '</text>';
    }
    function flow(d) {
      return '<path class="role-viz-graphic-connector-thick" d="' + d + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    var p = [];
    p.push('<g class="chain-block" data-iter="' + i + '" transform="translate(' + (i * PITCH) + ',0)">');
    if (withLink) {
      // Continuation ellipsis: sits to the left of the incoming arrow once
      // this iteration has scrolled into place, marking the spent iterations
      // that have left the window. Revealed only after the pan settles.
      p.push('<g class="chain-el chain-tail">' +
        '<circle cx="-146" cy="90" r="2.5"/><circle cx="-136" cy="90" r="2.5"/><circle cx="-126" cy="90" r="2.5"/></g>');
      p.push(el(0, flow('M-106 90 L-44 90 M-50 85 L-44 90 L-50 95')));
    }
    p.push(el(1, nodeBox(0, 66, 'Input')));
    p.push(el(2, flow('M44 90 L96 90 M90 85 L96 90 L90 95')));
    p.push(el(3, nodeBox(140, 66, 'LLM')));
    // Tools hangs below the LLM: a dashed call arrow down, a dashed response arrow up.
    p.push(el(4, '<path class="role-viz-graphic-connector" d="M132 116 L132 148" stroke-dasharray="3 3" stroke-linecap="round"/>' +
      '<path class="role-viz-graphic-connector" d="M127 142 L132 148 L137 142" stroke-linecap="round" stroke-linejoin="round"/>'));
    p.push(el(5, nodeBox(140, 152, 'Tools')));
    p.push(el(6, '<path class="role-viz-graphic-connector" d="M148 148 L148 116" stroke-dasharray="3 3" stroke-linecap="round"/>' +
      '<path class="role-viz-graphic-connector" d="M143 122 L148 116 L153 122" stroke-linecap="round" stroke-linejoin="round"/>'));
    p.push(el(7, flow('M184 90 L236 90 M230 85 L236 90 L230 95')));
    p.push(el(8, nodeBox(280, 66, 'Output')));
    p.push(el(9, flow('M324 90 L376 90 M370 85 L376 90 L370 95')));
    p.push(el(10, '<circle class="role-viz-graphic-node-outline" cx="410" cy="90" r="32"/>' +
      '<text class="role-viz-graphic-node-outline" x="410" y="95" text-anchor="middle">Verify</text>'));
    p.push('</g>');
    return p.join('');
  }

  function buildSVG() {
    var s = [];
    s.push('<svg class="chain-svg" viewBox="-106 0 646 250" xmlns="' + SVGNS + '" ' +
      'aria-label="Interactive chaining diagram. One iteration runs Input, LLM (with a Tools node below it), Output and a Verify step. ' +
      'Choose pass to chain a fresh iteration on to the right, or fail to route to a Fail node and restart.">');
    s.push('<title>Agentic chaining window</title>');
    // The scrolling conveyor of iteration blocks.
    s.push('<g class="chain-track"></g>');
    // Fixed decision overlay above the parked Verify (x=470). No connecting lines.
    s.push('<g class="chain-el chain-decision">');
    s.push('<g class="chain-btn chain-check" role="button" tabindex="-1" aria-label="Pass: chain on to the next iteration">' +
      '<circle cx="452" cy="30" r="15"/><path d="M446 30 L450 35 L459 23"/></g>');
    s.push('<g class="chain-btn chain-cross" role="button" tabindex="-1" aria-label="Fail: route to the fail node">' +
      '<circle cx="488" cy="30" r="15"/><path d="M483 25 L493 35 M493 25 L483 35"/></g>');
    s.push('</g>');
    // Fixed fail overlay below the parked Verify.
    s.push('<g class="chain-el chain-fail">');
    s.push('<path class="role-viz-graphic-connector-thick" d="M470 124 L470 148 M464 142 L470 148 L476 142" stroke-linecap="round" stroke-linejoin="round"/>');
    s.push('<rect class="chain-fail-node" x="428" y="150" width="84" height="48" rx="8"/>');
    s.push('<text class="chain-fail-label" x="470" y="179" text-anchor="middle">Fail</text>');
    s.push('</g>');
    s.push('<g class="chain-el chain-btn chain-restart" role="button" tabindex="-1" aria-label="Restart the animation">' +
      '<rect x="422" y="214" width="96" height="24" rx="12"/>' +
      '<text class="chain-restart-label" x="470" y="230" text-anchor="middle">Restart</text></g>');
    s.push('</svg>');
    return s.join('');
  }

  function createChainingAnimation(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = buildSVG();
    var svg = root.querySelector('svg');
    var track = svg.querySelector('.chain-track');

    var gen = 0;
    var timers = [];
    var cur = 0;
    var phase = 'idle';   // idle | building | decision | scrolling | fail -- gates the buttons
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function clearTimers() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }
    function later(fn, ms, g) { timers.push(setTimeout(function () { if (g === gen) fn(); }, ms)); }
    function on(sel, val) { svg.querySelectorAll(sel).forEach(function (e) { e.classList.toggle('chain-on', val); }); }
    function focusable(sel, yes) { svg.querySelectorAll(sel).forEach(function (e) { e.setAttribute('tabindex', yes ? '0' : '-1'); }); }

    function setTrack(offset, animate) {
      if (!animate) track.classList.add('chain-no-anim');
      track.style.transform = 'translateX(' + offset + 'px)';
      if (!animate) { void track.getBoundingClientRect(); track.classList.remove('chain-no-anim'); }
    }
    function appendBlock(i, withLink) {
      if (track.querySelector('.chain-block[data-iter="' + i + '"]')) return;
      var holder = document.createElementNS(SVGNS, 'svg');
      holder.innerHTML = blockSVG(i, withLink);
      track.appendChild(holder.firstChild);
    }
    function blockEls(i) {
      var block = track.querySelector('.chain-block[data-iter="' + i + '"]');
      var els = Array.prototype.slice.call(block.querySelectorAll('.chain-el[data-seq]'));
      els.sort(function (a, b) { return (+a.getAttribute('data-seq')) - (+b.getAttribute('data-seq')); });
      return els;
    }
    function pruneBlocks(minKeep) {
      track.querySelectorAll('.chain-block').forEach(function (b) {
        if ((+b.getAttribute('data-iter')) < minKeep) { b.parentNode.removeChild(b); }
      });
    }

    // Iteration 0: build in place (no pan), one node at a time.
    function build() {
      gen++;
      var g = gen;
      phase = 'building';
      clearTimers();
      track.innerHTML = '';
      cur = 0;
      setTrack(BASE, false);
      on('.chain-decision, .chain-fail, .chain-restart', false);
      focusable('.chain-check, .chain-cross, .chain-restart', false);

      appendBlock(0, false);
      var steps = blockEls(0);
      if (reduce) {
        steps.forEach(function (e) { e.classList.add('chain-on'); });
        showDecision();
        return;
      }
      steps.forEach(function (e, i) { later(function () { e.classList.add('chain-on'); }, 250 + i * STAGGER, g); });
      later(showDecision, 250 + steps.length * STAGGER + 250, g);
    }

    function showDecision() {
      phase = 'decision';
      on('.chain-decision', true);
      focusable('.chain-check, .chain-cross', true);
    }

    // Pass: chain a fresh iteration on to the right and pan the window left
    // while it rebuilds node-by-node.
    function pass() {
      if (phase !== 'decision') return;
      gen++;
      var g = gen;
      phase = 'scrolling';
      clearTimers();
      focusable('.chain-check, .chain-cross', false);
      on('.chain-decision', false);

      var next = cur + 1;
      appendBlock(next, true);                 // hidden elements + the Verify->Input link arrow
      var els = blockEls(next);
      setTrack(BASE - next * PITCH, true);      // constant-speed pan one iteration to the left

      function settle() {
        cur = next;
        pruneBlocks(cur);                       // drop the iteration that has clipped off the left
        on('.chain-block[data-iter="' + next + '"] .chain-tail', true); // fade in the continuation ellipsis
        showDecision();
      }
      if (reduce) {
        els.forEach(function (e) { e.classList.add('chain-on'); });
        settle();
        return;
      }
      els.forEach(function (e) {
        var s = +e.getAttribute('data-seq');
        later(function () { e.classList.add('chain-on'); }, Math.round(SCROLL_P[s] * SCROLL_MS), g);
      });
      later(settle, SCROLL_MS + 150, g);
    }

    function fail() {
      if (phase !== 'decision') return;
      gen++;
      var g = gen;
      phase = 'fail';
      clearTimers();
      focusable('.chain-check, .chain-cross', false);
      on('.chain-decision', false);
      on('.chain-fail', true);
      later(function () { on('.chain-restart', true); focusable('.chain-restart', true); }, 450, g);
    }

    function bindBtn(sel, fn) {
      var el = svg.querySelector(sel);
      if (!el) return;
      // Blur after acting: the button hides as part of the action, so leaving
      // it focused would strand the focus ring on an invisible control.
      function act() { fn(); if (el.blur) el.blur(); }
      el.addEventListener('click', act);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); act(); }
      });
    }
    bindBtn('.chain-check', pass);
    bindBtn('.chain-cross', fail);
    bindBtn('.chain-restart', build);

    var started = false;
    function kick() { if (!started) { started = true; build(); } }
    function inView() {
      var r = root.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh * 0.75 && r.bottom > vh * 0.2;
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { kick(); io.disconnect(); } });
      }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
      io.observe(root);
    }
    var onScroll = function () { if (inView()) { kick(); window.removeEventListener('scroll', onScroll); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    (function poll(n) {
      if (started) return;
      if (inView()) { kick(); return; }
      if (n > 0) setTimeout(function () { poll(n - 1); }, 250);
    })(10);
  }

  window.createChainingAnimation = createChainingAnimation;
})();
