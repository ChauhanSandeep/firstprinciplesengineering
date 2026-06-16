# Phase 3 — Article experience: prev/next + related

> Branch: `phase-03-article` · base: `phase-02-navigation`

## Goal

Make every article feel connected without introducing a separate public
playlist surface. The current footer gives readers two lightweight exits:

1. **Previous / Next** within the same folder.
2. **Related articles** scored by folder proximity and outgoing-link signal.

## What ships today

### `scripts/build/inject-prev-next-related.mjs`

Post-build step after Quartz emits HTML. For every article HTML under `public/`,
it skips home, about, 404, folder landing pages, and tag pages.

**Sibling prev/next** uses the same parent folder and sorts with
`localeCompare(en, { numeric: true })`, so `NN-` prefixes drive order where
present.

**Related list** scores every other article in `contentIndex.json`:

| Signal | Score |
| --- | --- |
| Same parent folder | +2 |
| Same grandparent folder | +1 |
| Target appears in this page's outgoing links (`links[]`) | +1 |

The injector excludes self plus sibling prev/next, then keeps the top five.

### Styling

`quartz/styles/custom.scss` contains:

- `.fpe-prev-next-related` — wrapper inserted after `</article>`.
- `.fpe-sibling-row` — two-column prev/next grid, one column on mobile.
- `.fpe-pn-card` — previous/next cards.
- `.fpe-related` — simple related-link list.

## Current product decision

Public Reading Series pages were removed after homepage simplification. The
site now uses **Roadmaps** as the only learning-path surface; article footers
stay lightweight and local.
