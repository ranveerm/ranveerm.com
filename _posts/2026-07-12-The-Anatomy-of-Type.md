---
layout: post
title: Components of a Type
date: 2026-07-12 00:00:00 +1000
categories: jekyll update
tags: [LLM]
---

<!-- excerpt-start -->
<figure class="post-excerpt-thumb">{% include type-anatomy-guides-thumb.html %}</figure>
<!--end-excerpt-->

Explore the invisible lines and shapes that are instrumental for constructing symbols that we call text.

<div id="type-anatomy-demo"></div>

<section class="ta-section">
<hr class="post-divider">
<h2 class="role-post-section-heading">Anatomy</h2>

<p class="role-post-body ta-section-prose">Pick any part below and the specimen above redraws with that part alone picked out in colour. Each region is measured from the rendered letter rather than drawn by hand, so the highlight follows the real contour of whichever serif your system happens to render.</p>

<div id="type-anatomy-table"></div>
</section>

<section class="ta-section">
<hr class="post-divider">
<h2 class="role-post-section-heading">Terminology</h2>

<div class="role-table-frame">
<table class="ta-table">
  <thead class="role-table-head">
    <tr>
      <th class="role-table-head-cell">Terminology</th>
      <th class="role-table-head-cell">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="role-table-cell-meta ta-term-cell">Type</td>
      <td class="role-table-cell">Symbols representing letters, numerals and punctuation. The word survives from metal type, where each character really was a separate physical block.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Typeface</td>
      <td class="role-table-cell">Collection of types with a shared design philosophy. It is what makes Georgia recognisably Georgia at any size or weight.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Font</td>
      <td class="role-table-cell">One specific instance of a typeface, historically at one size and weight. In metal, 10pt Georgia Bold was a different font from 12pt Georgia Bold. Digitally the size has dropped out, so a font is now closer to one file.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Family</td>
      <td class="role-table-cell">A typeface and all its related variations, meaning roman and italic, the weights from light to black, and any condensed or extended widths.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Typography</td>
      <td class="role-table-cell">The craft of arranging type so that it can be read. It covers the choice of typeface, the size it is set at, and the spacing between letters, words and lines.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Glyph</td>
      <td class="role-table-cell">A single drawn shape in a font. Where type is the whole collection of symbols, a glyph is one particular drawing of one of them, which is why the two do not map one to one. The characters f and i can be drawn as a single glyph, the fi ligature, and a face may offer several glyphs for the same letter.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Character</td>
      <td class="role-table-cell">The abstract unit of writing, independent of how it looks. "A" is one character whether it is set in Georgia, in Didot, or in handwriting.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Weight</td>
      <td class="role-table-cell">How heavy the strokes are, running from hairline through regular to black. Weight changes stroke thickness, ideally without changing the letter's proportions.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Point Size</td>
      <td class="role-table-cell">A standard unit used to measure the height of a character.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Serif</td>
      <td class="role-table-cell">A face whose strokes end in the small finishing strokes described above. Sans-serif faces omit them, and the distinction is the oldest and coarsest way to sort typefaces.</td>
    </tr>
    <tr class="role-table-divider">
      <td class="role-table-cell-meta ta-term-cell">Tracking</td>
      <td class="role-table-cell">Uniform spacing applied across a run of text, as against kerning, which adjusts one specific pair.</td>
    </tr>
  </tbody>
</table>
</div>
</section>

<section class="ta-section">
<hr class="post-divider">
<h2 class="role-post-section-heading">Considerations</h2>

<p class="role-post-body ta-section-prose"><strong>Legibility</strong> is a property of the typeface, meaning how easily one character is told apart from another. It is decided by the anatomy above. Open apertures keep a c from closing into an o. A tall x-height gives the lowercase more room to differentiate itself. Distinct terminals stop an l, an uppercase I and a numeral 1 from collapsing into the same vertical mark.</p>

<p class="role-post-body ta-section-prose"><strong>Readability</strong> is a property of the setting, meaning how comfortably a passage can be read at length. This is where the spacing terms earn their keep. Generous leading stops the eye from dropping a line. Line length governs how far the eye must travel before finding the next line's start. A face can be highly legible and still read poorly if it is set too tight, too wide, or too small.</p>

<p class="role-post-body ta-section-prose">Type succeeds by not being noticed, because the moment a reader registers the letterforms, attention has moved from the text to its container. Everything on this page, the measured heights, the small curve softening the join where a stem meets its serif, the pair of letters nudged closer together, exists to be invisible. <strong>When legibility and readability are achieved, the details become hidden in plain sight.</strong></p>
</section>

<section class="ta-section">
<hr class="post-divider">
<h2 class="role-post-section-heading">Resources</h2>

<ul class="ta-resources">
  <li><a href="http://www.typography101.net/type_anatomy.html">Type anatomy (Typography 101)</a></li>
  <li><a href="https://visme.co/blog/type-anatomy/">The anatomy of type (Visme)</a></li>
  <li><a href="https://visualgui.com/2016/02/16/book-collection-typography/">Typography book collection (Visual Gui)</a></li>
  <li><a href="https://play.typedetail.com">Type Detail</a></li>
  <li><a href="https://www.modularscale.com">Modular Scale</a></li>
</ul>
</section>

<script type="text/javascript" src="/scripts/type-anatomy.js"></script>
<script type="text/javascript">createTypeAnatomy("type-anatomy-demo", "type-anatomy-table");</script>
