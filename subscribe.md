---
layout: default
title: Subscribe
permalink: /subscribe/
---

<style>
  /*
   * All colours below come from the site's design-system tokens defined
   * in _sass/_theme.scss. Palette follows data-theme automatically --
   * no need for a separate dark-mode block.
   */
  .subscribe-wrap {
    max-width: 640px;
    margin: 1.5rem auto 3rem;
    color: var(--color-ink-2);
  }
  .subscribe-wrap p { line-height: 1.6; }
  .subscribe-url {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: 1px solid var(--color-hairline);
    border-radius: 6px;
    overflow: hidden;
    margin: 1.2rem 0 1.8rem;
    background: var(--color-surface-2);
  }
  .subscribe-url input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0.65rem 0.9rem;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.85rem;
    color: var(--color-ink);
    outline: none;
  }
  .subscribe-url button {
    border: 0;
    border-left: 1px solid var(--color-hairline);
    background: var(--color-surface);
    padding: 0 1rem;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .subscribe-url button:hover {
    background: var(--color-accent);
    color: #fff;
  }
  .subscribe-url button.copied {
    background: #2e8b57;
    color: #fff;
  }

  .subscribe-raw {
    font-size: 0.85rem;
    color: var(--color-muted);
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-hairline);
  }
  /* Inherit the global <a> rule (coral accent) -- don't override. */
</style>

<div class="subscribe-wrap">
  <p>
    New posts are published via RSS, an open format that lets you follow the
    site in any reader app without giving up an email address or logging in
    anywhere. Copy the feed URL below into the reader you already use.
  </p>

  <div class="subscribe-url">
    <input id="feed-url" type="text" readonly value="{{ '/feed.xml' | absolute_url }}">
    <button id="feed-copy" type="button">Copy</button>
  </div>

  <p class="subscribe-raw">
    Prefer the raw feed? <a href="{{ '/feed.xml' | relative_url }}">View feed.xml</a>.
  </p>
</div>

<script>
  (function() {
    var btn = document.getElementById('feed-copy');
    var input = document.getElementById('feed-url');
    if (!btn || !input) return;
    btn.addEventListener('click', function() {
      navigator.clipboard.writeText(input.value).then(function() {
        var original = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1400);
      });
    });
  })();
</script>
