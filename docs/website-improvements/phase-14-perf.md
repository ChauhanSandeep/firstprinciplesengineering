# Phase 14 — Performance

## Baseline (before this phase)

| Metric                  | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Excalidraw SVG payload  | **17.7 MB** across 302 files (151 dark/light pairs)                            |
| Largest single SVG      | ~704 KB (`02-testing-strategies-2.excalidraw.{dark,light}.svg`)                 |
| Site JS bundle          | `site.js` 24 KB raw / ~6 KB gz (added Phase 10 lazy-loading on tier-2+ images) |
| Quartz core bundles     | `prescript.js` 4 KB, `postscript.js` 4 KB, helper resource scripts ≤ 8 KB each |
| Stylesheets             | 22 component-CSS files emitted; main `index-*.css` ~80 KB                       |
| Total `public/` size    | ~26 MB on disk                                                                  |

## What changed in Phase 14

### 1. SVG optimization (`optimize-svgs`)

New post-build step `scripts/build/optimize-svgs.mjs` that walks
`public/` for `*.excalidraw*.svg` and runs SVGO with a conservative
preset (keeps `viewBox`, IDs, individual paths). Ran against the
current corpus:

```
optimize-svgs: processed 302 file(s); optimized 302, unchanged 0,
errored 0. Saved 3505.3 KB (23.2%).
```

**Total Excalidraw SVG payload: 17.7 MB → 12.2 MB** (–5.5 MB).
The savings come from removing prettifying whitespace, redundant
attributes, and metadata comments. The embedded Virgil font is
preserved — it's the bulk of every file and is not safe to strip.

### 2. Lazy diagrams + async decode (carried from Phase 10)

`hydrateExcalidrawZoom()` already attaches `loading="lazy"` /
`decoding="async"` to every Excalidraw image except the first two
(above-the-fold heuristic). Documented here for completeness because
it is the single largest LCP win we ship.

### 3. SVGO added as a `devDependency`

Pinned via `npm install -D svgo`. Build-only, not shipped to the
browser. Bumped `devDependencies` only.

## Trade-offs

- **No aggressive SVGO mode.** The default preset already gives
  23% across the corpus. The aggressive plugins (`mergePaths`,
  `removeUselessDefs` on font-embedded SVGs) can break Excalidraw
  rendering subtly — fonts disappear, strokes shift one pixel.
  Conservative wins are real money here without risk.
- **We do not preconcatenate the 22 component CSS files.** That's a
  Quartz core change with cross-cutting impact; the runtime cost
  of multiple `<link>` tags is small on HTTP/2 (which GitHub Pages
  serves), so deferring this until a real Lighthouse signal demands
  it.
- **No Lighthouse CI yet.** The user runs Lighthouse locally /
  through PageSpeed Insights. We document the baseline here; once
  Plausible (Phase 5, dormant) is live we can correlate real-user
  perf against synthetic scores.

## Reproducing the audit

```bash
# Excalidraw SVG payload (before/after this phase, from a fresh build):
find public -name "*.excalidraw*.svg" | xargs du -k | awk '{s+=$1} END {print s/1024 " MB"}'

# Run the optimizer alone:
npm run optimize-svgs

# Per-file savings:
npm run optimize-svgs 2>&1 | tail -1
```

## Future enhancements

- Inline-svg the social icons (footer + sidebar). Currently
  rendered inline already; if we ever extract them to file, the
  optimizer should sweep `public/static/*.svg` too — the glob is
  one regex tweak away.
- Concat the 22 component CSS files into a single payload at build
  time. Worth it only if real-user metrics show CSS as the long
  pole.
- Add a Lighthouse CI step (`@lhci/cli`) once Plausible is live so
  we have a 30-day baseline to compare against.
