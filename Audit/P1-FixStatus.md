# P1 Remediation — Fix Status

**Date:** 2026-07-25
**Scope:** P1 (high-impact) tier from `Audit/RemediationPlan.md`, derived from `UxAudit.md` + `EngineeringAudit.md`. Follows `Audit/P0-FixStatus.md`.
**Build validated:** full `npm run build` (complete injector chain incl. new gates) exits clean; served locally at `http://127.0.0.1:8099` and verified in a real Chromium browser via Playwright.
**Deploy status:** built and running **locally only**. Not yet pushed to `gh-pages` / production. All changes are **uncommitted on `main`**.

---

## ✅ Fixed & validated (P1)

| # | Item | Audit | Fix | Validation |
|---|---|---|---|---|
| 12a | Dead cross-links to unpublished notes | UX 7.1 | `sync-from-vault.mjs` precomputes the published-note set; wikilinks to unpublished/unresolved notes are rendered as non-clickable `<span class="fpe-coming-soon">` "coming soon" text instead of dangling `<a>` 404s | Sync neutralized **95** dead links; a note with 13 renders 13 non-clickable spans, **0** inside anchors; **0** raw `[[…]]` leak into HTML |
| 12b | Dead breadcrumb/folder links | UX 7.1 | `remove-series-pages.mjs` now also rewrites any `<a>` pointing at the 4 intentionally-removed folder pages into `<span class="fpe-breadcrumb-inactive">` | **25** dead folder links neutralized across **24** pages |
| 12c | Broken-internal-link **publish gate** | UX 7.1 / Eng | New `scripts/build/check-internal-links.mjs` crawls every emitted page, resolves all same-site `<a href>`, and **fails the build** on any dangling internal link (`--soft` to warn). Wired into `build` / `build:soft` | Scans 79 pages / 1490 links → **✅ 0 broken**; before the fix it caught the 25 real folder 404s |
| 13 | Search-index scaling cliff | Eng 1 / 10 | New `scripts/build/trim-search-index.mjs` collapses whitespace and caps each note's indexed `content` to `SEARCH_CONTENT_CAP` chars (default **8000**), bounding per-note growth. ⌘K search UI untouched. (Full Pagefind migration deliberately **deferred** — see below) | Index **1182 KB → 409 KB (−65%)**, now 13% of the 3 MB budget guard; ⌘K search still returns 17 hits for "microservices"; titles/tags fully searchable |
| 14 | Comment-moderation bypass + rate limit | Eng 6 | `supabase/schema.sql`: `BEFORE UPDATE` trigger pins every column except `body` when the author edits (blocks self-un-hide / slug/parent tampering); dashboard/service-role moderation still works. `BEFORE INSERT` trigger enforces ≤5 comments/author/60 s | SQL reviewed; author edits can only change `body`, `hidden` is immutable to authors, service-role (dashboard) moderation preserved |
| 16 | Missing `description` frontmatter | UX 13.1 / Eng 3 | `sync-from-vault.mjs` derives a clean first-prose-paragraph description (markdown/HTML stripped, ~155-char cap at word boundary) when a note has none. Explicit `description:` always wins | **41** descriptions derived (matches the audit's "41 missing"); spot-checked output is real prose |
| 17 | CI privacy guard | Eng 6 / 8 | New `.github/workflows/ci.yml` `privacy-guard` job fails if any non-allowlisted `content/**` file is tracked (public repo — no reliance on the local hook) | Guard logic run locally against the tree → **✅ clean** |
| 18 | CI build/test gate | Eng 8 | Same workflow `check` job: `npm ci` → `tsc --noEmit` → `npm test` → `node --check` on every build script. Fixed a blocking `tsconfig` deprecation (`ignoreDeprecations: "6.0"`) so `tsc` is green | `tsc --noEmit` **0 errors**; **115/115** tests pass; all build scripts parse |
| 15 | prev/next pager verify | UX 2.1 | Re-confirmed present in the full build (was a P0 false alarm) | Pager present on article pages (validated in P0) |

### Files touched (P1)
- `scripts/sync-from-vault.mjs` — published-set precompute, dead-link neutralization, `deadLinksNeutralized`/`descriptionsDerived` stats, `deriveDescription()` helper.
- `scripts/build/remove-series-pages.mjs` — neutralize links to removed folder pages.
- `scripts/build/check-internal-links.mjs` — **new** publish gate.
- `scripts/build/trim-search-index.mjs` — **new** index content cap.
- `supabase/schema.sql` — comment update-integrity + rate-limit triggers.
- `quartz/styles/custom.scss` — `.fpe-coming-soon` + `.fpe-breadcrumb-inactive` styles.
- `.github/workflows/ci.yml` — **new** privacy guard + build/test gate.
- `tsconfig.json` — `ignoreDeprecations: "6.0"` (unblocks `tsc`).
- `package.json` — `trim-search-index` + `check-internal-links` scripts, wired into `build` / `build:soft`.

---

## ⏳ Pending / deferred

### Deferred within P1
- **Full Pagefind search migration (structural fix for #13).** The content cap bounds growth but search remains a single client-loaded index. The durable fix — a sharded, lazily-loaded Pagefind index — was deferred because it means replacing the polished ⌘K search UI, a higher-risk change on the live site. Revisit when the corpus approaches the budget alarm. *(User-approved deferral.)*
- **Author-written descriptions.** #16 ships an auto-derived fallback; hand-written `description:` frontmatter still gives better SEO/social snippets for the highest-traffic notes.
- **Extend CI to `prettier --check`.** Left out of the hard gate because ~86 files (mostly vendored Quartz + some project scripts) carry pre-existing formatting debt; a repo-wide format pass should precede turning this gate on.
- **Supabase triggers are validated by review only** — run `supabase/schema.sql` against the project (idempotent) and confirm author-edit/rate-limit behavior in the live dashboard before relying on it.

### Not started — P2 / P3
See `Audit/RemediationPlan.md` §P2 (prerequisites callout, folder-card cleanup, nesting flatten, golden-file injector tests, frontmatter-driven home cards, AVIF/WebP, CSP, local graph, injector→emitter port, SEO/JSON-LD verify, analytics/backup) and §P3 (long-term platform/content investments).

---

## Notes for deploy
- Production deploy runs `npm run deploy` (full build → `validate:deploy-domain` → `gh-pages`). The build now also runs `trim-search-index`, `check-index-size`, and `check-internal-links` — the last will **block deploy** if any internal link 404s.
- `supabase/schema.sql` must be applied to the Supabase project separately (SQL editor); it is idempotent and safe to re-run.
- Nothing is committed yet; commit + push when local validation is signed off.
