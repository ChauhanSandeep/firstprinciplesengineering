# Phase 2 — Top-level topic navigation

> Branch: `phase-02-navigation` · base: `phase-01-homepage`

## Goal

Stop making visitors think in vault folder names. The vault structure
(`01-Fundamentals/01-Concepts/01-Distributed-Systems/`) is the right
shape for *me* as the author, but the wrong shape for a reader. They
want to think in topics: "Distributed Systems", "Databases", "AI
Systems".

The existing explorer mapFn already strips `NN-` prefixes so the tree
*reads* fine, but the tree depth still leaks: a visitor has to drill
down two levels to get to "Distributed Systems". This phase adds a
**topic-first jump bar** on every landing page so the depth doesn't
matter for the most common navigation goal.

## What shipped

### Canonical topic config (`topics.config.mjs`)

Single source of truth for the six top-level topics:

| Topic | Path | Icon |
| --- | --- | --- |
| Distributed Systems | `01-Fundamentals/01-Concepts/01-Distributed-Systems/` | network |
| Databases | `01-Fundamentals/02-Databases/01-Fundamentals/` | database |
| Architecture | `01-Fundamentals/01-Concepts/02-Architecture/` | architecture |
| AI Systems | `01-Fundamentals/05-AI-ML/` | sparkles |
| APIs & Networking | `01-Fundamentals/01-Concepts/05-API/` | api |
| Reading Series | `02-Series/` | series |

Adding a new topic = one edit here + one matching `<a class="fpe-topic-pill">`
entry in the homepage Topics section. Same file feeds Phase 8's
tag-page polish.

### Topic-nav strip injection (`scripts/build/inject-topic-nav.mjs`)

Post-build step (after `inject-recent`):

1. Walks every `*/index.html` under `public/` (home + folder/series
   landing pages).
2. Skips the 404 and `tags/` pages (they have different layouts).
3. Sorts topics by `order`, renders a horizontal pill strip, marks
   the active topic with `is-active` + `aria-current="page"` based on
   a case-insensitive URL-prefix match against the current page slug.
4. Inserts the strip immediately before `<article>` (so it sits in
   the main content column, above the H1, below the breadcrumb).
5. Idempotent — re-runs skip pages that already carry
   `id="fpe-topic-nav"`.

Result on this build: **18 landing pages** got the strip.

### Styling (`quartz/styles/custom.scss`)

New `.fpe-topic-nav` block:

- Horizontal scroll-snap bar (mobile-first; 6 pills fit on desktop,
  scroll on narrow viewports).
- Each pill: icon + label, 0.55–0.85rem padding, rounded top corners,
  transparent bottom border that becomes the active accent.
- Active state: secondary color text + accent border-bottom + soft
  tint behind the pill.
- Hover: lighter version of the active treatment so the affordance
  is obvious without being noisy.
- Scrollbar hidden (Webkit + Firefox); touch-scroll preserved.

Purely additive — no existing rule is modified.

## What this phase does *not* do (intentional)

- **No tree restructuring.** Collapsing
  `01-Fundamentals/01-Concepts/01-Distributed-Systems` into a single
  virtual explorer node is risky (breaks Quartz's tree assumptions),
  and the topic-nav strip already addresses the actual user need
  (fast cross-topic jumps). The explorer continues to render the full
  vault hierarchy with `NN-` prefixes stripped.
- **No new Quartz component.** Every Quartz Community plugin in this
  repo is sourced from `github:`. Adding a local component requires
  setting up the plugin install / build pipeline. Build-time HTML
  injection achieves the same outcome with one self-contained script.
- **No injection on article pages.** Articles already have a
  breadcrumb that tells the reader where they are; adding a second
  horizontal nav would compete with it. The topic strip is a *landing*
  primitive, not a per-article one.

## Trade-offs

- **Mixed-case URLs in topic href vs lowercase URLs in the built
  filesystem.** Quartz's emitter lowercases the *filesystem path*
  but keeps the *anchor href* in original case. The active-state
  comparison normalises both to lowercase, so it works either way.
  Documented in the script.
- **Hand-keyed icons in `topics.config.mjs`.** Inline SVG strings are
  uglier than importing from a Lucide-style library, but they ship
  without a JS bundle change and inline cleanly into the home
  Topics section + the topic-nav strip. Acceptable.
- **The home page Topics section duplicates topics.config.mjs.**
  `content/index.md` is markdown, can't `import`. Comments call out
  the manual mirror. Future option: turn the Topics section into
  another `<div id="...">` slot that `inject-topics.mjs` fills from
  config. Deferred until we need it (the list churns rarely).

## Validation

- `npm run build` passes; injector logs `injected into 18 landing
  page(s)`.
- Idempotency: re-running `inject-topic-nav` on an already-built
  `public/` reports `injected 0; skipped 18`.
- Active state: spot-checked
  `public/01-fundamentals/02-databases/01-fundamentals/index.html`
  and `public/01-fundamentals/05-ai-ml/index.html` — both contain
  exactly one `is-active` pill, matching the page's topic.

## Follow-ups

- **Replace the home Topics section** with a slot the injector fills
  (eliminates the manual mirror).
- **Topic landing pages** — Phase 8 will use `topics.config.mjs` to
  generate real curated landing pages (with description + featured
  notes per topic), so the topic-nav strip on those pages becomes a
  link to a hand-curated entry, not a Quartz auto folder-index.
- **Sticky variant** — consider `position: sticky; top: 0` on the
  topic-nav strip for long landing pages. Deferred — needs a UX
  call about how it interacts with Quartz's existing sticky page
  header.
