# Phase 06 — SEO

## What changed

- **`scripts/build/inject-seo.mjs`** (post-build): walks every page in
  `public/`, then for each page adds (idempotently):
  - `<link rel="canonical" href="…">` derived from the existing
    `<meta property="og:url">` value (already populated per page by
    the og-image plugin).
  - On article pages, a `<script type="application/ld+json">`
    `Article` schema block with `headline`, `datePublished`,
    `dateModified`, `description`, `image`, `author`,
    `publisher`, and `mainEntityOfPage`.
  - On article pages, a second `<script>` `BreadcrumbList` schema
    derived from the existing
    `<nav class="breadcrumb-container">`.
- **`scripts/publish/seo-audit.mjs`** (`npm run seo:audit`): read-only
  audit of every built page. Reports title length (target 35–60 chars),
  description length (130–160), missing OG image, missing canonical,
  missing/extra `<h1>`, and (on article pages) missing JSON-LD blocks.
  Emits Markdown to stdout, or JSON with `--json`, or a file with
  `--out path.md`.
- **`package.json`**: `inject-seo` is now the final step of `build` and
  `build:soft`. `seo:audit` is on-demand.

The non-article skip list (home, about, 404, `*/index`, tag pages) is
shared between the two scripts so they agree on what counts as an
"article".

## Why

Two complementary needs:

1. Search engines and social platforms want structured data they can
   parse without guessing. Schema.org JSON-LD is the unambiguous
   contract; Google explicitly recommends `Article` + `BreadcrumbList`
   and surfaces breadcrumbs in SERP when valid.
2. Author-side, the only way to keep titles and descriptions in the
   SERP-friendly window over time is to *measure* — hence the audit
   script. It surfaces problems but never auto-edits, because every
   real fix belongs in the vault note's frontmatter (which is the
   source of truth).

Both run after the rest of the build pipeline, so they see the same
fully-resolved HTML the user sees.

## Trade-offs

- **JSON-LD dates use the single `<time datetime>` value the page
  already exposes**, so `datePublished` and `dateModified` are
  identical. The richer split needs a vault-side `created:` /
  `modified:` frontmatter pair driven from git history (already a known
  follow-up in `scripts/sync-from-vault.mjs`); when that lands, the
  injector picks it up automatically because it just re-reads the same
  `<time>` element the meta plugin will then drive.
- **Breadcrumb names mirror the rendered breadcrumb component
  (`01-Fundamentals`, …)** because that's what the user sees and we
  want SERP to match. Phase 2's explorer `mapFn` will produce cleaner
  labels (`Distributed Systems`, …); the JSON-LD inherits that for free
  because it parses the same rendered breadcrumb HTML.
- **The audit reports 119 issues today** (63 short titles, 34 short
  descriptions, 21 long descriptions, 1 long title). All are vault-side
  edits; this PR does not touch the vault. Surface area is now visible
  and tracked — the publish skill can incorporate this into Phase 2 of
  its existing validation flow.
- **`og:image` and `og:description` already exist on every page** (the
  og-image plugin generates per-page social cards), so the audit's
  social-tag bucket is currently empty. Kept the checks anyway so a
  future regression would surface immediately.

## Future enhancements

- Wire `seo:audit --json` into the publish skill's Phase 2 (validate)
  so the report is part of every publish run's audit trail.
- Vault frontmatter pass to bring all titles into the 35–60 char window
  by adding tagline suffixes ("MVCC — Snapshot Isolation Without
  Locks"). Same pass adds explicit `description:` to notes missing
  one.
- Once `sync-from-vault.mjs` writes git-derived `created:` / `modified:`
  frontmatter, expose both as separate `<time>` elements so JSON-LD's
  `datePublished` and `dateModified` diverge for older articles.
- Add `WebSite` + `SearchAction` JSON-LD on the home page so Google
  shows the site-search box directly in SERP.
- Consider an `Organization` schema on `/about/` once a logo and
  social-profile URL set is stable.

## Validation

- `npm run build` ran clean (66 pages canonical, 45 articles got Article
  + BreadcrumbList JSON-LD).
- Spot-check on `06-mvcc.html`: both JSON-LD blocks parse via `JSON.parse`,
  schema fields populated correctly.
- `npm run seo:audit` reports zero infrastructure issues (canonical,
  OG, JSON-LD) — every remaining issue is a content edit.
