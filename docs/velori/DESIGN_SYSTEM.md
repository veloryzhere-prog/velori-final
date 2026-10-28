# VELORI documentation design system

# 1. GLOBAL DESIGN SYSTEM

## Visual identity

Build a premium, editorial, modern social-media design system.

**Primary appearance:**
- Background: warm off-white `#FAF9F6`
- Surface: pure white `#FFFFFF`
- Primary typography: near-black `#171717`
- Secondary typography: `#666666`
- Primary accent: restrained warm gold `#E7B94C`
- Borders: subtle neutral `#E7E5E1`
- Error: accessible dark red
- Success: accessible dark green

Avoid excessive colorful glassmorphism, oversized shadows, generic gradients and unrelated decorative elements.

Use clean spacing, clear typography, excellent contrast, carefully designed icons and smooth interaction.

## Shared page shell

Every information page must have:

- Consistent VELORI header.
- Contextual breadcrumbs.
- Individual page hero.
- Substantial relevant original content.
- Appropriate animated illustrations.
- Sticky document navigation where relevant.
- Responsive content layout.
- Related articles or relevant links.
- Version or last-updated information where meaningful.
- Functional footer.
- Loading, empty and error states.
- Accessible keyboard navigation.

Do not use identical hero layouts on all pages.

## Animated document engine

Create reusable components:

- `DocumentShell`
- `DocumentCover`
- `DocumentReveal`
- `ReadingProgress`
- `DocumentSidebar`
- `TableOfContents`
- `DocumentationAccordion`
- `ArticleCard`
- `VersionHistory`
- `RelatedResources`
- `CalloutPanel`
- `CopyCodeButton`
- `AnimatedDiagram`
- `DocumentSearch`
- `FeedbackWidget`

### Document-opening animation

When a user clicks a document card:

1. The selected card expands or transitions into the document viewer.
2. A document cover unfolds or reveals the page.
3. The title and metadata appear with restrained motion.
4. The table of contents enters progressively.
5. The document content becomes readable immediately.
6. The browser URL changes to the actual destination.
7. Browser history, deep links and accessibility remain functional.

Use a shared-element-style transition when technically appropriate, with a graceful fallback.

Recommended animation timings:
- Hover: 120–180 ms.
- Panel reveal: 200–350 ms.
- Document transition: 350–550 ms.
- Page transition: 200–350 ms.
- Loop animations: 4–12 seconds, slow and non-distracting.

Respect `prefers-reduced-motion`.

Never delay navigation merely for animation.

---

## Implemented source

The current exported document stylesheet is docs/cms-pages/document.css (under 30,000 characters). src/features/information/document-source.mjs builds the editable body HTML/CSS/JavaScript; catalog.ts contains the current authored content. The visual base uses off-white, near-black typography, crisp borders and warm-gold accents. The existing app shell and authentication remain intact. The larger reusable-component list above is a target inventory; not every named component exists yet.
