---
layout: default
title: Journal Mapper
permalink: /journal-mapper/
---

<style>
  /* Page-scoped layout. Typography pulls from the design language
     role classes (.post-title, .post-deck, .role-post-body, etc.). */
  .jm-hero { text-align: center; padding: 24px 0 12px; }
  .jm-hero .post-title { text-align: center; }

  .jm-icon {
    width: min(45%, 220px);
    border-radius: 22%;
    margin: 8px auto 24px;
    display: block;
  }

  .jm-rule {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 32px 0;
  }

  .jm-lede {
    text-align: center;
    max-width: 56ch;
    margin: 0 auto 40px;
  }

  .jm-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px 40px;
    align-items: center;
    margin: 32px 0;
  }
  .jm-grid img {
    max-width: 100%;
    max-height: 480px;
    margin: 0 auto;
    display: block;
  }
  .jm-grid p { margin: 0; }

  @media (max-width: 600px) {
    .jm-grid { grid-template-columns: 1fr; gap: 16px; }
  }

  .jm-section { text-align: center; margin: 48px 0; }
  .jm-section .page-heading { margin: 0 auto 12px; }
  .jm-section-body { max-width: 56ch; margin: 0 auto 24px; }
  .jm-section img { max-width: 100%; display: block; margin: 24px auto 0; }

  .jm-cta {
    display: block;
    max-width: 220px;
    margin: 16px auto 8px;
  }
  .jm-cta img { width: 100%; display: block; }

  .jm-privacy { display: block; text-align: center; margin: 32px 0 16px; }
</style>

<header class="jm-hero">
  <img src="/assets/images/journal-mapper/app-icon.jpg" alt="Journal Mapper app icon" class="jm-icon">
  <h1 class="post-title">Journal Mapper</h1>
  <p class="post-deck">Diary on a map</p>
</header>

<hr class="jm-rule">

<p class="role-post-body jm-lede">Your spatial journal to store 💾, organise 🗂 and review 📖 information related to points of interest 📍 in the real world 🌏.</p>

<div class="jm-grid">
  <img src="/assets/images/journal-mapper/overview.png" alt="Map overview">
  <p class="role-post-body">Journal Mapper offers a fresh perspective on a personal journal, with a focus on locations as opposed to dates. Use the map as your canvas to create delightful annotations to store memories, future plans, reference material and everything in between.</p>

  <p class="role-post-body">Create categories to organise locations and selectively display them on the map.</p>
  <img src="/assets/images/journal-mapper/categories.png" alt="Categories">

  <img src="/assets/images/journal-mapper/icon.png" alt="Annotation customisation">
  <p class="role-post-body">Modify the appearance of any annotation and category to create a visual description that matches their identity.</p>

  <p class="role-post-body">Add notes and images to each annotation to associate them with a traditional journal.</p>
  <img src="/assets/images/journal-mapper/location.png" alt="Annotation detail">
</div>

<hr class="jm-rule">

<section class="jm-section">
  <h2 class="page-heading">iCloud Sync ☁️</h2>
  <p class="role-post-body jm-section-body">Experience a consistent interface across all your devices, with iCloud sync ensuring you stay up to date on every device signed in with your Apple ID.</p>
  <img src="/assets/images/journal-mapper/multiple-devices.png" alt="Multiple devices showing the app">
</section>

<hr class="jm-rule">

<section class="jm-section">
  <h3 class="page-heading">Available on the App Store</h3>
  <a href="https://apps.apple.com/us/app/journal-mapper/id1533073089" class="jm-cta" aria-label="Download Journal Mapper on the App Store">
    <img src="/assets/images/journal-mapper/app-store-badge.png" alt="Download on the App Store">
  </a>
</section>

<p class="role-post-body jm-privacy"><a href="/journal-mapper/privacy-policy">🖐🏽 Privacy Policy</a></p>
