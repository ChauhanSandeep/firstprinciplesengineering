# Remediation Plan — First Principles Engineering

**Source:** consolidates `Audit/UxAudit.md` + `Audit/EngineeringAudit.md` (both dated 2026-07-25).
**Goal:** turn the two audits into one prioritized, deduplicated, actionable backlog.
**Prioritization key:** `Severity` (🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low) × `Effort` (S ≤2h · M ≤2d · L >2d) × `Impact`.

---

## ⚠️ Read first — reconcile the audit build before acting

Several **Critical** UX findings appear to already have working implementations wired into the full build chain, and were most likely measured against a **partial local preview**, not the real deploy build:

| UX finding | Audit says | Reality in repo |
|---|---|---|
| §5.1 Diagrams all `.light.svg`, 0 dark | "CRITICAL, 169 embeds hardcode light" | `scripts/fix-excalidraw-paths.mjs` (`npm run fix-paths`) emits a **light+dark `<img>` pair**; `custom.scss:622` swaps them by `saved-theme`. In `package.json build`. |
| §2.1 No prev/next pager | "pagerFound: false" | `scripts/build/inject-prev-next-related.mjs` (phase 03) injects a footer pager. In `package.json build`. |

**Root cause:** this session iterated via a "fast path" that only re-ran 3 injectors (`header-auth`, `account`, `engagement`) and **skipped `fix-paths` and `inject-prev-next-related`**, so the preview at `:8099` was missing them. The audit ran against that preview.

