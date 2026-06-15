# Phase 15 — Documentation roll-up

## What changed

Two new docs that turn the per-phase write-ups into a navigable
reference.

### `docs/website-improvements/README.md`

The index page. Includes:

- A one-paragraph "why a phased plan" intro.
- The full phase table with PR numbers, what changed, and why.
- A diagram of how the build chain composes (sync → quartz build →
  11 post-build injectors).

### `docs/website-improvements/conventions.md`

The catalog. Includes:

- Every frontmatter key with its default and effect.
- Every build-time injector script + its marker.
- Every publish-time tool script + its purpose.
- Stacked-PR mechanics (branch naming, base-rebase flow,
  co-author trailer rule, vault-vs-site repo separation).
- How to add a new injector.
- How to add a new top-level topic.

## Why

The eleven shipped phases each touched a different slice of the
build pipeline. A future maintainer (including this same author six
months from now) shouldn't have to spelunk through PR descriptions
to know whether a frontmatter key is honored or what `inject-foo`
does. The index and the conventions doc are the two pages they
should ever need to open first.

## Trade-offs

- We did **not** publish `docs/website-improvements/` as part of the
  live site. These docs are for contributors, not readers. Quartz
  could render them, but they would clutter the explorer.
- The phase index references PR numbers that the user can confirm
  against the GitHub UI; we did not embed PR diff stats because the
  numbers would drift as parents merge to main and children get
  rebased.

## Future enhancements

- A short `docs/website-improvements/quickstart.md` for "I want to
  add a single note" — currently the publish skill is the answer,
  but a written quickstart would help non-skill users.
- Auto-generate the conventions table from JSDoc-style comments at
  the top of each injector. Today the file is hand-curated; the
  drift cost is low.
