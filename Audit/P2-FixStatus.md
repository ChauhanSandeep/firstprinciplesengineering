# P2 Fix Status

Status of the P2 tier (items 19–30) from `Audit/RemediationPlan.md`.
Validated locally via full `npm run build` + Playwright (CSP violations,
graph render, search, engagement) on http://127.0.0.1:8099. Nothing is
committed or deployed to production yet.

Legend: ✅ done · 🟡 already-covered / N-A · ⏸️ deferred (needs decision or is risky)

---

## ✅ Fixed

### 25 — CSP + security meta (`inject-security.mjs`, NEW)
- New post-build injector adds a `Content-Security-Policy` (http-equiv) and
  `referrer` meta to every page (`data-fpe-security` marker, idempotent).
- Policy scoped to the exact origins the site loads: `self`, `esm.sh`
  (supabase-js), `*.supabase.co` + `wss://*.supabase.co` (engagement REST +
  realtime), `cdnjs.cloudflare.com` (mermaid), `cdn.jsdelivr.net` (KaTeX
  css/fonts + copy-tex), `fonts.googleapis.com`/`fonts.gstatic.com`,
  `plausible.io`; `img-src https:` for avatars/og.
- `'unsafe-inline'` + `'unsafe-eval'` are required in `script-src` (Quartz
  emits many inline scripts; the explorer + bases-page re-run serialized
  functions via `new Function`). Header-only controls (X-Content-Type-Options,
  X-Frame-Options, frame-ancestors) are intentionally **not** emitted — they
  are ignored as `<meta>` and GitHub Pages can't set response headers.
- Escape hatch: `FPE_CSP=off` skips injection.
- Wired into `build` / `build:soft` after `inject-seo`.
- **Validated:** 0 CSP violations on home + article across search, mermaid,
  engagement widget, KaTeX. (Two gaps — jsdelivr fonts and `new Function` —
  were caught by the browser test and fixed.)

### 22 — Golden-file injector tests (`inject-golden.test.mjs`, NEW)
- 8 tests exercising `inject-security`, `inject-seo`, `inject-folder-pages`
  end-to-end against fixture HTML via a new `FPE_PUBLIC_DIR` test hook.
- Assert output anchors (canonical/JSON-LD injection, folder-title
  humanization + item-count footer, CSP directives incl. the required
  `'unsafe-eval'` + jsdelivr font origin) and idempotency.
- Suite: **123/123 pass** (was 115). `tsc --noEmit` clean.

### 26 — Local connections graph (`quartz.config.yaml`, `custom.scss`)
- Enabled the `graph` plugin (`localGraph` depth 2, `showTags: false`) at
  `afterBody` / `not-index` so it renders below the article body on article
  pages only (not on the home/folder listings, and — after user feedback —
  not buried under the long right-sidebar TOC).
- Added a compact, bordered 300px CSS frame for the graph widget.
- **Validated:** graph renders a connected node cloud; hidden on the homepage.

### 30 (partial) — Analytics error beacon (`inject-analytics.mjs`)
- Added a JS error beacon: uncaught errors + unhandled promise rejections are
  reported as Plausible custom events (truncated message + pathname only, no
  PII). No-ops until Plausible is enabled.
- Plausible tag injection was already built (`analytics.config.mjs`,
  `enabled: false`) — awaiting a Plausible account (user action).

### Extra (from user feedback this pass)
- **Backlinks section removed** from article footers (`backlinks` plugin
  `enabled: false`).
- **Engagement / sign-in card compacted** (smaller padding, lede, buttons,
  inputs) so it no longer dominates the page.
- **Comments area restyled to the HelloInterview pattern:** a `Comments (N)`
  header with a speech-bubble icon + live count, and a centered pill
  "Sign in to join the discussion" nudge with a friendly one-line subtext
  (replacing the plain left-aligned "Sign in above…" text).

---

## 🟡 Already covered / Not applicable

- **20 — Folder-card titles:** `inject-folder-pages.mjs` already strips `NN-`
  prefixes (H1, breadcrumbs, card titles) and adds a "📁 N items" footer to
  bare folder cards — the "empty boxes" complaint is resolved. Per-card
  one-line *descriptions* are best authored via a folder `index.md`
  (frontmatter `description:`), which the pipeline already preserves.
- **28 — Tables/details:** wide-table horizontal-scroll affordance already
  exists (site.js wrapper + `overflow-x`). `<details>` collapse and
  article-splitting are content-side and out of scope.
- **29 — SEO verification:** canonical, full `og:*`, `twitter:*`, and both
  `Article` + `BreadcrumbList` JSON-LD are already emitted on every article
  (`inject-seo.mjs`). No `twitter:creator` added (no verified handle).
- **24 — AVIF/WebP images:** N-A. The only rasters are icons / favicons /
  og-image / brand-knight, which must stay PNG (favicon + social-card
  compatibility). All diagrams are SVG and already optimized. No content
  photos to convert.

---

## ⏸️ Deferred (need a decision)

- **19 — TL;DR + Prerequisites callouts:** worth doing, but needs a chosen
  frontmatter convention (e.g. `tldr:` / `prerequisites:`) **and** authored
  content per note. Proposal: add sync-side support that renders a callout at
  the top of an article when those keys are present. Awaiting go-ahead.
- **21 — Flatten Concepts nesting:** **risky.** Changes URLs/slugs, which
  breaks inbound links, saved bookmarks, and SEO. Needs an explicit decision
  (+ redirect strategy) before touching.
- **23 — Frontmatter-driven home cards:** the current home grid is a working
  plan-driven system (`update-home-cards.mjs` + markers in `index.md`).
  Converting to `featured: true` + `order` frontmatter is a workflow refactor
  — defer unless you want to change how you curate the homepage.
- **27 — Injector → Quartz emitter port:** large/risky refactor of ~18
  post-build injectors into Quartz plugins. Low user-visible payoff; defer.

---

## Validation summary

- `npm run build` → exit 0; 0 broken internal links; search index 409 KB / 13%
  of budget.
- `npm test` → 123/123 pass. `tsc --noEmit` → clean.
- Playwright (home + article, light/dark): 0 CSP violations, 0 page errors,
  graph renders, search returns hits, engagement widget mounts.
