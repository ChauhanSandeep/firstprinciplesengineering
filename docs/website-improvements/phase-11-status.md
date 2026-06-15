# Phase 11 — Content status surfacing

## What changed

Two distinct improvements, both driven by real vault git history
rather than synthetic frontmatter, both shipped as post-build
injectors:

### 1. Status badges next to article H1

`scripts/build/inject-status-badges.mjs` walks every article in
`public/`, looks up its source file in `contentIndex.json`, then
shells out to `git -C $VAULT_ROOT log` to fetch:

- **created** — `--diff-filter=A --follow -1 --format=%aI`
- **modified** — `-1 --format=%aI`

Rules:

| State       | Condition                                           |
| ----------- | --------------------------------------------------- |
| **New**     | `created < 30 days` ago                             |
| **Updated** | `modified < 14 days && created >= 30 days`          |
| _(none)_    | otherwise                                           |
| _(none)_    | frontmatter `status: evergreen` overrides any badge |

Frontmatter `status: new` or `status: updated` force a badge.

Badge renders as a small pill (`.fpe-status-badge .fpe-status-badge--{new|updated}`)
right after the H1 text inside `<h1 class="article-title">`. Theme-aware
colour (green for New, amber for Updated; dark-mode variants in CSS).

Sidecar file `public/static/statusIndex.json` written with every
entry `{ slug → { status, created, modified } }`. Used today by the
404 page (below) and reserved for a future explorer overlay that
shows a dot next to newly-touched files.

### 2. 404 fuzzy suggestions

`scripts/build/inject-404-suggestions.mjs` rewrites `public/404.html`
to add a `<div id="fpe-404-suggestions" hidden>` container plus an
inline script that, after Quartz's `contentIndex.json` loads:

1. Skips out if the existing case-fix redirect is about to fire.
2. Extracts a "title-ish" query from the last URL path segment
   (strips `NN-` prefix, hyphens → spaces).
3. Scores every indexed page by `2 × token overlap + 3 × trigram
   overlap + substring boost`.
4. Renders up to 5 candidates with score ≥ 1.5 as a bullet list
   inside the container, then un-hides it.

If no candidate clears the bar, nothing renders — the page falls
back to the existing "use search, head home" copy.

## Why git history (not frontmatter)

`content/` is regenerated every `npm run sync`, so mtimes and Quartz's
auto-detected dates are all "right now". The vault repo at
`~/Idea/ObisdianNotes` is the only source of authoring + edit
history per source file. We treat the vault as a database and shell
out to git for the dates we need; no extra metadata for the user to
maintain.

## Trade-offs

- **`VAULT_ROOT` is hard-coded** to `/Users/sandeep/Idea/ObisdianNotes`
  with a `VAULT_ROOT` env-var override. The site repo doesn't have
  the vault as a submodule; this matches the existing
  `publish.config.mjs` convention. CI / cloud builds would need to
  set the env var or skip the injector cleanly (it logs and exits 0
  if the vault dir is absent).
- **Badge windows are generous** (30 / 14 days). On an actively-
  maintained vault almost every article will pick up an "Updated"
  pill. We accept the noise during the publishing-out-loud phase;
  tighten via env vars later if needed.
- **Suggestion scoring is intentionally crude** — token overlap +
  trigrams + substring boost. Pure-JS, no client-side library, runs
  in a few ms even on the full 86-page index. Good enough; can be
  swapped for `fuse.js` if we ever want fuzzy-search proper.

## Future enhancements

- Promote `statusIndex.json` into the left-sidebar explorer so
  recently-touched files get a tiny coloured dot.
- Add a "What's new" page at `/whats-new` that just renders the
  contents of `statusIndex.json` grouped by week.
- Allow `status: draft` to render a sand-coloured pill on
  intentionally-experimental articles.
