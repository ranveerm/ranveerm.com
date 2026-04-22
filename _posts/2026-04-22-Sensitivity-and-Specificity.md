---
layout: post
title: Sensitivity and Specificity
date: 2026-04-22 10:00:00 +1100
categories: jekyll update
tags: [mathematics, LLM]
---

<!-- excerpt-start -->

Two numbers describe how well a binary classifier picks out the cases it is
meant to find. **Sensitivity** is the chance the test flags a genuine
positive; **specificity** is the chance it correctly clears a genuine
negative. The widget below simulates a population of 200 people and lets you
drag the three underlying dials — prevalence, sensitivity, specificity —
to see how the confusion matrix, the positive/negative predictive values,
and the four outcome groups shift in response.

<!--end-excerpt-->

<div id="sensspec-demo"></div>
<script type="text/javascript" src="/scripts/sensitivity-specificity.js"></script>
<script type="text/javascript">
    createSensitivitySpecificity("sensspec-demo");
</script>
