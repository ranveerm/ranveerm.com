// Horizontal scroll carousel with scale-on-center animation
// and dynamic text below for the currently highlighted item.

(function() {
  var stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.carousel-wrapper { margin: 30px 0; }',
      '.carousel-track {',
      '  display: flex;',
      '  overflow-x: auto;',
      '  scroll-snap-type: x mandatory;',
      '  -webkit-overflow-scrolling: touch;',
      '  gap: 40px;',
      '  padding: 50px 0;',
      '  scrollbar-width: none;',
      '}',
      '.carousel-track::-webkit-scrollbar { display: none; }',
      '.carousel-item {',
      '  flex: 0 0 240px;',
      '  height: 280px;',
      '  scroll-snap-align: center;',
      '  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;',
      '  transform-origin: center center;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transform: scale(0.7);',
      '  opacity: 0.55;',
      '}',
      '.carousel-item:first-child { margin-left: calc(50% - 120px); }',
      '.carousel-item:last-child { margin-right: calc(50% - 120px); }',
      '.carousel-item img {',
      '  max-width: 100%;',
      '  max-height: 100%;',
      '  object-fit: contain;',
      '  border-radius: 10px;',
      '  display: block;',
      '  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);',
      '}',
      '.carousel-text {',
      '  text-align: center;',
      '  padding: 0 20px;',
      '  max-width: 600px;',
      '  margin: 0 auto 40px;',
      '  min-height: 140px;',
      '  transition: opacity 0.25s ease, transform 0.25s ease;',
      '}',
      '.carousel-text.out-left {',
      '  opacity: 0;',
      '  transform: translateX(-20px);',
      '}',
      '.carousel-text.out-right {',
      '  opacity: 0;',
      '  transform: translateX(20px);',
      '}',
      '.carousel-text .carousel-title { margin: 0 0 6px; }',
      '.carousel-text .carousel-subtitle { color: #999; margin: 0 0 10px; font-style: italic; }',
      '.carousel-text .carousel-description { margin: 0; }',
      '.carousel-text .carousel-subtitle:empty,',
      '.carousel-text .carousel-description:empty { display: none; }',
      '.carousel-indicator {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 12px;',
      '  margin: 0 auto 10px;',
      '  max-width: 400px;',
      '  font-size: 0.85em;',
      '  color: #999;',
      '}',
      '.carousel-progress {',
      '  flex: 1;',
      '  height: 3px;',
      '  background: rgba(106, 159, 181, 0.15);',
      '  border-radius: 2px;',
      '  overflow: hidden;',
      '}',
      '.carousel-progress-bar {',
      '  height: 100%;',
      '  background: rgba(106, 159, 181, 0.75);',
      '  border-radius: 2px;',
      '  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
      '  width: 0%;',
      '}',
      '.carousel-count {',
      '  font-variant-numeric: tabular-nums;',
      '  white-space: nowrap;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.createCarousel = function(imageDir, data, containerId) {
    injectStyles();

    var container = document.getElementById(containerId);
    if (!container) return;

    var entries = JSON.parse(JSON.stringify(data));
    if (!entries.length) return;

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
      item.appendChild(img);
      track.appendChild(item);
    });

    var textWrap = document.createElement('div');
    textWrap.className = 'carousel-text';
    textWrap.innerHTML =
      '<h4 class="carousel-title"></h4>' +
      '<p class="carousel-subtitle subtitle"></p>' +
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

    function changeText(newIndex, direction) {
      if (newIndex === currentIndex) return;
      var outClass = direction > 0 ? 'out-left' : 'out-right';
      var inClass = direction > 0 ? 'out-right' : 'out-left';
      currentIndex = newIndex;
      updateIndicator(newIndex);

      textWrap.classList.add(outClass);
      clearTimeout(textSwitchTimer);
      textSwitchTimer = setTimeout(function() {
        setText(newIndex);
        textWrap.classList.remove(outClass);
        textWrap.classList.add(inClass);
        // Force reflow so the 'in' state animates
        textWrap.offsetHeight;
        textWrap.classList.remove(inClass);
      }, 200);
    }

    function updateView() {
      var trackRect = track.getBoundingClientRect();
      var centerX = trackRect.left + trackRect.width / 2;
      var maxDist = trackRect.width / 2;

      var closestIndex = 0;
      var closestDist = Infinity;

      items.forEach(function(item, i) {
        var rect = item.getBoundingClientRect();
        var itemCenter = rect.left + rect.width / 2;
        var dist = Math.abs(itemCenter - centerX);

        // Scale: 1.0 at center, ~0.65 at one screen-width away
        var t = Math.min(1, dist / maxDist);
        var scale = 1 - t * 0.35;
        var opacity = 1 - t * 0.5;

        item.style.transform = 'scale(' + scale + ')';
        item.style.opacity = opacity;

        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
        }
      });

      if (closestIndex !== currentIndex) {
        var direction = closestIndex > currentIndex ? 1 : -1;
        changeText(closestIndex, direction);
      }
    }

    track.addEventListener('scroll', updateView, { passive: true });
    window.addEventListener('resize', updateView);

    // Initial: show first item's text, then apply scales
    setText(0);
    updateIndicator(0);
    currentIndex = 0;
    requestAnimationFrame(updateView);
  };
})();
