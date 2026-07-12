---
layout: post
title: Call My "Agent"
date: 2026-05-29 00:00:00 +1000
categories: jekyll update
tags: [LLM]
---

<!-- excerpt-start -->

If you've been entangled in the LLM whirlwind over the past few years and have started to use the word "agent" without a firm understanding of the concpets this word attempts to capture (much like the author of this post), the follwoing paragraphs hope to unpack the relevant details.

<!--end-excerpt-->

## Working Model

<figure class="role-viz-frame llm-pipeline-figure">{% include llm-pipeline.html %}</figure>
We will take the above model for the LLM interface as a given (to delve into this black box, see [Internals of a Large Language Model (LLM)]({% post_url 2026-05-06-The-Shape-of-a-Language-Model %})). This interface can be enhanced by augmenting capabilities ("Tools") to inspect and mutate content. One mechanism for the LLM to access these capabilities is via the [Model Context Protocol (MCP)]({% post_url 2026-04-27-Exploring-Model-Context-Protocol-MCP %}).

<figure class="role-viz-frame llm-pipeline-figure">{% include llm-augmented.html %}</figure>

## The Loop

Chaining several of these calls together, with a verification step that decides whether to iterate or stop, is, at a high level, an "agentic" loop. Press the check to keep iterating, or the cross to fail out and restart.

<figure id="chaining-demo" class="role-viz-frame llm-pipeline-figure chain-fig"></figure>
<script type="text/javascript" src="/scripts/chaining-animation.js"></script>
<script type="text/javascript">createChainingAnimation("chaining-demo");</script>

## Resources

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
