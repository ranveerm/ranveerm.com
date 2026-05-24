// Horizontal scroll carousel with scale-on-center animation
// and dynamic text below for the currently highlighted item.
//
// Single-item collections are rendered as a static centred image
// with the caption below - no scroll track, no progress indicator.

(function() {
  // Styles live in _sass/_theme.scss under "Widget specifics: Carousel".
  // The class names are widget-scoped (animation, scroll-snap, single-vs-
  // multi variants) and don't promote to shared .role-* roles.

  function buildSingleItem(container, imageDir, entry) {
    container.classList.add('carousel-wrapper');

    var wrap = document.createElement('div');
    wrap.className = 'carousel-single';

    var img = document.createElement('img');
    img.className = 'carousel-single-image';
    img.src = imageDir + entry.photo;
    img.alt = entry.title || '';
    img.loading = 'lazy';
    wrap.appendChild(img);

    var textWrap = document.createElement('div');
    textWrap.className = 'carousel-text';
    textWrap.innerHTML =
      '<h4 class="carousel-title"></h4>' +
      '<p class="carousel-subtitle"></p>' +
      '<p class="carousel-description"></p>';
    textWrap.querySelector('.carousel-title').textContent       = entry.title       || '';
    textWrap.querySelector('.carousel-subtitle').textContent    = entry.subtitle    || '';
    textWrap.querySelector('.carousel-description').textContent = entry.description || '';
    wrap.appendChild(textWrap);

    container.appendChild(wrap);
  }

  window.createCarousel = function(imageDir, data, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var entries = JSON.parse(JSON.stringify(data));
    if (!entries.length) return;

    // For single-item collections, render a centred static layout rather
    // than a scroll track - the horizontal scroll affordance is misleading
    // when there is nothing to scroll through.
    if (entries.length === 1) {
      buildSingleItem(container, imageDir, entries[0]);
      return;
    }

    // Build DOM
    container.classList.add('carousel-wrapper');
    var track = document.createElement('div');
    track.className = 'carousel-track';
    entries.forEach(function(entry, i) {
      var item = document.createElement('div');
      item.className = 'carousel-item';
      item.dataset.index = i;
      var img = document.createElement('img');
      img.src = imageDir + entry.photo;
      img.alt = entry.title || '';
      img.loading = 'lazy';
      img.draggable = false;
      item.appendChild(img);
      track.appendChild(item);
    });

    var textWrap = document.createElement('div');
    textWrap.className = 'carousel-text';
    textWrap.innerHTML =
      '<h4 class="carousel-title"></h4>' +
      '<p class="carousel-subtitle"></p>' +
      '<p class="carousel-description"></p>';

    var indicator = document.createElement('div');
    indicator.className = 'carousel-indicator';
    indicator.innerHTML =
      '<div class="carousel-progress"><div class="carousel-progress-bar"></div></div>' +
      '<span class="carousel-count"></span>';

    container.appendChild(track);
    container.appendChild(indicator);
    container.appendChild(textWrap);

    var items = Array.from(track.querySelectorAll('.carousel-item'));
    var titleEl = textWrap.querySelector('.carousel-title');
    var subtitleEl = textWrap.querySelector('.carousel-subtitle');
    var descEl = textWrap.querySelector('.carousel-description');
    var progressBar = indicator.querySelector('.carousel-progress-bar');
    var countEl = indicator.querySelector('.carousel-count');
    var totalItems = entries.length;

    var currentIndex = -1;
    var textSwitchTimer = null;
    var heightReleaseTimer = null;
    var rafId = null;

    function setText(i) {
      var e = entries[i];
      titleEl.textContent = e.title || '';
      subtitleEl.textContent = e.subtitle || '';
      descEl.textContent = e.description || '';
    }

    function updateIndicator(i) {
      var pct = totalItems <= 1 ? 100 : ((i + 1) / totalItems) * 100;
      progressBar.style.width = pct + '%';
      countEl.textContent = (i + 1) + ' / ' + totalItems;
    }

    // Measure the natural height of `textWrap` as if style.height were
    // unset, without leaving it in that state on the next paint.
    function measureNaturalHeight() {
      var saved = textWrap.style.height;
      textWrap.style.height = 'auto';
      var h = textWrap.getBoundingClientRect().height;
      textWrap.style.height = saved;
      return h;
    }

    function changeText(newIndex, direction) {
      if (newIndex === currentIndex) return;
      var outClass = direction > 0 ? 'out-left' : 'out-right';
      var inClass = direction > 0 ? 'out-right' : 'out-left';
      currentIndex = newIndex;
      updateIndicator(newIndex);

      textWrap.classList.add(outClass);
      clearTimeout(textSwitchTimer);
      textSwitchTimer = setTimeout(function() {
        // Lock the current rendered height before swapping text so that the
        // subsequent `setText` can't cause an instant layout jump of the
        // content below us. We then animate from this locked height to the
        // new natural height via the `height` CSS transition.
        var fromHeight = textWrap.getBoundingClientRect().height;
        textWrap.style.height = fromHeight + 'px';

        setText(newIndex);
        textWrap.classList.remove(outClass);
        textWrap.classList.add(inClass);
        // Force reflow so the 'in' state animates
        textWrap.offsetHeight;
        textWrap.classList.remove(inClass);

        // Measure the new natural height (post-setText) and kick off the
        // height transition on the next frame - doing it in the same frame
        // as the style.height assignment above won't produce a transition.
        var toHeight = measureNaturalHeight();
        requestAnimationFrame(function() {
          textWrap.style.height = toHeight + 'px';
        });

        // After the transition completes, release the explicit height so
        // subsequent renders can grow/shrink naturally (e.g. window
        // resize, font loading).
        clearTimeout(heightReleaseTimer);
        heightReleaseTimer = setTimeout(function() {
          textWrap.style.height = '';
        }, 360);
      }, 200);
    }

    function render() {
      rafId = null;
      var trackRect = track.getBoundingClientRect();
      var centerX = trackRect.left + trackRect.width / 2;
      var maxDist = trackRect.width / 2;

      var closestIndex = 0;
      var closestDist = Infinity;

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var rect = item.getBoundingClientRect();
        var itemCenter = rect.left + rect.width / 2;
        var dist = Math.abs(itemCenter - centerX);

        // Scale: 1.0 at centre, ~0.65 one screen-width away.
        var t = dist / maxDist;
        if (t > 1) t = 1;
        var scale = 1 - t * 0.35;
        var opacity = 1 - t * 0.5;

        // Single assignment per property per frame - cheaper than writing
        // both transform and opacity unconditionally in a forEach closure.
        item.style.transform = 'scale(' + scale + ')';
        item.style.opacity = opacity;

        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
        }
      }

      if (closestIndex !== currentIndex) {
        var direction = closestIndex > currentIndex ? 1 : -1;
        changeText(closestIndex, direction);
      }
    }

    // Throttle scroll-driven updates to the animation frame rate. Running
    // layout reads + style writes synchronously on every scroll event
    // interferes with the browser's own scroll composition and produces
    // visible jank; rAF lets the browser batch everything for one paint.
    function scheduleRender() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(render);
    }

    track.addEventListener('scroll', scheduleRender, { passive: true });
    window.addEventListener('resize', scheduleRender);

    // Initial: show first item's text, then apply scales
    setText(0);
    updateIndicator(0);
    currentIndex = 0;
    requestAnimationFrame(render);
  };
})();
