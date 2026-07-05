---
layout: post
title: Call My "Agent"
date: 2026-05-29 00:00:00 +1000
categories: jekyll update
tags: [LLM]
---

<!-- excerpt-start -->

The word "agent" have been used with greater frequency over the last few years. I seemed
to have started using this word without a deep understanding of the overarching concept. This
article aims to provide an exploration of this term.

<!--end-excerpt-->

## The Beginning

<figure class="role-viz-frame llm-pipeline-figure">{% include llm-pipeline.html %}</figure>
We will take the above model for the LLM interface as a given (to delve into this black box, see [Internals of a Large Language Model (LLM)]({% post_url 2026-05-06-The-Shape-of-a-Language-Model %})). This interface can be enhanced by augmenting capabilities ("Tools") to inspect and mutate content. One mechanism for the LLM to access these capabilities is via the [Model Context Protocol (MCP)]({% post_url 2026-04-27-Exploring-Model-Context-Protocol-MCP %}).

<figure class="role-viz-frame llm-pipeline-figure">{% include llm-augmented.html %}</figure>

Stringing several of these calls together, with a verification step that decides whether to iterate or stop, is the rough shape of an "agentic" loop. Press the check to keep iterating, or the cross to fail out and restart.

<figure id="chaining-demo" class="role-viz-frame llm-pipeline-figure chain-fig"></figure>
<script type="text/javascript" src="/scripts/chaining-animation.js"></script>
<script type="text/javascript">createChainingAnimation("chaining-demo");</script>

## Resources

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
