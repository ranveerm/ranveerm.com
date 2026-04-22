---
layout: post
title: Claude Code Environment
date: 2026-04-23 00:05:00 +1100
categories: jekyll update
tags: [LLM]
---

<!-- excerpt-start -->

Each component in the Claude Code environment, including instructions files, settings, skills, agents, hooks and MCP servers, shapes how the model interprets intent, chooses tools, and produces output. The widget below lets you step through the layers and see which files sit where, with a bidirectional map: click a layer to see its files, click a file to jump back to its layer.

<!--end-excerpt-->

<div id="claudeenv-demo"></div>
<script type="text/javascript" src="/scripts/claude-environment.js"></script>
<script type="text/javascript">
    createClaudeEnvironment("claudeenv-demo");
</script>