**➡️ Task 0 (do this first, ~15 min):** run a full `npm run build`, then re-verify §5.1 and §2.1 on the fresh `public/`. If both render correctly, **downgrade them out of P0** and treat as a pipeline/regression-guard issue (they silently vanished once — add a smoke check so they can't again). If they're genuinely broken in a full build, keep them in P0.

Everything below assumes Task 0 is done and the two items are re-triaged accordingly.

---

## Priority tiers at a glance

- **P0 — Quick wins (this session / hours):** small, high-ROI, unblock trust & a11y.
- **P1 — High-impact (this week):** the real ship-blockers + top scaling cliff.
- **P2 — Structural (this month):** learning-flow, IA, and framework-debt paydown.
- **P3 — Long-term (months):** platform/host/content-depth investments.

---

## P0 — Quick wins (hours, high ROI)

| # | Item | Src | Sev/Eff | Where |
|---|---|---|---|---|
| 0 | **Full rebuild + re-triage dark-diagrams & prev/next** (see above) | UX 5.1/2.1 | 🔴/S | `npm run build` |
| 1 | **Fix 6 mis-resolved internal links** (BFF, api-protocols-compared) — target pages exist; pure `../` over-climb resolution bug | UX 7.1 | 🔴/S | wikilink resolver / `sync-from-vault.mjs:148` |
| 2 | **Add `<main>` landmark** to page template (skip-to-content, WCAG 1.3.1) | UX 9.1 | 🟠/S | Quartz body layout component |
| 3 | **Fix `aria-controls="toc-2"`** → real TOC panel id | UX 9.2 | 🟡/S | TOC component |
| 4 | **Raise low-contrast tokens ≥4.5:1** (`.roadmap-status` 4.06, `⌘K` kbd 4.27) | UX 9.3 | 🟡/S | `variables.scss`/`custom.scss` |
| 5 | **Enlarge Explorer folder tap targets ≥32px** (currently 21.7px, WCAG 2.5.8) | UX 2.3/9.4 | 🟡/S | explorer CSS |
| 6 | **Fix `content-visibility` diagram collapse** — set `contain-intrinsic-size` per aspect ratio (kills CLS/jank) | UX 5.2 | 🟡/S | `custom.scss` `article img` |
| 7 | **Align search button accessible name** with visible text | UX 9.4 | 🟢/S | search component |
| 8 | **Emit `robots.txt`** → `sitemap.xml` (absent today) | Eng 7 | 🟠/S | build emit |
| 9 | **Compress `brand-knight.png`** (222 KB → optimized) | Eng 5 | 🟡/S | `public/static/` |
| 10 | **Fix `account.md` allowlist mismatch** in privacy guard | Eng 6 | 🟡/S | `scripts/pre-commit-guard.sh` |
| 11 | **`contentIndex.json` size-budget script** (fail > N MB — early alarm for the search cliff) | Eng 1/9 | 🟡/S | new `scripts/` check |

---

## P1 — High-impact (this week)

| # | Item | Src | Sev/Eff | Notes |
|---|---|---|---|---|
| 12 | **Neutralize ~73 dead cross-links to unpublished notes** — render unresolved wikilinks as non-clickable "coming soon" text (or strip at publish) + **broken-internal-link publish gate**. *The #1 issue across both audits — 29% of internal links 404.* | UX 7.1 | 🔴/M | `sync-from-vault.mjs` already counts `brokenWikilinks`; turn count into an action + gate |
| 13 | **Kill the search-index scaling cliff** — `contentIndex.json` is 1.2 MB @53 notes (full bodies embedded); ~110 MB @5k notes. Move to **Pagefind** (sharded) or, minimum, strip `content` from the index. *Highest-leverage engineering fix.* | Eng 1/10 | 🔴/M | `npx pagefind --site public` post-build |
| 14 | **Fix comment moderation bypass** — author `UPDATE` policy lets them flip `hidden=false`. Add `BEFORE UPDATE` trigger blocking `hidden`/`user_id`/`slug` changes **+ per-user insert rate-limit**. | Eng 6 | 🟠/M | `supabase/schema.sql:160` |
| 15 | **Verify/repair prev/next pager** (from Task 0). If broken in full build, fix `inject-prev-next-related`; add smoke assertion. | UX 2.1 | 🟠/M | pipeline |
| 16 | **Add `description:` frontmatter to 41 missing articles** (only 5/46 have it; snippets currently show the anecdote). Auto-derive first paragraph at sync when absent as a fallback. | UX 13.1 / Eng 3 | 🟠/M | vault + `sync-from-vault.mjs` |
| 17 | **CI privacy guard on `main`** — fail if any disallowed `content/**` path is tracked (don't depend on a local hook; repo is public). | Eng 6/8 | 🟠/M | new GH Action |
| 18 | **CI build/test gate** — `tsc --noEmit`, `prettier --check`, `tsx --test`, fixture-vault smoke build. | Eng 8 | 🟠/M | new GH Action |

---

## P2 — Structural (this month)

| # | Item | Src | Sev/Eff |
|---|---|---|---|
| 19 | **Per-article Prerequisites callout + top-of-page TL;DR** (distinct from bottom Key Takeaways / flat Related) | UX 3.1/4.1/11.2 | 🟠/M |
| 20 | **Strip `NN-` prefixes from folder-index card titles** + add one-line description & item count per card (currently "01-Distributed-Systems" empty boxes) | UX 6.1/6.2 | 🟡/M |
| 21 | **Flatten the "Concepts" nesting level** — promote children under Fundamentals (target ≤3 levels) | UX 2.2/6.3 | 🟡/M |
| 22 | **Golden-file tests for each `inject-*`** guarding the `</article>` anchor (silent-failure guard) | Eng 2/8 | 🟡/M |
| 23 | **Generate homepage cards from frontmatter** (`featured:true` + `order`) instead of 10 hardcoded slugs | Eng 2 | 🟡/M |
| 24 | **Raster image optimization pass** (Sharp → AVIF/WebP + `srcset`) | Eng 5 | 🟡/M |
| 25 | **Add CSP + security `<meta>`s** (self+Supabase+Plausible+fonts) + referrer/X-Content-Type-Options | Eng 6 | 🟡/M |
| 26 | **Re-enable local graph** on article pages (not global graph) | UX/Eng IA 4 | 🟡/M |
| 27 | **Port related-notes + prev/next + SEO injectors to Quartz emitters/components** — removes O(N²) related + O(passes×pages) rewrites & the `</article>`-anchor fragility | Eng 1/2 | 🟠/L |
| 28 | **Collapse deep-dive/failure sections into `<details>`; split 30-min articles**; add wide-table scroll affordance | UX 4.1/4.2 | 🟡/L |
| 29 | **Verify `inject-seo` emits** canonical + `og:*`/`twitter:*` + Article/BreadcrumbList JSON-LD per page | Eng 7 | 🟡/S |
| 30 | **Enable Plausible + `window.onerror` beacon**; add Supabase liveness/backup (`pg_dump`) | Eng 9 | 🟡/M |

---

## P3 — Long-term (months)

| # | Item | Src |
|---|---|---|
| 31 | References / primary-source links on algorithm articles (11/46 today) | UX 11.1 |
| 32 | Pseudocode/code blocks on algorithm-heavy pages (0 `<pre>` on Consensus) | UX 12.1 |
| 33 | Make sign-in visibly optional ("Sign in to save progress"); add related-by-tag / popular pages | UX 1.1/7 |
| 34 | Host migration to Cloudflare/Netlify (CDN + incremental builds) as `gh-pages` bloats | Eng 10 |
| 35 | Virtualized / section-scoped Explorer tree | Eng 1 |
| 36 | Stable slugs decoupled from `NN-` ordering; never renumber existing folders | Eng 7 / UX |
| 37 | Enforce unique note IDs / fail build on ambiguous wikilinks (shortest-path degrades at scale) | Eng 3 |
| 38 | `TAG_MAP` → config-driven + sync-time warning on unmatched published notes | Eng 3 |
| 39 | Pin community plugins to commit SHAs; add `npm audit` gate; document fork point | Eng 2/6 |
| 40 | Curated MOC/`type: hub` landing pages per major topic | UX/Eng IA 4 |
| 41 | Obsidian Templater stamping `publish`/`title`/`tags`/`description` on note creation | Eng 3 |
| 42 | Nightly ops: lychee broken-link crawl, Lighthouse CI budget, pa11y/axe, contentIndex size budget | Eng 9 |

---

## Recommended execution order

1. **Task 0** (rebuild + re-triage) — decides whether the two flashiest "Critical" items are real work.
2. **P0 batch** — one PR of quick a11y/link/asset fixes (items 1–11); all Small effort, ships trust + WCAG wins today.
3. **P1 #12 + #13** — the two true blockers (dead links, search cliff), each its own PR.
4. **P1 #14 + #17 + #18** — security + CI safety net (protects everything after).
5. **P1 #16** — description backfill (content task, parallelizable in the vault).
6. **P2** — structural learning-flow & framework-debt paydown, phase-by-phase per existing `docs/website-improvements/` convention.
7. **P3** — as the vault grows toward hundreds of notes.

## Cross-audit dedup notes

- UX §7 (dead links) and Eng §3 (wikilink resolution) are the **same root problem** → items 1 + 12.
- UX §5.1 (dark diagrams) and UX §2.1 (pager) are **pipeline-completeness** issues, not missing features → Task 0.
- Eng §1 (search index) is invisible today but is the single biggest scaling risk → item 13 + the size-budget alarm (item 11).
- Eng §2 (injector fragility) underlies many UX items; item 27 pays it down once search/links are safe.
