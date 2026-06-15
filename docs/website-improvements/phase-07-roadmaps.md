# Phase 07 — Roadmaps

## What changed

**Vault side** (committed separately in `~/Idea/ObisdianNotes`):

- New `03-Roadmaps/` folder with 5 notes:
  - `index.md` — landing page with how-to-use guidance.
  - `distributed-systems-roadmap.md` — 10 articles, three legs:
    foundations → coordination → partitioning/operations.
  - `system-design-roadmap.md` — 20 articles across 7 layers (wire,
    APIs, caching, databases, messaging, architecture, operability).
  - `ai-systems-roadmap.md` — 3 articles (fundamentals, RAG, serving)
    + explicit "growing" framing for the in-progress vault notes.
  - `staff-engineer-roadmap.md` — breadth map across 9 areas, framed
    as scope-not-depth navigation.
- `PUBLISH.md` adds `03-Roadmaps/**`.

**Site side** (this PR):

- `topics.config.mjs` — adds a "Roadmaps" topic (icon: `map`, order
  55) pointing to `03-Roadmaps/`. Now 7 top-level topics total.
- `content/index.md`:
  - Adds a Roadmaps pill to the home Topics grid (between APIs &
    Networking and Reading Series).
  - Converts the home `## Roadmaps` section's 4 "Coming soon"
    placeholder `<div>` cards into real `<a>` anchor links pointing
    at the new roadmap pages. Status pill copy updated per roadmap
    (e.g. "10 articles · curated order", "9 areas · breadth map").
- No SCSS changes — existing `.fpe-roadmap-card` rules apply to both
  `<div>` and `<a>` variants (hover + text-decoration already
  defined).
- Build verification: 71 pages now (was 66) → 66 articles +
  5 roadmap pages. Topic nav strip injected on 19 landing pages
  (was 18). JSON-LD injected on 49 articles (was 45 — +4 roadmaps).

## Why

The 4 roadmap landing pages were the single largest "missing entry
point" identified in the original initiative spec. Today, a visitor
who lands on the home and wants depth in a specific area has two
options: scroll the topic grid (good for narrow topics, weak for
sequential learning) or scroll the Featured grid (good for one-off
articles, weak for "where do I start"). Roadmaps fill that gap with
opinionated, dependency-respecting reading orders.

The roadmaps are deliberately text-only for this PR. Each is anchored
to existing notes — no broken targets, no aspirational links.
Excalidraw diagram banners are a Phase 7.5 follow-up (the diagram
authoring skill in the vault is the right tool for those, and they
shouldn't block the structural work this PR delivers).

## Trade-offs

- **No Excalidraw banner per roadmap (yet).** Pragmatic call: the
  textual reading order is the load-bearing content; adding 4
  high-quality hand-drawn dependency diagrams is a multi-hour
  authoring task that's better done with the `excalidraw-note-diagram`
  skill in a follow-up. The roadmap pages already feel substantial
  without them.
- **AI Systems Roadmap only lists 3 articles today.** The page calls
  this out explicitly ("the rest of the vault is being authored")
  rather than padding with stubs. Will grow as embeddings / vector
  DBs / chunking notes ship.
- **Staff Engineer Roadmap is a breadth map, not a sequence.** It
  intentionally uses sub-sections instead of a single numbered list
  because the job at staff scope isn't "read these 40 things in
  order" — it's "be ready to pull the trade-off from cold in any of
  these 9 areas." The page says this up front.
- **Cross-roadmap wikilinks** like `[[distributed-systems-roadmap]]`
  resolve at Quartz build time, not at vault-side validation time.
  The single-file `validate-wikilinks.mjs` reports them as warnings;
  they render correctly after `npm run build` (verified locally —
  every cross-roadmap link in the built HTML resolves to the right
  URL).

## Future enhancements

- **Phase 7.5 follow-up:** add one Excalidraw dependency diagram per
  roadmap, banner-style at the top, using the same hand-drawn /
  GitHub-dark conventions the skill enforces in the vault.
- **Roadmap progress badges:** once analytics (Phase 5) is live for a
  month, mark each roadmap step the user has visited via a small
  client-side check against localStorage. Lightweight, no accounts.
- **Generate a printable / single-page version** of each roadmap so a
  preparing-for-interview reader can checklist offline.
- **Linkability into specific steps:** add anchor IDs per article entry
  so external blog posts can deep-link to "step 8 of the Distributed
  Systems Roadmap."

## Validation

- Build: `npm run build` runs clean; 71 pages, +5 roadmap pages, +1
  landing for topic nav.
- Wikilink validation: every link in each roadmap to an
  outside-the-batch note resolves to an already-published note
  (verified via `validate-wikilinks.mjs`). Cross-roadmap links and
  intra-batch links produce expected warnings (the validator is
  single-file) but render correctly in built HTML.
- Topic nav: `/03-roadmaps/` index page receives `is-active` state
  on its Roadmaps pill. All 4 roadmap detail pages also receive
  the strip with Roadmaps active.
- SEO: all 4 roadmap detail pages get canonical, Article JSON-LD,
  and BreadcrumbList JSON-LD from the Phase 6 injector — no special
  handling needed.
- Home page Roadmaps section: all 4 cards link to the live pages
  (was "Coming soon" placeholders).
