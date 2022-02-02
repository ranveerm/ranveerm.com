---
layout: photography
title: 📷
permalink: /photo-gallery/
---

<center>
    <h2>Raw Horizons B-Roll</h2>
    <h5 class="text-muted">Visit <a href="https://rawhorizons.gallery">Raw Horizons</a> for the good stuff</h5>
</center>

<br/>
<!-- Note that the clickable area needs to be span instead of div- https://stackoverflow.com/questions/4465923/a-href-link-for-entire-div-in-html-css -->
<div class="grid">
    <a href="/photo-gallery/phillipines-2019/" class="hover-zoom">
        <span>
            <img src="{{ layout.photo-gallery-root-dir | escape }}/philippines-2019/cover.jpg" class="centered-image">
            <p class="text-muted">🇵🇭 2019</p>
        </span>
    </a>
    <a href="/photo-gallery/hong-kong-2019/" class="hover-zoom">
        <span>
            <img src="{{ layout.photo-gallery-root-dir | escape }}/hong-kong-2019/cover.jpg" class="centered-image">
            <p class="text-muted">🇭🇰 2019</p>
        </span>
    </a>
    <a href="/photo-gallery/vietnam-2016/" class="hover-zoom">
        <span>
            <img src="{{ layout.photo-gallery-root-dir | escape }}/vietnam-2016/cover.jpg" class="centered-image">
            <p class="text-muted">🇻🇳 2016</p>
        </span>
    </a>
</div>