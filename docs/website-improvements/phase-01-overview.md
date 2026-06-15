# Phase 1 — Website foundation

> Branch: `phase-01-homepage` · base: `main`

## Goal

Take the homepage from "polished notes folder" to "intentional learning
product" without redesigning the visual system that already works. The
existing Anthropic-inspired palette, type ramp, hero card, and
Featured / Reading Series grids stay; new sections layer in around them.

## What shipped

### Homepage (`content/index.md`)

Section order is now:

1. **Hero** (unchanged) — name, role, one-line pitch, About CTA.
2. **What you'll find here / Topics** (new) — six icon-pills linking
   into the deepest folder that has substantive content for each topic.
   This is the first thing under the hero so a new visitor knows the
   site's surface area before they see any specific article.
3. **Featured** (unchanged, 9 cards) — the curated essays.
4. **Popular** (new, 6 cards) — manual list of high-impact notes
   rendered as a tighter numbered grid. Will switch to analytics-driven
   ordering after Phase 5 collects ~30 days of Plausible data.
5. **Roadmaps** (new placeholder, 4 cards) — the four roadmaps the
   spec calls out, each marked "Coming soon". Phase 7 ships the real
   content; Phase 1 establishes the slot so visitors expect them.
6. **Recent** (new, auto-populated) — top 5 most-recently-modified
   articles, rebuilt every `npm run build`. See below for the data
   pipeline.
7. **Reading Series** (unchanged) — the existing 6 path cards.
8. **YouTube** (new placeholder) — single dashed-border card.
9. **Newsletter** (new placeholder) — single dashed-border card with
   RSS fallback link.
10. **About** (new strip) — compact two-column mini-About so a visitor
    who scrolled past the hero CTA still hits a contextual entry to
    `/about/`.
11. **How to browse** (unchanged).

### About page (`content/about.md`)

- Added **What I write about** — three bullets covering the three
  topical pillars (distributed systems & databases, system & arch
  design, AI systems).
- Added **How this site is built** — one paragraph naming Quartz,
  Obsidian, Excalidraw, and the public repo. Tone stays humble: "If
  you spot a bug, the PR queue is open."

### New CSS (`quartz/styles/custom.scss`)

All additive — no existing rule is touched. New classes:

- `.fpe-topics-grid` / `.fpe-topic-pill` — icon-pill grid for the
  Topics section.
- `.fpe-popular-list` / `.fpe-popular-item` — numbered card list (CSS
  counters); two columns on ≥900px.
- `.fpe-roadmap-grid` / `.fpe-roadmap-card` — roadmap card variant
  with eyebrow + status pill ("Coming soon").
- `.fpe-recent-list` / `.fpe-recent-card` — tighter Featured-grid
  variant for the auto-generated Recent section.
- `.fpe-placeholder-card` — soft-dashed single card for YouTube +
  Newsletter sections.
- `.fpe-about-strip` — two-column mini-About strip (collapses to one
  column on mobile).
- `.fpe-section-eyebrow` — small-caps eyebrow above section headings.
- `.fpe-section-empty` — fallback text inside an empty data slot.

Section-level rhythm rule keeps spacing consistent between sections of
different shapes. No changes to typography ramp, palette, header, or
footer.

### Build-time helper (`scripts/build/inject-recent.mjs`)

New post-build step wired into `npm run build` after `fix-paths`:

```
npm run sync
  → npm run validate:home
    → npx quartz build
      → npm run fix-paths        (existing — rewrite Excalidraw URLs)
        → npm run inject-recent  (new — fill Recent section)
```

How it works:

1. Walks every `*.html` under `public/` and reads each page's
   `<time datetime="...">`, `<h1 class="article-title">`, breadcrumb
   tail (for the eyebrow), and `<meta name="description">`.
2. Skips home, about, 404, folder/series landings (`/index`), and tag
   pages.
3. Sorts the rest by ISO datetime desc, picks the top 5.
4. Replaces the inner content of the `<div id="fpe-recent-auto-slot">`
   placeholder in `public/index.html` with rendered
   `<a class="fpe-article-card fpe-recent-card">` cards.

Idempotent — running twice yields identical output. Safe to skip — if
the slot div is missing, the script logs and exits zero. The
placeholder text "Recent articles will appear here…" inside the slot
ships as fallback if the build skips this step.

## Trade-offs

- **Topic-pill targets for Architecture and APIs point at folders.**
  Two of the six topics have only a folder index (Quartz-generated)
  rather than a hand-written landing page. That's good enough for
  Phase 1 — Phase 2's `topics.config.mjs` will give us a real place to
  attach topic descriptions, and Phase 7 will ship the
  `03-Roadmaps/` notes that get their own landing pages.
- **Popular is hand-curated.** Until Plausible (Phase 5) collects
  meaningful data, the Popular list is a best-guess from how-often-I-
  cite-them. The list lives in `content/index.md`, so updating it is
  one PR.
- **Recent reflects `mtime`, not authorship time.** The
  `created-modified-date` plugin's git path doesn't find commits for
  most `content/*` files (the sync script writes them fresh each
  build; not every file ends up in a content commit). Filesystem
  mtime is therefore close-to-uniform across the synced set, and
  Recent is currently ordering by sync-write order. **Follow-up
  (filed as todo in `plan.md`):** have `scripts/sync-from-vault.mjs`
  read the vault's git history and write `modified:` into each note's
  frontmatter so the date plugin's `frontmatter > git > filesystem`
  priority surfaces the real edit date.
- **Roadmaps are placeholder cards.** Visually identical to a real
  roadmap card so the home doesn't change layout when Phase 7 ships;
  marked `aria-disabled="true"` and "Coming soon".

## Validation

- `npm run build` succeeds; `validate:home` confirms all
  `fpe-article-card` and `fpe-path-card` hrefs resolve.
- `inject-recent` logs 5 cards written.
- Spot-check on built `public/index.html`: 39 fpe-* card classes
  present; 5 `.fpe-recent-card`s in the Recent section.
- Live Playwright smoke deferred to PR-merge time (skill's
  Phase 6 — local Playwright is broken for clean URLs).

## Follow-ups

- **Modified-date pipeline** — see trade-off above. Without it,
  Recent is approximate. Single-file change in
  `scripts/sync-from-vault.mjs`.
- **Topic landing pages** — Phase 2 will introduce
  `topics.config.mjs`; topic descriptions and ordering belong there.
- **Popular = auto** — flip to Plausible-driven once Phase 5 lands
  and we have ≥30 days of traffic.
- **Newsletter form** — when ready, replace the placeholder card with
  a real subscribe form (likely Buttondown — cookieless and Plausible-
  friendly).
- **YouTube** — when the channel goes live, swap placeholder for an
  embed + the three most-recent videos.
