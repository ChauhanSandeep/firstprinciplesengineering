# Engineering Audit — First Principles Engineering

**Site:** https://firstprinciplesengineering.tech
**Stack:** Customized Quartz v5 (fork of `@jackyzha0/quartz`) generating a static site from a private Obsidian vault, hosted on GitHub Pages, with a Supabase-backed reader-engagement layer.
**Reviewer:** Staff Software Engineer (engineering-quality / 5-year-maintainability review)
**Date:** 2026-07-25
**Scope:** Architecture, build pipeline, ~5,740 LOC of custom scripts, Supabase engagement/auth, and the current build output (53 source notes → 82 published pages).

> This review evaluates **engineering quality and the workflow behind the site**, not the note content itself.

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Evidence snapshot](#evidence-snapshot)
3. [Detailed findings by area](#detailed-findings-by-area)
   - [1. Scalability](#1-scalability)
   - [2. Maintainability](#2-maintainability)
   - [3. Obsidian workflow](#3-obsidian-workflow)
   - [4. Information architecture](#4-information-architecture)
   - [5. Performance](#5-performance)
   - [6. Security](#6-security)
   - [7. SEO](#7-seo)
   - [8. Developer experience](#8-developer-experience)
   - [9. Operational excellence](#9-operational-excellence)
   - [10. Future-proofing](#10-future-proofing--what-breaks-first)
4. [Deliverables](#deliverables)
   - [Top 10 immediate improvements](#1-top-10-to-implement-immediately)
   - [Improvements that can wait](#2-improvements-that-can-wait)
   - [Roadmap](#3-roadmap)
   - [Engineering scores](#4-engineering-scores-110)
   - [Unknown unknowns](#5-unknown-unknowns--blind-spots)

---

## Executive summary

The site is a thoughtfully built, well-documented, heavily-customized Quartz v5 fork. For its current size it works well. However, three structural decisions **will not survive growth to thousands of notes** and should be addressed before the vault grows much further:

1. **Client-side search ships the full text of every note.** `public/static/contentIndex.json` is already **1.2 MB for 53 notes** (~23 KB/note; the full `content` body is embedded). Every visitor downloads this to use search or hover-popovers.
2. **15 sequential post-build `inject-*` passes** re-walk `public/` and regex-rewrite every HTML file, anchored on fragile markers like `</article>`. Features live in post-build string surgery, not Quartz plugins/components.
3. **The entire build and all validation run locally.** CI (`.github/workflows/deploy.yml`) only republishes the prebuilt `gh-pages` artifact — no CI build, test, lint, or link check ever runs.

Everything else in this report is largely polish on top of these three.

**Overall:** solid craftsmanship at current scale; meaningful architectural debt that is cheap to fix now and expensive later.

---

## Evidence snapshot

| Metric | Value | Source |
|---|---|---|
| Source notes | 53 `.md` in `content/` | `find content -name '*.md'` |
| Published pages | 82 entries / 83 HTML | `contentIndex.json`, `public/**/*.html` |
| **Search index size** | **1.2 MB** (1,156,290 content chars) | `public/static/contentIndex.json` |
| Per-note index cost | ~23 KB/note (full body embedded) | derived |
| Custom script LOC | ~5,740 across `scripts/**` | `wc -l` |
| Post-build inject passes | 15 (`inject-*.mjs`) | `package.json` `build` |
| Custom-script tests | 2 files (`update-home-cards`, `render-report`) | `find *.test.*` |
| CI workflows | 1 (`deploy.yml`, publish-only) | `.github/workflows/` |
| `robots.txt` | **absent** | `public/` listing |
| Largest raster | `brand-knight.png` 222 KB (unoptimized) | `public/static/` |
| Repo visibility | **PUBLIC** | `gh repo view` |
| `content/` gitignored? | **No** (privacy via local hook + allowlist) | `.gitignore`, `pre-commit-guard.sh` |

---

## Detailed findings by area

Each finding lists **Severity**, **Why it matters**, **Impact if ignored**, **Recommendation**, and an **Example** where useful.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

---

### 1. Scalability

#### 🔴 Critical — Search index ships full note bodies to the browser
- **Evidence:** `public/static/contentIndex.json` = 1.2 MB for 53 notes; `content chars: 1,156,290`. Index fields: `slug, filePath, title, links, tags, content` — the entire body is embedded.
- **Why it matters:** Quartz's search and hover-popovers load this whole file client-side and parse it into memory. Growth is linear: ~500 notes → ~11 MB; **5,000 notes → ~110 MB** downloaded on first search/hover.
- **Impact if ignored:** Search becomes unusable on mobile, large `onSearch`/parse jank, memory pressure, and wasted bandwidth on every visit. This is the single biggest scaling cliff and it is **invisible at today's size**.
- **Recommendation:** Move to a **prebuilt, sharded search index** that loads fragments on demand. [Pagefind](https://pagefind.app) is the strongest fit — it shards the index so a query loads only tens of KB regardless of corpus size. Minimum viable alternative: strip `content` from `contentIndex.json` (index title/description/headings only) and/or lazy-load the full index behind the first keystroke.
- **Example:**
  ```bash
  # after `npx quartz build`
  npx pagefind --site public
  # drop <div id="search"></div> + pagefind/pagefind-ui.js into the layout
  ```
  This is the highest-leverage change in the entire audit.

#### 🟠 High — `inject-prev-next-related` recomputes O(N²) related-notes from the full index
- **Evidence:** `scripts/build/inject-prev-next-related.mjs:87-111` (`pickRelated`) iterates all pages for every page, loading the 1.2 MB index in Node.
- **Impact:** At 5,000 notes this is ~25M scoring iterations per build, on top of 15 full-tree HTML rewrites — build time grows super-linearly.
- **Recommendation:** Compute prev/next/related **once** during Quartz's emit phase (a Component or emitter) using `resolvedLinks`, not as a post-build pass over rendered HTML.

#### 🟠 High — Post-build injectors are O(passes × pages) file I/O
- **Evidence:** 15 `inject-*` scripts, each walks `public/` and reads+writes every `.html` (`walkArticles` in `inject-*.mjs`).
- **Impact:** 5,000 pages × 15 passes = 75,000 read/modify/write cycles per build.
- **Recommendation:** Consolidate into Quartz components/transformers so the work happens in the single render pass (see §2).

#### 🟡 Medium — Explorer renders the full folder tree on every page
- **Evidence:** `quartz.config.yaml` explorer plugin; `folderClickBehavior: collapse` and a serialized `mapFn` re-evaluated client-side per node.
- **Impact:** At thousands of nodes, a large DOM + hydration cost on every page.
- **Recommendation:** Virtualize or section-scope the explorer tree (only render the current top-level section expanded).

#### 🟢 Low — Excalidraw handled well
- **Evidence:** SVGs pre-exported with dark/light pairs; hash-based incremental cache (`.excalidraw-cache/`); `optimize-svgs` pass; raw `.excalidraw(.md)` hard-blocked at sync and via `ignorePatterns`.
- **Watch:** total inline-SVG DOM weight per page as diagrams grow.

---

### 2. Maintainability

#### 🟠 High — Feature logic lives in fragile post-build string surgery, not Quartz plugins
- **Evidence:** `scripts/build/inject-prev-next-related.mjs:211` anchors on `ARTICLE_END_RE = /(<\/article>)/i`; injectors silently `return { skipped: "no-article" }` when the anchor is missing. The same pattern repeats across all 15 `inject-*` scripts.
- **Why it matters:** Any Quartz template change (i.e. any upstream upgrade) silently disables features with **no error and no test**. You are fighting the framework instead of using its extension points.
- **Impact if ignored:** Compounding technical debt; upgrades become high-risk; features rot silently.
- **Recommendation:** Port injectors to Quartz Components/emitters where the data already exists (`resolvedLinks`, `allFiles`, frontmatter). Reserve injectors only for things Quartz genuinely cannot express (e.g. third-party `<script>` tags).

#### 🟡 Medium — Homepage "Recommended Reads" are hardcoded slugs
- **Evidence:** `content/index.md:63-125` hardcodes 10 article paths (e.g. `01-fundamentals/02-databases/01-fundamentals/06-mvcc`). A `validate-home-cards` + `update-home-cards` scaffold exists, but the source of truth is hand-maintained HTML.
- **Impact:** Every rename/move silently breaks a card; grows unmaintainable.
- **Recommendation:** Generate cards from frontmatter (`featured: true` + `order`) at build time.

#### 🟡 Medium — Duplicated helpers across scripts
- **Evidence:** `el()` DOM helper and `escapeHtml()` are re-implemented in `content/_static/engagement.js`, `account.js`, `header-auth.js`, `home-personalize.js`, and across `inject-*` scripts.
- **Recommendation:** Extract a shared `scripts/lib/` module and a shared client `_static/dom.js`.

#### 🟡 Medium — Vendored `.quartz/` + upstream fork drift
- **Evidence:** `package.json` still identifies as `@jackyzha0/quartz`; community plugins vendored under `.quartz/`; dependencies fetched from `github:quartz-community/*` (moving targets).
- **Impact:** Pulling upstream security fixes is painful; plugin sources can change under you.
- **Recommendation:** Document the fork point, pin community plugins to commit SHAs, and track upstream deliberately.

---

### 3. Obsidian workflow

Overall a strength. `scripts/sync-from-vault.mjs` is genuinely good: dual publish gate (`publish: true` **and** folder allowlist), auto-tagging by path, title prettification, duplicate-H1 stripping, markmap stripping, and Excalidraw dark/light export.

#### 🟡 Medium — `TAG_MAP` is hardcoded to the current folder taxonomy
- **Evidence:** `scripts/sync-from-vault.mjs:283-298`.
- **Impact:** Any folder reorg silently drops auto-tags.
- **Recommendation:** Drive tags from a small config file or a per-folder `.tags` marker; emit a sync-time **warning** when a published note matches no `TAG_MAP` prefix.

#### 🟡 Medium — Wikilink resolution is heuristic (basename + shortest path)
- **Evidence:** `resolveWikilink` (`sync-from-vault.mjs:148-164`) picks the shortest path on basename collision.
- **Impact:** At thousands of notes, basename collisions rise and links silently resolve to the wrong note.
- **Recommendation:** Enforce unique note IDs, or fail the build on ambiguous links (the script already counts `brokenWikilinks`).

#### Automation opportunities
- Add an Obsidian **Templater** template that stamps `publish`, `description`, `tags`, and `title` on note creation — removes the biggest source of inconsistency.
- Auto-generate `description` from the first paragraph at sync time when missing (feeds SEO/OG).

---

### 4. Information architecture

Good foundations: breadcrumbs, backlinks, roadmaps as curated entry points, and deliberate folder-click = expand-only behavior. Gaps:

#### 🟠 High — Graph view disabled; discovery leans entirely on search + roadmaps
- **Evidence:** `quartz.config.yaml:169` — `graph: enabled: false`.
- **Impact:** For a knowledge base, the local graph is a primary discovery tool; its absence weakens serendipitous navigation.
- **Recommendation:** Re-enable the **local** graph on article pages (not the global graph, which won't scale visually past a few hundred nodes).

#### 🟡 Medium — Thin topic hubs beyond the 3 roadmaps
- **Impact:** At scale you need curated "map of content" (MOC) hub pages per major area, not just auto folder pages.
- **Recommendation:** Introduce a `type: hub` frontmatter that renders a curated landing.

#### 🟢 Low — Related-notes scoring over-weights folder position
- **Evidence:** `inject-prev-next-related.mjs:102-105` — `+2` same parent, `+1` grandparent, `+1` backlink.
- **Recommendation:** As the link graph densifies, weight **backlinks and shared tags** higher than folder location.

---

### 5. Performance

#### 🟠 High — Raster images are not optimized
- **Evidence:** `optimize-svgs` pass exists, but no raster pass. `public/static/brand-knight.png` is **222 KB**; `icon.png` 24 KB. (OG images are already `.webp` — good.)
- **Impact:** Oversized images hurt LCP, especially on mobile.
- **Recommendation:** Add a Sharp-based pass (Sharp is already a dependency) to convert/resize content rasters to AVIF/WebP with responsive `srcset`; compress `brand-knight.png`.

#### 🟡 Medium — Multiple hand-rolled client scripts, no bundling
- **Evidence:** `engagement.js` (20 KB) + `account.js` (15 KB) + `header-auth.js` (8.5 KB) + `home-personalize.js`, each loaded per page and pulling the Supabase client.
- **Recommendation:** Defer/lazy-load engagement JS until the reader scrolls to it; only load the Supabase client on interaction; bundle into hashed files.

#### 🟡 Medium — No `robots.txt` (see §7).

#### 🟢 Positive
- Cookieless Plausible chosen (currently disabled), Google Fonts with `cdnCaching`, SPA + popovers. Good instincts.

---

### 6. Security

#### 🟠 High — Comment moderation is bypassable via the update policy
- **Evidence:** `supabase/schema.sql:160-162`. `comments_update_own` lets an author `update` their own row with `check (auth.uid() = user_id)`, but nothing prevents changing the `hidden` column. A user whose comment you hid from the dashboard can simply update the row and set `hidden = false`.
- **Impact:** Moderation is not durable; abusive content can be re-shown by its author. There is also **no rate-limiting** on inserts → comment flood/spam risk.
- **Recommendation:** Restrict which columns authors may change — a `BEFORE UPDATE` trigger that rejects changes to `hidden` (and `slug`/`user_id`), or move moderation state to a separate table authors can't touch. Add per-user insert throttling.

#### 🟡 Medium — No Content-Security-Policy or security headers
- **Evidence:** GitHub Pages can't set HTTP headers; the site uses inline `<script>`/`<style>` and `innerHTML` icon injection.
- **Recommendation:** Add a `<meta http-equiv="Content-Security-Policy">` (allow self + Supabase + Plausible + fonts) plus `referrer` and `X-Content-Type-Options` metas. Note: inline scripts make a strict CSP hard — another reason to bundle client JS into hashed files.

#### 🟡 Medium — Privacy relies on a manually-installed local git hook
- **Evidence:** `scripts/pre-commit-guard.sh` must be symlinked by hand; the main repo is **public** (`gh repo view` → `isPrivate:false`); `content/` is not gitignored (`.gitignore` comment explains why). If the hook isn't installed on a given machine, private synced notes can be committed to a public repo.
- **Also:** the guard allowlist is `content/(index.md|about.md|_static/**)` but `sync` also preserves `account.md` (`sync-from-vault.mjs:74`) — an inconsistency.
- **Recommendation:** Add a **CI check** on `main` that fails if any disallowed `content/**` path is tracked (defense that doesn't depend on local setup). Fix the `account.md` allowlist mismatch.

#### 🟢 Low / Positive — XSS is handled well
- **Evidence:** Comment bodies and display names render via `textContent` (`engagement.js:516`, `:62`); `innerHTML` is used only for static, trusted icon SVGs (`:64`). The committed Supabase anon key is expected/safe (RLS is the boundary). Raw Excalidraw sources are hard-blocked at sync and via `ignorePatterns`.

#### 🟡 Medium — Supply-chain hygiene
- **Evidence:** Forked Quartz + community plugins from `github:quartz-community/*` (unpinned). Dependabot config exists but scoped to npm production deps. No `npm audit` gate.
- **Recommendation:** Pin community plugins to commit SHAs; add an audit step to CI.

---

### 7. SEO

#### 🟠 High — No `robots.txt`
- **Evidence:** `public/robots.txt` absent; `sitemap.xml` and `index.xml` present.
- **Recommendation:** Emit `robots.txt` pointing at `https://firstprinciplesengineering.tech/sitemap.xml`.

#### 🟡 Medium — Verify canonical + structured data
- **Evidence:** `scripts/build/inject-seo.mjs` (255 LOC) exists.
- **Recommendation:** Confirm it emits `<link rel="canonical">`, `og:*`, `twitter:*`, and `Article`/`BreadcrumbList` JSON-LD per page. Descriptions auto-derive from content, so ensure markmap/HTML junk is stripped (markmap stripping already exists — good).

#### 🟢 Low — URLs carry ordering prefixes
- **Evidence:** Slugs like `01-fundamentals/.../06-mvcc`.
- **Impact:** Stable today, but **renumbering folders breaks every URL + backlink**.
- **Recommendation:** Consider stable slugs decoupled from `NN-` ordering; never renumber existing folders.

---

### 8. Developer experience

#### 🟠 High — No CI build/test/lint; the build is a 17-step shell chain
- **Evidence:** `deploy.yml` only republishes; `package.json` `build` is one giant `&&` chain of 17 steps. A failure midway leaves `public/` half-injected.
- **Impact:** Another engineer can't verify a change without the private vault; failures are hard to localize.
- **Recommendation:** (1) Add a CI job running `tsc --noEmit`, `prettier --check`, `tsx --test`, and a content-free **smoke build** on a fixture vault. (2) Move the build chain into a small Node orchestrator with per-step timing and fail-fast context.

#### 🟡 Medium — Custom scripts are largely untested
- **Evidence:** Only 2 custom test files cover ~5,740 LOC; the fragile injectors (riskiest code) have none.
- **Recommendation:** Add golden-file tests for each `inject-*` against a small HTML fixture, asserting the injection point still matches — this directly guards the `</article>`-anchor fragility.

#### 🟢 Positive
- Excellent inline documentation, `PUBLISHING.md`, `ENGAGEMENT.md`, `docs/website-improvements/` phase docs, `.node-version`, prettier config, issue/PR templates, CODEOWNERS.

---

### 9. Operational excellence

#### 🟠 High — No automated broken-link / accessibility / regression detection
- **Evidence:** `validate-wikilinks`, `validate-excalidraw`, `playwright-smoke`, `seo-audit` exist but are **local, opt-in**; nothing runs them on a schedule or as a gate.
- **Recommendation:** A nightly GitHub Action against the live site: broken-link crawl (lychee), Lighthouse CI budget, `pa11y`/axe accessibility, and a **`contentIndex.json` size budget** (fail if > N MB — early warning for the §1 bottleneck).

#### 🟡 Medium — No backup strategy for Supabase engagement data
- **Evidence:** Comments/likes/reads live only in Supabase free tier, which also **pauses on inactivity**.
- **Recommendation:** Scheduled `pg_dump`/export; monitor project liveness.

#### 🟡 Medium — No error monitoring/analytics live
- **Evidence:** Plausible is `enabled: false`; no client error reporting.
- **Recommendation:** Enable Plausible and add a lightweight `window.onerror` beacon so widget/auth failures are visible.

---

### 10. Future-proofing — what breaks first

At 5,000 notes / 10,000 images / thousands of visitors, in order:

1. **Search (`contentIndex.json` ~110 MB)** — breaks first, hard. → Pagefind now.
2. **Build time** — 15 full-tree HTML rewrites + O(N²) related-notes + local-only build on one laptop. → Quartz-native components + CI build.
3. **Explorer DOM** — full tree per page. → lazy/section-scoped.
4. **Deploy artifact / gh-pages repo size** — thousands of HTML + OG webp images approach Pages' soft limits/bandwidth. → consider a CDN host (Cloudflare/Netlify Pages) with build caching.
5. **Supabase free tier** — pausing, row limits, no backups.
6. **Wikilink basename collisions** — silent mis-resolution.

**Make now (cheap now, expensive later):** Pagefind search; port injectors to components; CI privacy + size-budget checks; stable slugs; image optimization pass.

---

## Deliverables

### 1. Top 10 to implement immediately
1. **Replace client search with Pagefind** (or strip `content` from the index) — kills the 110 MB scaling cliff. 🔴
2. **Add `robots.txt`** + verify canonical/JSON-LD in `inject-seo`. 🟠
3. **Fix comment moderation bypass** (trigger blocking `hidden` change) + add comment rate-limit. 🟠
4. **CI privacy guard** on `main` (fail if disallowed `content/**` is tracked) — don't rely on a local hook. 🟠
5. **CI build/test gate**: `tsc`, prettier, `tsx --test`, fixture-vault smoke build. 🟠
6. **Raster image optimization pass** (Sharp → AVIF/WebP + `srcset`); shrink `brand-knight.png`. 🟠
7. **Golden-file tests for each `inject-*`** guarding the `</article>` anchor. 🟡
8. **`contentIndex` size budget** check in CI (early-warning alarm). 🟡
9. **Add CSP + security-header `<meta>`s**; enable Plausible + basic error beacon. 🟡
10. **Generate homepage cards from frontmatter** instead of hardcoded slugs. 🟡

### 2. Improvements that can wait
- Porting all injectors to Quartz components (do search + related first).
- Re-enabling the local graph view.
- Curated MOC/hub landing pages per topic.
- Migrating host from GitHub Pages to Cloudflare/Netlify for CDN + build caching.
- Virtualized explorer.
- Stable slugs decoupled from `NN-` ordering.
- Supabase backup automation + paid tier.

### 3. Roadmap

**Quick Wins (1–2 hours each)**
- `robots.txt`; compress `brand-knight.png`; fix `account.md` allowlist mismatch; enable Plausible; `contentIndex` size-budget script; pin community plugins to SHAs.

**Short-term (1–2 days)**
- Pagefind integration; CI privacy + build/test workflow; comment moderation trigger + rate limit; image optimization pass; golden-file injector tests; CSP metas.

**Medium-term (1–2 weeks)**
- Port related-notes + prev/next + SEO injectors to Quartz emitters/components; frontmatter-driven homepage; nightly link/Lighthouse/a11y checks; Supabase backups; error monitoring.

**Long-term (months)**
- Full injector → component migration; host migration to CDN with incremental builds; local-graph + MOC IA; stable-slug scheme; unique-note-ID enforcement for links.

### 4. Engineering scores (1–10)

| Dimension | Score | Rationale |
|---|---|---|
| Maintainability | **5** | Great docs, but 15 fragile post-build string injectors fight the framework. |
| Scalability | **3** | Full-text search index + O(N²)/O(passes×pages) build won't survive 1,000+ notes. |
| Security | **6** | XSS handled well; RLS solid — but moderation bypass, no CSP, hook-only privacy. |
| Performance | **6** | Good font/analytics choices; unoptimized rasters + heavy per-page JS + huge search index. |
| Developer Experience | **5** | Excellent docs; no CI gate, giant shell-chain build, needs the private vault to verify. |
| Information Architecture | **7** | Roadmaps, breadcrumbs, backlinks strong; graph off, thin topic hubs, folder-heavy relatedness. |
| Operational Readiness | **4** | Rich validation scripts exist but nothing runs automatically; no monitoring/backup. |

### 5. Unknown unknowns / blind spots
- **The search cliff is invisible today** — 1.2 MB feels fine at 53 notes; nobody notices until ~500+ notes when mobile search dies. Add the size budget now so it alarms early.
- **Silent injector failure** — an upstream Quartz template change flips `</article>` markup and features vanish with a "skipped" log, not an error. No test catches it.
- **Local-only build = bus factor 1** — the site can only be rebuilt on a machine that has the private vault + hook + Node 22 + the exact toolchain. Lose the laptop → lose the ability to deploy. Document a reproducible-build runbook and keep an encrypted vault backup.
- **URL fragility** — slugs encode `NN-` folder ordering; any renumber breaks every URL, backlink, and the hardcoded homepage cards simultaneously.
- **Supabase free-tier pausing** — the engagement widget can silently 500 for all readers if the project pauses; there is no monitoring to notice.
- **Wikilink shortest-path resolution** degrades statistically as the corpus grows — links start pointing at the wrong note with no error.
- **gh-pages branch bloat** — thousands of HTML + per-note OG webp accumulate in git history on `gh-pages`; the `--remove "**/*"` deploy helps the tree but not history size.

---

*End of audit.*
