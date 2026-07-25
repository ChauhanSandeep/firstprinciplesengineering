# P0 / P1 Fix Validation Report

**Date:** 2026-07-25
**Validator:** Staff Software Engineer (independent verification)
**Method:** Static source inspection → **fresh full `npm run build`** (vault present at `../ObisdianNotes`, Node v26.3.0) → served `public/` locally at `http://127.0.0.1:8099` → DOM/artifact assertions + `tsc`, `npm test`, and script-syntax checks run directly.
**Sources validated:** `Audit/P0-FixStatus.md`, `Audit/P1-FixStatus.md`.

---

## Verdict

| Tier | Claimed | Verified done | Notes |
|---|---|---|---|
| **P0** | 12 items | **12 / 12 ✅** | All present in a fresh build and in the served DOM. |
| **P1** | 8 items (12–18) | **7 / 7 implemented ✅** (Pagefind intentionally deferred) | All wired and working, **but one P1 claim is inaccurate** — see 🟠 Defect below. |

**Bottom line:** The P0 and P1 fixes are genuinely implemented, wired into the build chain, and validated end-to-end by a clean full build (exit 0) plus `tsc` (0 errors) and **115/115 tests passing**. One real rendering defect survived P1 and contradicts a stated claim; it should be tracked before deploy. Nothing found is a regression introduced by the fixes.

---

## Build & gate results (fresh `npm run build`, exit 0)

```
optimize-svgs:        processed 338 file(s); saved 3415.6 KB (23.2%)
emit-robots:          wrote public/robots.txt (sitemap https://…/sitemap.xml)
trim-search-index:    cap 8000 chars/note — trimmed 46/82; 1182.2 KB → 409.3 KB (−65%)
check-index-size:     409.3 KB (budget 3072 KB, 13% used)
check-internal-links: scanned 79 page(s), 1490 link(s) → ✅ 0 broken
```

All four new build steps ran, in order, and the build exited **0**.

---

## P0 — item-by-item verification

| # | Item | Verified | Evidence |
|---|---|---|---|
| 0 | Full rebuild / re-triage | ✅ | Fresh build clean; prev/next pager present on articles (`fpe-prev-next-related`); dark diagram pairs present. |
| 1 | 6 mis-resolved `../` internal links | ✅ | `check-internal-links` reports **0 broken** across 1490 links; sync `../` normalization present in `sync-from-vault.mjs`. |
| 2 | Missing `<main>` landmark | ✅ | `<main class="center…">` in all 3 frames; served home **and** article each have exactly **1** `<main>`. |
| 3 | Broken TOC `aria-controls` | ✅ | Served article emits `aria-controls="list-0"` (resolves to the OverflowList id). |
| 4 | Low-contrast tokens | ✅ | `.fpe-search-kbd` / `.roadmap-status` → `var(--darkgray)` in `custom.scss`. |
| 5 | Explorer tap targets < 32px | ✅ | `min-height: 2rem` on explorer rows in `custom.scss`. |
| 6 | `content-visibility` diagram collapse | ✅ | **No** `content-visibility` in `base.scss` **or any built `*.css`**. |
| 7 | Search button accessible-name | ✅ | Confirmed false alarm (no change needed). |
| 8 | Missing `robots.txt` | ✅ | `/robots.txt` serves **200** with correct `Sitemap:` line; `emit-robots.mjs` wired. |
| 9 | Oversized `brand-knight.png` | ✅ | `public/static/brand-knight.png` = **11.9 KB** (12,175 bytes), down from 222 KB. |
| 10 | `account.md` guard allowlist | ✅ | `pre-commit-guard.sh` regex now includes `account\.md`. |
| 11 | No `contentIndex` size budget | ✅ | `check-index-size.mjs` reports 409.3 KB / **13%** of 3 MB budget. |

---

## P1 — item-by-item verification

