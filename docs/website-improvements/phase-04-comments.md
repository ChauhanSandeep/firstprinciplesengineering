# Phase 4 — Comments via Giscus

> Branch: `phase-04-comments` · base: `phase-03-article`

## Goal

Let readers correct, push back, or add context to any article — using
GitHub Discussions as the backend so the conversation lives next to
the code, not on a third-party SaaS. **Status: pipeline shipped,
dormant until enabled.** The config + injector + CSS all land in this
PR; turning comments on is one config edit + a five-minute setup on
the GitHub side.

## What shipped

### `comments.config.mjs` (new, repo root)

Single-file Giscus configuration with placeholder IDs and an
`enabled: false` flag. The header docstring walks through the exact
five steps to enable:

1. Enable Discussions on the repo.
2. Create a "Comments" category.
3. Install the Giscus GitHub App.
4. Get repo / category IDs from giscus.app.
5. Replace placeholders, flip `enabled: true`.

No build break until those steps are done — `inject-comments` logs
"disabled" and exits zero.

### `scripts/build/inject-comments.mjs` (new)

Post-build step (after `inject-prev-next-related`):

- Walks every article HTML under `public/`.
- Skips home / about / 404 / landing & series pages / tag indexes.
- Inserts a `<section id="fpe-comments">` immediately AFTER the
  Phase-3 `<aside id="fpe-prev-next-related">` so the footer reads
  top-down: *"you just finished this · here's what's next · here's
  the discussion"*. Falls back to before `</article>` if Phase 3
  hasn't run.
- The section contains:
  - `<h2>Discussion</h2>`
  - A fallback paragraph linking directly to the GitHub Discussions
    URL — works without JS.
  - An empty `<div class="fpe-comments-mount" data-fpe-comments
    data-repo=… data-repo-id=… …>` carrying every Giscus parameter
    as a `data-*` attribute.
- Followed by an inline `<script>` that:
  1. Lazy-loads the Giscus client (`giscus.app/client.js`) when the
     mount nears the viewport via `IntersectionObserver` (rootMargin
     200px). Falls back to immediate load when the observer isn't
     available.
  2. Bridges the page's dark-mode toggle to the Giscus iframe via
     `postMessage`. The script watches the root element's
     `saved-theme` attribute and posts `{ giscus: { setConfig:
     { theme } } }` to the iframe whenever it flips.

Idempotent — the section carries `id="fpe-comments"`, so re-running
the script skips already-injected pages.

### Styling (`quartz/styles/custom.scss`)

New `.fpe-comments` block — heading, fallback paragraph (accent
underline link affordance matching the rest of the site), and a
`min-height: 4rem` mount so the page doesn't jump as the iframe
loads. All additive.

### Build wiring (`package.json`)

```
… → inject-prev-next-related → inject-comments
```

When `enabled: false` the chain is a no-op for this step.

## Trade-offs

- **No likes / dislikes.** Per the user's spec. Giscus' reactions
  feature is enabled but stops at thumbs-up / heart on the parent
  thread — no inline article rating.
- **Comments scope: articles only.** Excluded from the home, About,
  series landings, folder indexes, tag pages, 404. Discussion makes
  sense on substantive content; index pages would dilute the signal.
- **Lazy load, not async load.** First-paint cost is zero — the
  client script is only fetched when the mount is within 200px of
  the viewport. On a typical article scroll, that's about when the
  reader hits the prev/next aside, which is the right moment.
- **Theme bridging via `MutationObserver`.** Quartz's dark-mode
  plugin flips `documentElement[saved-theme]`. The bridge watches
  that one attribute, not a custom event. Robust and dependency-
  free, but tied to the current dark-mode plugin's contract.
- **Placeholders are visible in git.** `comments.config.mjs` ships
  with `REPLACE_ME` IDs. When the user fills them in, the IDs are
  public (giscus.app IDs are not secret — they're embedded in every
  client request).

## Validation

- Build passes with `enabled: false`: `inject-comments: comments
  disabled in comments.config.mjs; skipping`. No HTML is mutated.
- Enabled-path is verifiable locally by flipping `enabled: true`
  with placeholder IDs — the injector then errors out only at the
  "placeholder IDs" check before touching HTML. The full live test
  requires a real Giscus app install.

## Follow-ups

- **Enable Giscus on the live site** — five-minute config edit per
  the file header. Should happen as a separate small PR so the
  diff is just the config flip.
- **Per-article opt-out** — frontmatter `comments: false` could
  suppress the mount on draft / fast-moving notes. Not added yet
  because there's no clear use case until comments are live.
- **Spam strategy** — Giscus inherits GitHub Discussions' moderation
  (block, mark off-topic, lock). If spam becomes a real problem,
  the next step is to require sign-in (already required by Giscus)
  and add a category for "Spam" with auto-move rules.
