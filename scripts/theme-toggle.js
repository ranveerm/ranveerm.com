// Theme toggle — click the .theme-toggle button to flip between light
// and dark. Persists the choice to localStorage under 'eh-theme'; the
// inline bootstrap script in head.html reads the same key *before first
// paint* so the page never flashes the wrong palette.
//
// Uses event delegation so the script works regardless of when the
// button is injected into the DOM (e.g. if a future page adds one).
(function() {
  'use strict';

  var STORAGE_KEY = 'eh-theme';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* quota / privacy */ }
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (!btn) return;
    e.preventDefault();
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  // If the user hasn't set a preference and the OS preference flips
  // mid-session, follow it. We only sync while unset — any explicit
  // toggle via the button writes to storage and takes over.
  if (window.matchMedia) {
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var listener = function(e) {
      var stored = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) {}
      if (stored) return;
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };
    if (mql.addEventListener) mql.addEventListener('change', listener);
    else if (mql.addListener) mql.addListener(listener);
  }
})();
