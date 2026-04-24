---
layout: default
title: Subscribe
permalink: /subscribe/
---

<style>
  .subscribe-wrap {
    max-width: 640px;
    margin: 1.5rem auto 3rem;
    color: #333;
  }
  .subscribe-wrap p { line-height: 1.6; }
  .subscribe-url {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    overflow: hidden;
    margin: 1.2rem 0 1.8rem;
    background: #fafafa;
  }
  .subscribe-url input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0.65rem 0.9rem;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.85rem;
    color: #333;
    outline: none;
  }
  .subscribe-url button {
    border: 0;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
    background: #fff;
    padding: 0 1rem;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #555;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .subscribe-url button:hover { background: #6a9fb5; color: #fff; }
  .subscribe-url button.copied { background: #2e8b57; color: #fff; }

  .subscribe-raw {
    font-size: 0.85rem;
    color: #777;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
  .subscribe-raw a { color: #6a9fb5; }
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
