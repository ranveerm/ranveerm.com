---
layout: post
title: Exploring Model Context Protocol (MCP)
date: 2026-04-27 00:00:00 +1000
categories: jekyll update
tags: [LLM]
---

<div class="role-code-prompt" style="display:flex;gap:8px;padding:16px 18px;max-width:640px;margin:0 0 22px;">
  <span class="role-code-prompt-glyph" style="user-select:none">claude&gt;</span>
  <span class="mcp-typed-text"></span>
</div>

<!-- excerpt-start -->

MCP (Model Context Protocol) is the open standard that lets any LLM application connect to any external system. An external system might be a database, a filesystem, an API, or some other service; the intent, broadly, is to make LLM applications more useful without duplicating integration effort across every host and every system that wishes to participate.

<!--end-excerpt-->

<div id="mcp-demo"></div>
<script type="text/javascript" src="/scripts/mcp-exploration.js"></script>
<script type="text/javascript">
  createMCPExploration("mcp-demo");
</script>
