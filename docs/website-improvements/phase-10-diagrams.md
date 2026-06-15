# Phase 10 — Diagram experience

## What changed

Excalidraw diagrams are the site's main differentiator. The existing
`openLightbox()` in `quartz/static/site.js` already gave us a
click-to-open viewer with 2x click-zoom and SPA-safe rehydration.
Phase 10 polishes the experience without rewriting the pipeline.

### 1. Lightbox toolbar (open-in-new-tab + close)

The lightbox now renders a small toolbar in the top-right corner with
two icon buttons:

- **↗ Open in new tab** — anchors directly to the SVG file so readers
  can save, share, or open the diagram in their own image viewer at
  full resolution.
- **× Close** — same as before.

Click handlers updated so toolbar actions don't accidentally trigger
the overlay's outside-click-dismiss logic.

### 2. Theme-aware backdrop

The overlay reads `<html saved-theme>` and stamps it onto the
overlay as `data-theme`. In light mode the backdrop is
`rgba(245,245,245,0.95)` instead of `rgba(0,0,0,0.82)` — the dark
scrim was washing out the colours on light-mode diagrams.

Implementation: one new CSS rule `#fpe-lightbox[data-theme="light"]`.

### 3. Native pinch-zoom on mobile

Added `touch-action: pinch-zoom` to the lightbox `<img>`. The browser
handles two-finger pinch without also panning the underlying page;
desktop click-to-2x is unchanged because pointer events are unaffected.

### 4. Lazy-loading off-screen diagrams

`hydrateExcalidrawZoom()` now sets `loading="lazy"` and
`decoding="async"` on every diagram **except the first two** (which
are above the fold on most articles and should ship with the initial
HTML). Diagrams below the fold defer until the reader scrolls — a
real win on long articles that embed 5+ Excalidraw maps.

## Why not bundle medium-zoom

The plan originally called for [medium-zoom](https://github.com/francoischalifour/medium-zoom)
(~1.5 KB gz). On closer look, our existing `site.js` lightbox is ~3
KB of plain JS, already SPA-aware, already integrated with Quartz's
`nav` event, and supports a click-to-scroll-pan zoom mode that medium-zoom
doesn't (it only does fit/2x toggle). Adding a dependency for
overlapping functionality would be net negative — the bundled JS
would have to compose with our own anyway. We kept the in-tree
solution and just rounded out the missing affordances.

## Trade-offs

- The 2x click-zoom mode uses fixed-pixel sizing in JS. On very large
  diagrams the 2x size may exceed the viewport in both dimensions —
  acceptable because the overlay becomes scrollable in `.zoomed`
  mode. A future enhancement could clamp to `min(2x, intrinsic
  width)` so 2x doesn't enlarge a small diagram unnecessarily.
- Mobile users on iOS Safari may still see double-tap-zoom kick in
  before our click handler fires. The `touch-action: pinch-zoom`
  setting on the image addresses pinch but not double-tap. If users
  report this as confusing we can add `touch-action: manipulation`
  to defeat double-tap-zoom; today the default behaviour matches
  reader expectations from other docs sites.
- Lazy-loading the first two diagrams as `eager` is a heuristic.
  Articles where the first diagram is below the fold would benefit
  from a real IntersectionObserver-based approach, but the
  diminishing returns aren't worth the extra code today.

## Future enhancements

- Save the user's current zoom state across SPA navigations so they
  return to the same view after toggling theme.
- Add a small "?" affordance hinting at "click again to zoom" the
  first time a user opens a diagram in a session.
- Run `svgo` on Excalidraw SVGs at sync time (deferred to Phase 14
  performance work; will revisit there).
