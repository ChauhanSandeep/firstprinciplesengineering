# Conventions reference

A single-page guide to every convention the website-improvements
phases introduced. If you're adding a new note, a new injector, or
a new phase, start here.

## Frontmatter keys (vault notes)

Every key is optional unless marked **required**. Defaults are
documented; missing values fall back gracefully.

| Key                 | Required          | Default                                          | Effect                                                                              |
| ------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `publish`           | **yes**           | —                                                | `true` → publish; `false` → always skip. The publish skill's hard gate.             |
| `title`             | recommended       | leading H1 → prettified stem                     | Page title. Phase 6 prefers 35–60 chars.                                            |
| `description`       | recommended       | first paragraph                                  | Page description + OG fallback. Phase 6 prefers 130–160 chars.                      |
| `socialDescription` | optional          | `description`                                    | OG image text override.                                                             |
| `tags`              | optional          | path-based auto-tag                              | User tags are merged with auto-tags (Phase 8); never overwritten.                   |
| `featured`          | optional          | `false`                                          | Promote to home `## Featured` grid.                                                 |
| `card_eyebrow`      | optional          | first folder segment, stripped of `NN-`          | Eyebrow on the home card.                                                           |
| `card_title`        | optional          | H1                                               | Short title on the home card.                                                       |
| `card_description`  | optional          | drafted by the publish skill                     | One-sentence pitch in the site's voice.                                             |
| `card_order`        | optional          | recency                                          | Stable position in the Featured grid (lower = earlier).                             |
| `status`            | optional          | computed from vault git history                  | `new`, `updated`, `evergreen` (Phase 11). `evergreen` suppresses the badge.         |
| `popular`           | optional          | `false`                                          | Promote to home `## Popular` list until analytics is live.                          |

Series membership is **not** declared per-note. It lives in the
`02-Series/<slug>.md` landing page under a `## Read in order` list
of wikilinks. Phase 9's `validate-series` keeps it honest.

## Build-time injectors

All under `scripts/build/`. All are post-`quartz build` HTML patchers.
All are idempotent via a marker class or id.

| Script                            | Purpose                                                    | Marker                                  |
| --------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `inject-recent.mjs`               | Replaces `<!-- recent:auto -->` on home with 5 newest notes | comment marker                          |
| `inject-topic-nav.mjs`            | Adds `<TopicNav>` strip to landing pages                    | `class="fpe-topic-nav"`                 |
| `inject-prev-next-related.mjs`    | Footer prev/next + Related block                            | `class="fpe-prev-next-related"`         |
| `inject-series-header.mjs`        | Top-of-article series wayfinding banner                     | `id="fpe-series-header"`                |
| `inject-comments.mjs`             | Giscus mount (dormant)                                      | `class="fpe-comments"`                  |
| `inject-analytics.mjs`            | Plausible script tag (dormant)                              | `data-fpe-analytics`                    |
| `inject-seo.mjs`                  | Canonical + Article + BreadcrumbList JSON-LD                 | `data-fpe-jsonld`                       |
| `inject-search-hint.mjs`          | Swap search placeholder + aria-label                         | substring swap                          |
| `inject-status-badges.mjs`        | New/Updated pill next to H1; emits `statusIndex.json`        | `class="fpe-status-badge"`              |
| `inject-404-suggestions.mjs`      | Fuzzy match suggestions on 404 page                          | `id="fpe-404-suggestions"`              |
| `optimize-svgs.mjs`               | SVGO pass over `*.excalidraw*.svg`                          | (in-place; SVGO is itself idempotent)   |

## Publish-time tools

All under `scripts/publish/`. Read-only by default unless they take
a `--plan` argument.

| Script                       | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `discover.mjs`               | Walk the vault, classify candidates (`new`/`changed`/…)        |
| `validate-excalidraw.mjs`    | Verify `*.dark.svg` + `*.light.svg` sidecars                   |
| `validate-wikilinks.mjs`     | Resolve every `[[Target]]` against the publish set             |
| `validate-series.mjs`        | Phase 9: ensure series order is contiguous + members resolve   |
| `seo-audit.mjs`              | Phase 6: title/desc length, OG, canonical, JSON-LD             |
| `suggest-crosslinks.mjs`     | Phase 8: candidate wikilink insertions per note                |
| `update-home-cards.mjs`      | Mutate `content/index.md` Featured grid                        |
| `manage-series.mjs`          | Create/update `02-Series/*.md` landing pages                   |
| `playwright-smoke.mjs`       | Light/dark/mobile smoke pass against local or live URL          |
| `render-report.mjs`          | Markdown report of a publish run                                |

## Stacked-PR mechanics

Branches are named `phase-NN-<slug>`. Each PR targets the previous
phase's branch as its base:

```
main
 └── phase-01-homepage          ── PR #N
      └── phase-02-navigation   ── PR #N+1   (base: phase-01-homepage)
           └── phase-03-article ── PR #N+2   (base: phase-02-navigation)
                └── …
```

Rules:

1. Open each PR as **draft** until the chain catches up.
2. When a parent merges to `main`, `git rebase --onto main <parent>
   <child>` then `gh pr edit <#> --base main`.
3. If a parent needs review changes, land them on the parent branch
   and `git rebase --onto <parent> <old-parent> <child>` for every
   child.
4. **Every commit** carries
   `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
5. **Vault commits and site commits are separate.** Vault repo is
   `~/Idea/ObisdianNotes` (independent git root). Use
   `git -C ~/Idea/ObisdianNotes …` for vault operations. Phase 7 was
   the first to require this.

## Pre-commit guard

`scripts/pre-commit-guard.sh` rejects commits to `content/*` other
than `index.md`, `about.md`, and `_static/**`. The sync script wipes
`content/` on every build, so anything else committed there will be
deleted on the next sync. Always go through the vault for note
edits.

## Adding a new injector

1. Drop the script in `scripts/build/inject-*.mjs`. Marker class or
   id, idempotent (`if (html.includes(MARKER)) return`).
2. Wire it into `package.json`'s `build` and `build:soft` chains.
3. Add a row to this file's "Build-time injectors" table.
4. If it emits a sidecar JSON file, document its location in the
   relevant phase doc.

## Adding a new top-level topic

1. Add an entry to `topics.config.mjs` with `label`, `path`,
   `icon` (existing key in the same file), `order`.
2. Add the matching path prefix to `TAG_MAP` in
   `scripts/sync-from-vault.mjs` if you want auto-tagging.
3. Add the source folder to the vault's `PUBLISH.md` allowlist if
   it's not already covered.
4. Re-run `npm run build`. The home topics grid, `<TopicNav>`, and
   the explorer should all pick it up.
