# Phase 09 — Content series wayfinding

## What changed

- **New build step `inject-series-header`** (`scripts/build/inject-series-header.mjs`).
  Adds a slim, idempotent banner at the top of every article that
  belongs to a series defined under `content/02-Series/*.md`:

  ```
  Part of  APIs & Networking  ·  Step 3 of 5
  ```

  The banner links back to the series landing page. Injected on 11
  articles in the current corpus (5 in *APIs & Networking*, 6 in
  *Production Systems Deep Dives*).

- **New audit `series:validate`** (`scripts/publish/validate-series.mjs`).
  Parses every series landing page's `## Read in order` list and
  reports:
  - Unresolved `[[wikilinks]]` (error, exit 1)
  - Duplicate members (error)
  - Series with `< 3` members (warning)
  - Members that also appear in another series (warning)

  Markdown output by default; `--json` for machine reads.

- **CSS** (`quartz/styles/custom.scss`): one new block,
  `.fpe-series-header`. Pale `--secondary` tint, flexbox, wraps on
  mobile. No layout changes for non-series articles.

- **package.json**: `inject-series-header` wired into both `build`
  and `build:soft` chains, after `inject-prev-next-related` and
  before the comments / analytics / SEO steps. `series:validate`
  exposed as a top-level script.

## Why a separate injector (not an extension of `inject-prev-next-related`)

The two strips have different jobs:

- The footer's `fpe-series-pn` strip is **navigation** — "go to the
  next note in this series".
- The header is **wayfinding** — "you are 3 of 5 in this series; the
  index lives over there". It must appear before the reader starts
  reading, not after.

Splitting them keeps each step single-purpose and independently
debuggable. Both injectors are idempotent (marker check) and read
their own series map from the same `02-Series/*.md` source.

## Trade-offs

- We deliberately did **not** introduce a `series:` frontmatter
  convention. The `02-Series/*.md` landing pages are already the
  source of truth for membership and order; reading order is the
  bullet/numbered list under `## Read in order`. Less metadata to
  maintain, fewer sync paths to keep consistent.
- The header always renders, even on articles that have an
  identical-looking `fpe-series-pn` footer strip. The visual
  duplication is intentional: top = where am I, bottom = where next.
- `validate-series` is non-blocking by default in the build chain
  (it's a publish-time audit, not a build-time gate). Run manually
  before vault commits: `npm run series:validate`. We can promote it
  to a build prerequisite once it has run clean across multiple
  edit cycles.

## Future enhancements

- "Last updated within this series" line on the series landing pages
  (max of `modified` across members). Deferred: the series landings
  are short enough that the prev/next footer already does that work.
- Optional `series:`/`series_order:` frontmatter on individual notes
  as an override, for cases where one note should appear in two
  series with different positions. Not needed today.
- Promote `series:validate` into the publish skill's Phase-2
  validation alongside `validate-excalidraw` / `validate-wikilinks`.
