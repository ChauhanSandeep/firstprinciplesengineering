# Phase 3 — Article experience: prev/next + related

> Branch: `phase-03-article` · base: `phase-02-navigation`

## Goal

Make every article feel like part of a navigable curriculum, not an
isolated dead-end. After Phase 1 (homepage sections) and Phase 2
(topic-first landings), this phase upgrades the *per-article* reading
experience with:

1. **A series strip** when the article belongs to a Reading Series.
2. **Sibling prev / next** within the same folder when there's no
   series (or when siblings differ from the series order).
3. **Related articles** — up to 5 distinct, scored against the
   current article.

## What shipped

### `scripts/build/inject-prev-next-related.mjs` (new)

Post-build step (after `inject-topic-nav`). For every article HTML
under `public/`:

**Skipped pages:** home, about, 404, folder/series landings (`/index`),
tag pages.

**Series strip** — built from `content/02-Series/*.md` definitions.
Each series file's `## Read in order` section is parsed for wikilinks;
the order of wikilinks defines the position. The strip renders as:

```
[ Series · APIs & Networking · 3 / 5 ]
[ ← Previous in series : API Gateway ]   [ Next in series → : GraphQL ]
```

Wikilink targets resolve via a basename → contentIndex slug map, so
`[[01-Kafka|Kafka]]` correctly hits `01-fundamentals/03-technologies/01-kafka`
regardless of original-vs-lowercase casing in the URL.

**Sibling prev/next** — within the same parent folder. Sorted with
`localeCompare(en, { numeric: true })` so `NN-` prefixes drive the
order. Skips when the series already provides the same prev/next,
otherwise renders the sibling row alongside (rare but supported).

**Related list** — scored against every other article in
`contentIndex.json`:

| Signal | Score |
| --- | --- |
| Same series | +3 |
| Same parent folder | +2 |
| Same grandparent folder | +1 |
| Target appears in this page's outgoing links (`links[]`) | +1 |

Top 5 distinct articles after excluding self, prev, next, and the
series neighbours. (Tag scoring will reactivate in Phase 8 when
`tags` populate.)

**Insertion point:** immediately after the closing `</article>` tag.
The whole block carries `id="fpe-prev-next-related"` for idempotency.

**Validation logged this build:** `injected into 45 articles
(11 with series strip); skipped 21`.

### Styling (`quartz/styles/custom.scss`)

New `.fpe-prev-next-related` block + children:

- `.fpe-series-tag` — pill with eyebrow + name + position (X / Y).
- `.fpe-pn-card` — prev / next cards in a 2-column grid (collapse to
  one column on mobile). Next cards align right.
- `.fpe-pn-empty` — invisible placeholder keeping the 2-column grid
  honest when only one side has content.
- `.fpe-related` — simple vertical list with accent-coloured links
  and an underline-on-hover affordance.

All additive — no existing rule changed.

### Build wiring (`package.json`)

```
… && npm run fix-paths && npm run inject-recent && \
  npm run inject-topic-nav && npm run inject-prev-next-related
```

Pure post-build chain. Idempotent and zero-config — the script reads
from `public/static/contentIndex.json` + `content/02-Series/*.md`,
nothing else.

## Trade-offs

- **No "Last updated" or "Reading time" tweaks.** Both already render
  via the `content-meta` plugin in the article header; the format
  looked fine on inspection. Anything more aggressive (e.g. a custom
  date-with-relative-distance partial) would mean forking that
  plugin or building a local Quartz component — out of scope.
- **Breadcrumbs unchanged.** The existing breadcrumbs plugin gives
  the right output already; Phase 2's topic-nav strip handles the
  cross-topic jump need; per-article breadcrumb tweaks would be
  cosmetic.
- **Tag-based related scoring is dormant.** No notes carry `tags:`
  frontmatter today. Phase 8 will seed them via `topics.config.mjs`
  auto-tagging, at which point the +2 shared-tag signal can light up
  in `pickRelated()`.
- **Title quality propagates.** A few notes still carry the pre-sync
  filename-derived title (e.g. "01 Redis") in `contentIndex.json`.
  These render in the Related list. Fix lives in the vault note's
  frontmatter `title:`, not in this script.
- **One regex bug fixed during dev.** First implementation used `\Z`
  (not a JS regex token), which truncated the "Read in order"
  section at the first literal `z` character. Fixed to use index-
  based section slicing (`raw.search` + slice to next `## `).
  Documented in script comments.

## Validation

- `npm run build` passes; injector logs `45 articles (11 with series
  strip); skipped 21`. Skip count matches the count of landing /
  index / tag / about / 404 pages, as expected.
- Spot-checked:
  - `/01-fundamentals/01-concepts/05-api/02-api-gateway.html` —
    APIs & Networking series strip, position 3 / 5, prev "API
    Design", next "GraphQL".
  - `/01-fundamentals/02-databases/01-fundamentals/06-mvcc.html` —
    no series; sibling siblings CAP/PACELC ← → none-after; related
    list cites Database Concepts, Redis, DynamoDB, Lakehouse,
    Isolation Levels.
  - `/01-fundamentals/03-technologies/01-kafka.html` — Production
    Systems Deep Dives series, position 1 / 6.

## Follow-ups

- **Title cleanup** — sweep notes whose `contentIndex.json` title is
  the filename rather than a real H1 / frontmatter title (Redis,
  Lakehouse). Single PR against the vault.
- **Series landing page back-card** — Phase 9 adds a "← Back to
  series: <name>" card at the end of every series member; Phase 3
  already provides the prev/next strip, Phase 9 closes the loop.
- **Tag signal in related** — light up the +2 shared-tag score once
  Phase 8 seeds `tags:` from `topics.config.mjs`.
- **"On this page" deep-link list** — Quartz's TOC already covers
  this; revisit only if a clear need surfaces.
