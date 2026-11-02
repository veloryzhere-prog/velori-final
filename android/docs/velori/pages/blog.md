# Blog

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current implementation

The current CMS page is `/blog`, with HTML, CSS and JavaScript preserved in Page Studio and exported in `docs/cms-pages/velori-pages.json`. Its currently authored content follows.

A better home for conversations
The inbox now fills the available display, with a stable composer and independent scrolling. Conversation details keep media, reels, files, participants and personal settings together.

The people you both follow
A familiar connection can be a good place to start. Shared following appears on eligible profiles and direct-chat details while respecting private profiles, list visibility and blocking.

A little more life, with a little more choice
The parchment announcement opens like a vintage letter. Branded loading loops and interface transitions share the same Full, Gentle and Off controls. Movement stays optional.

Your information, easier to find
The rebuilt VELORI directory brings help, product documentation, careers, privacy guidance and our roadmap into one consistent reading experience. Every page is managed through the CMS.

Building what comes next
Our roadmap separates available improvements from planned work. VELORYZ AI remains under construction. Check the roadmap for direction without treating planned features as available today.

The current journal is a real CMS-edited page with product-story sections. Separate article records, categories, scheduling, feedback and search require the proposed article metadata tables and integrations; the page is not represented as a completed multi-author publication system.

## Expanded authored requirements and content

## 3.3 VELORI Journal — `/blog`

**Hero:** Ideas, Updates & Stories From VELORI.

### Introductory content

"The VELORI Journal brings together product announcements, development updates, creator guides, design stories and insights into how the platform is evolving.

Explore what is changing, understand how features work and learn more about the decisions behind the VELORI experience."

### Blog categories

- Product Announcements
- Development Updates
- Creator Guides
- Platform Safety
- Engineering
- Design Stories
- Community
- Tutorials
- Behind the Scenes

### Required functionality

Build a real database-driven publishing system.

Each article must support title, summary, slug, author, publication date, modified date, hero image, body blocks, category, tags, SEO description, status, scheduled publication and related articles.

Add full-text search, category filters, pagination, reading progress, article sharing, article feedback and SEO metadata.

Create article draft, preview, publish, unpublish, archive and revision workflows for authorized CMS editors.

Do not invent published historical announcements. Seed only verified articles or clearly labeled example content in development environments.

### UI

Magazine-style typography, staggered editorial article cards, subtle image reveals, animated category navigation and a clean full-width reading experience.

---
