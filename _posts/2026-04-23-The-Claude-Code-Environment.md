---
layout: post
title: Claude Code Environment
date: 2026-04-23 00:05:00 +1100
categories: jekyll update
tags: [LLM]
---

<!-- excerpt-start -->

Each component in the Claude Code environment, including <span class="ce-term-link" data-layer="memory">instructions files</span>, <span class="ce-term-link" data-layer="config">settings</span>, <span class="ce-term-link" data-layer="invocable">skills</span>, <span class="ce-term-link" data-layer="delegation">agents</span>, <span class="ce-term-link" data-layer="automation">hooks</span> and <span class="ce-term-link" data-layer="external">MCP servers</span>, shapes how the model interprets intent, chooses tools, and produces output. The widget below lets you step through the layers and see which files sit where, with a bidirectional map: click a layer to see its files, click a file to jump back to its layer.

<!--end-excerpt-->

<style>
.ce-term-link {
  cursor: pointer;
  text-decoration-line: underline;
  text-decoration-color: var(--ink-faint);
  text-underline-offset: 3px;
}
</style>

<div id="claudeenv-demo"></div>
<script type="text/javascript" src="/scripts/claude-environment.js"></script>
<script type="text/javascript">
  var _ceEnv = createClaudeEnvironment("claudeenv-demo");
  document.querySelectorAll('.ce-term-link').forEach(function(span) {
    span.addEventListener('mouseenter', function() { _ceEnv.highlightBand(span.dataset.layer); });
    span.addEventListener('mouseleave', function() { _ceEnv.clearBandHighlight(); });
    span.addEventListener('click', function(e) {
      e.stopPropagation();
      _ceEnv.selectLayer(span.dataset.layer);
    });
  });
</script>