| # | Item | Verified | Evidence |
|---|---|---|---|
| 12a | Neutralize dead wikilinks → "coming soon" | ✅ | **29** built pages contain `fpe-coming-soon` spans; style present in `custom.scss`. |
| 12b | Neutralize dead breadcrumb/folder links | ✅ | **24** built pages contain `fpe-breadcrumb-inactive`; `remove-series-pages.mjs` rewrites them. |
| 12c | Broken-internal-link **publish gate** | ✅ | `check-internal-links.mjs` crawls 79 pages / 1490 links, **fails the build** on any dangling internal link; ran green. Correctly scopes out external/mailto/tel/fragment links. |
| 13 | Search-index scaling cliff (interim) | ✅ | `trim-search-index.mjs` caps content at 8000 chars/note: 1182→409 KB (−65%); **0 notes over cap**; titles + tags fully preserved. Pagefind **deferred by design**. |
| 14 | Comment-moderation bypass + rate limit | ✅ (by review) | `supabase/schema.sql`: `BEFORE UPDATE` trigger pins every column except `body` when `auth.uid() = old.user_id` (author can't flip `hidden`/`slug`/`parent_id`); service-role (`auth.uid() IS NULL`) bypasses for moderation. `BEFORE INSERT` trigger caps 5 comments/author/60 s. Logic is correct. **Not yet applied to the live DB.** |
| 15 | prev/next pager verify | ✅ | Pager present on served article pages. |
| 16 | Backfill `description` frontmatter | ✅ | **79** built pages carry `<meta name="description">`; `deriveDescription()` present in sync. (Quality caveat below.) |
| 17 | CI privacy guard | ✅ | `.github/workflows/ci.yml` `privacy-guard` job asserts only allowlisted `content/**` is tracked; logic verified against the tree. |
| 18 | CI build/test gate | ✅ | `check` job: `tsc --noEmit` (**0 errors** locally), `npm test` (**115/115 pass** locally), `node --check` on every build script (**all parse**). `tsconfig` `ignoreDeprecations: "6.0"` present and unblocks `tsc`. |

---

## 🟠 Defect found — contradicts a P1 claim (track before deploy)

**Raw `[[…]]` wikilink fragments leak into 3 published pages.**
The P1 doc (#12a) claims *"0 raw `[[…]]` leak into HTML."* A fresh build produces **6 raw `[[` occurrences across 3 pages**:

- `01-fundamentals/02-databases/01-fundamentals/02-cap-and-pacelc.html`
- `01-fundamentals/01-concepts/04-caching/02-consistent-hashing.html`
- `01-fundamentals/01-concepts/03-data/01-big-data-stream-processing.html`

Rendered output looks like:
```html
<td>**[[03-DynamoDB</td><td>DynamoDB]]**</td>
<td>[[01-Kafka</td><td>Kafka]] Streams</td>
```

**Root cause:** these are **pipe-aliased wikilinks inside Markdown tables** in the source vault, e.g. `[[03-DynamoDB|DynamoDB]]`. Inside a table row the `|` alias separator collides with the table-column delimiter, so the table parser splits the wikilink across two `<td>` cells. Neither the sync-time neutralizer nor Quartz's wikilink resolver ever sees a well-formed `[[…]]` token, so the fragments pass through as literal text.

**Why the new gate didn't catch it:** `check-internal-links.mjs` only inspects `<a href>` targets. These leaks are broken **text**, not anchors, so the link gate correctly reports 0 broken links while visibly-broken markup still ships.

- **Severity:** Medium — visible garbled markup on 3 live pages; not a crash or security issue.
- **Recommendation (pick one):**
  1. **Sync fix:** escape `|` inside wikilinks that sit in table rows (`[[a|b]]` → `[[a\|b]]`) before Markdown parsing, or resolve wikilinks to `<a>`/coming-soon spans *before* table splitting.
  2. **Gate hardening:** add a post-build assertion that fails on any literal `[[` / `]]` in emitted HTML (a 2-line addition to `check-internal-links.mjs` or a sibling check). This would have caught it.
  3. **Content fix:** escape the pipes in the source note (`01-Fundamentals/02-Databases/01-Fundamentals/01-Database-Concepts.md` and the two others).

---

## 🟡 Minor observations (non-blocking)

1. **Auto-derived descriptions can be low quality.** Some notes begin with a `**Related Topics**:` link list, so the derived meta description becomes e.g. `"Related Topics: Distributed Caching, Cassandra, DynamoDB"` instead of prose. The mechanism works; the heuristic should skip leading "Related Topics"/link-list lines, or hand-write `description:` on high-traffic notes (already listed as deferred in P1).
2. **SVGO config warning (pre-existing).** `optimize-svgs` prints `"removeViewBox … not part of preset-default"` repeatedly. Non-fatal, but the plugin config should be corrected to silence it.
3. **Supabase triggers are review-validated only.** `schema.sql` has not been applied to the live project. Run it (idempotent) and confirm author-edit immutability + rate limit in the dashboard before relying on the moderation guarantee. Flagged as deferred in P1 — reiterated here as a deploy prerequisite.
4. **CI `check` uses Node 22; local build ran on Node 26.** `package.json` engines require `>=22`, so this is fine, but keep CI and local majors aligned to avoid drift.

---

## Deploy-readiness checklist

- [x] Full build passes (exit 0) with all new gates green.
- [x] `tsc --noEmit` clean; 115/115 tests pass; all build scripts parse.
- [x] `robots.txt`, trimmed search index, size budget, link gate all functioning.
- [ ] **Fix / track the `[[…]]`-in-table leak** (3 pages) — recommend gate hardening (option 2) so it can't recur.
- [ ] Apply `supabase/schema.sql` to the live project and verify moderation/rate-limit behavior.
- [ ] (Optional) improve description derivation for "Related Topics"-led notes.
- [ ] Commit changes and run `npm run deploy` (build → `validate:deploy-domain` → `gh-pages`).

**Conclusion:** P0 is fully done and verified. P1 is functionally done and verified (with Pagefind intentionally deferred), with **one Medium rendering defect** that must be tracked/fixed and one moderation change still pending application to the live database.
