# P0 Remediation — Fix Status

**Date:** 2026-07-25
**Scope:** P0 (quick-win) tier from `Audit/RemediationPlan.md`, derived from `UxAudit.md` + `EngineeringAudit.md`.
**Build validated:** full `npm run build` (complete injector chain), served locally at `http://127.0.0.1:8099` and verified in a real Chromium browser via Playwright.
**Deploy status:** built and running **locally only**. Not yet pushed to `gh-pages` / production. All changes are **uncommitted on `main`**.

---

## ✅ Fixed & validated (P0 — all 12 items)

| # | Item | Audit | Fix | Validation |
|---|---|---|---|---|
| 0 | Full rebuild + re-triage | UX 5.1 / 2.1 | Ran complete build chain | Dark diagrams (169 pairs) + prev/next pager (49 articles) confirmed present — both were **false alarms** from an earlier partial preview build |
| 1 | 6 mis-resolved `../` internal links (BFF, api-protocols) | UX 7.1 | Rewrote wikilink `../` normalization to full vault-root paths in `scripts/sync-from-vault.mjs` | Sync normalized 10 links; target pages resolve 200; table integrity + anchors/aliases preserved |
| 2 | Missing `<main>` landmark | UX 9.1 | `.center` `<div>` → `<main class="center">` in all 3 frames | Exactly 1 `<main>` on home/about/tags/account/article |
| 3 | Broken TOC `aria-controls` | UX 9.2 | Aligned `aria-controls` to the `OverflowList` id (`listId`) in TOC plugin (src + patched `dist`) | `aria-controls` → `list-0` resolves to a real element |
| 4 | Low-contrast tokens | UX 9.3 | `.roadmap-status` + `.fpe-search-kbd` → `var(--darkgray)` | ⌘K kbd **6.62:1**, roadmap-status **7.09:1** (both ≥ 4.5) in dark mode |
| 5 | Explorer tap targets < 32px | UX 2.3 / 9.4 | `min-height: 2rem` + flex on folder buttons/anchors/file links in `custom.scss` | min **32px** across 66 interactive rows |
| 6 | `content-visibility` diagram collapse | UX 5.2 | Removed `content-visibility: auto` from global `img` rule in `base.scss` | article img computes `visible` |
| 7 | Search button accessible-name mismatch | UX 9.4 | (No change needed) | `aria-label="Search"` matches visible text; ⌘K kbd is `aria-hidden` — **false alarm** |
| 8 | Missing `robots.txt` / sitemap | Eng 7 | New `scripts/build/emit-robots.mjs` + `emit-robots` npm step wired into build | `/robots.txt` serves 200 with sitemap URL |
| 9 | Oversized `brand-knight.png` | Eng 5 | Resized 812→256px + sharp compress | **222 KB → 11.9 KB** |
| 10 | `account.md` privacy-guard allowlist mismatch | Eng 6 | Added `account\.md` to `scripts/pre-commit-guard.sh` regex + help | Guard now allows the intended file |
| 11 | No `contentIndex.json` size budget | Eng 1 / 9 | New `scripts/build/check-index-size.mjs` (budget 3072 KB) wired into build | Build reports **1183.8 KB / 39%** used |

### Files touched
- `scripts/sync-from-vault.mjs` — `../` wikilink normalization + `wikilinksNormalized` stat.
- `quartz/components/frames/{DefaultFrame,FullWidthFrame,MinimalFrame}.tsx` — `<main>` landmark.
- `.quartz/plugins/table-of-contents/{src,dist}/…` — `aria-controls` fix.
- `quartz/styles/custom.scss` — contrast tokens + explorer tap targets.
- `quartz/styles/base.scss` — removed `content-visibility: auto`.
- `scripts/pre-commit-guard.sh` — `account.md` allowlist.
- `scripts/build/emit-robots.mjs`, `scripts/build/check-index-size.mjs` — new.
- `package.json` — `emit-robots` + `check-index-size` scripts appended to `build` / `build:soft`.
- `quartz/static/brand-knight.png`, `public/static/brand-knight.png` — compressed.

---

## ⏳ Pending

### P1 — High-impact (this week)
| # | Item | Src |
|---|---|---|
| 12 | Neutralize ~73 dead cross-links to unpublished notes (render as non-clickable "coming soon") + **broken-internal-link publish gate**. *29% of internal links 404 — top issue in both audits.* | UX 7.1 |
| 13 | Kill search-index scaling cliff — migrate `contentIndex.json` (full bodies) to **Pagefind** (sharded) or strip `content`. | Eng 1 / 10 |
| 14 | Fix comment-moderation bypass (author `UPDATE` can flip `hidden=false`) + per-user insert rate limit. | Eng 6 |
| 15 | Verify/repair prev/next pager in full build; add smoke assertion. | UX 2.1 |
| 16 | Backfill `description:` frontmatter (only 5/46 articles have it); auto-derive first paragraph as fallback. | UX 13.1 / Eng 3 |
| 17 | CI privacy guard on `main` (fail if disallowed `content/**` tracked — repo is public). | Eng 6 / 8 |
| 18 | CI build/test gate (`tsc`, `prettier --check`, `tsx --test`, fixture-vault smoke build). | Eng 8 |

### P2 — Structural (this month)
Prerequisites callout + TL;DR (UX 3.1/4.1), folder-card title cleanup (UX 6.1), flatten "Concepts" nesting (UX 2.2), golden-file tests per `inject-*` (Eng 2/8), frontmatter-driven homepage cards (Eng 2), AVIF/WebP image pass (Eng 5), CSP + security meta (Eng 6), local graph (IA 4), port injectors to Quartz emitters (Eng 1/2), collapse deep-dive sections (UX 4.1), SEO/JSON-LD verify (Eng 7), analytics/error beacon + DB backup (Eng 9).

### P3 — Long-term (months)
See `Audit/RemediationPlan.md` §P3.

---

## Notes for deploy
- Production deploy runs `npm run deploy` (full build → `validate:deploy-domain` → `gh-pages`).
- Nothing is committed yet; commit + push to `gh-pages` when the local validation is signed off.
