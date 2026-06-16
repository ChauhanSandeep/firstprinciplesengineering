# Website improvements

This directory documents the staged evolution of the First Principles
Engineering Quartz site from a polished notes folder into a
professional learning platform. Each phase was shipped as its own
stacked PR so reviewers could approve in order without waiting for
the full chain to land.

## Why a phased plan

The site had strong bones already — Anthropic-inspired palette,
Excalidraw dark/light pairs, search, RSS, breadcrumbs, custom 404.
What was missing was the product polish: per-article navigation,
analytics, roadmaps, topic-named explorer, diagram zoom,
new/updated badges, performance audit. Each phase tackled one slice
without redesigning what already worked.

## Phase index

| Phase | PR  | What changed                                                          | Why                                                                        |
| ----- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 01    | #5  | Removed / superseded                                                   | Homepage now uses Roadmaps + Recommended Reads only                        |
| 02    | #6  | Removed / superseded                                                   | Topic tabs added clutter and duplicated search/explorer/roadmaps           |
| 03    | #7  | Prev/Next + Related at article footer + content-meta polish            | Closes the "what's next" loop on every page                                |
| 04    | #8  | Giscus comments scaffold (dormant)                                    | Community-ready without breaking the build                                 |
| 05    | #9  | Plausible analytics scaffold (dormant)                                | Privacy-friendly metric collection on a future toggle                      |
| 06    | #10 | Canonical + Article/BreadcrumbList JSON-LD + `seo:audit`               | Discoverability + structured search results                                |
| 07    | #11 | 4 roadmap landing pages + Roadmaps top-level topic                     | Major entry points beyond raw note listing                                 |
| 08    | #12 | Auto-tagging at sync + 16 tag pages + search hint + crosslink suggester | Make exploration effortless                                                |
| 09    | #13 | Removed / superseded                                                    | Series pages were later removed so Roadmaps remain the only learning-path surface |
| 10    | #14 | Lightbox toolbar (open-in-new-tab), theme-aware backdrop, lazy diagrams | Diagram experience is the site's main differentiator                       |
| 11    | #15 | Status badges from vault git + fuzzy 404 suggestions                   | "New / Updated" signals + a useful 404                                     |
| 14    | #16 | SVGO post-build optimization (–5.5 MB across 302 files)                | Pure win on bandwidth + LCP                                                |
| 15    | #17 | This index + conventions doc                                          | Future maintainers can ramp without spelunking PR history                  |

Phase 12 and 13 were intentionally skipped in the original spec.

## How the build chain composes

```
npm run sync                              # vault → content/
  ↓
npm run validate:home                      # home cards point at real notes
  ↓
npx quartz build                          # content/ → public/
  ↓
npm run fix-paths                          # excalidraw URL rewrites + dark/light pair
  ↓
npm run inject-prev-next-related           # Phase 3
npm run inject-comments                    # Phase 4 (skips when disabled)
npm run inject-analytics                   # Phase 5 (skips when disabled)
npm run inject-seo                         # Phase 6
npm run inject-search-hint                 # Phase 8
npm run inject-status-badges               # Phase 11
npm run inject-404-suggestions             # Phase 11
npm run optimize-svgs                      # Phase 14
```

Every injector is idempotent (marker-class or marker-id check) and
fails closed (logs + exits 1) on unexpected input. The chain can be
re-run end-to-end with no harm.

Read [`conventions.md`](./conventions.md) for the catalog of
frontmatter keys, new components, and stacked-PR mechanics.
