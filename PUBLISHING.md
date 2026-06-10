# First Principles Engineering — Quartz publishing pipeline

This directory turns notes from the parent Obsidian vault into a public website
at **https://chauhansandeep.github.io/firstprinciplesengineering**.

It is a separate git repository nested inside the (private) vault repo. Only
notes you explicitly opt in are exposed.

---

## Architecture

```
Idea/ObisdianNotes/                            ← private vault (git repo)
├── 00-QuickStart/                             ← topic folders
├── 01-Fundamentals/01-Concepts/  ...          ← currently allowlisted
├── 02-InterviewProblems/                      ← private (not allowlisted)
├── Excalidraw/*.excalidraw.md (+ .svg)        ← drawings (only SVGs ship)
└── quartz/                                    ← THIS folder, separate git repo
    ├── publish.config.mjs                     ← USER EDITABLE: folder allowlist
    ├── scripts/sync-from-vault.mjs            ← copies publish-eligible notes
    ├── scripts/pre-commit-guard.sh            ← refuses to commit content/*.md
    ├── content/                               ← generated (NEVER commit notes)
    │   └── index.md                           ← hand-maintained landing page
    ├── quartz.config.yaml                     ← Quartz configuration
    ├── public/                                ← built site (pushed to gh-pages)
    └── .github/workflows/deploy.yml           ← gh-pages → GitHub Pages
```

**Two repos, two branches**:
- `main` of `chauhansandeep/firstprinciplesengineering`: source only (config,
  sync script, landing page). The vault content lives only on your machine.
- `gh-pages` branch: rendered `public/` directory, pushed by `npm run deploy`.

---

## Publish rules

A note from the vault is published if **all** of these are true:
1. It does **not** have `publish: false` in frontmatter (escape hatch).
2. AND **either** of:
   - It has `publish: true` in frontmatter, **or**
   - Its path matches a pattern in `publishFolders` in `publish.config.mjs`.

For folder-allowlisted notes, the sync script injects `publish: true` into
the copied frontmatter so Quartz's `ExplicitPublish` filter (a second gate)
accepts them.

### Add a folder to the allowlist
Edit `publish.config.mjs`:
```js
export default {
  publishFolders: [
    "01-Fundamentals/01-Concepts/**",
    "01-Fundamentals/02-Databases/**",   // ← new
  ],
}
```
Then `npm run deploy`.

### Add a single note
In Obsidian, add to its frontmatter:
```yaml
---
title: "My Note"
publish: true
---
```
Then `npm run deploy`.

### Block a specific note from a published folder
```yaml
---
publish: false
---
```

---

## Day-to-day commands

```bash
npm run sync         # vault → content/ (auto-renders Excalidraw SVGs)
npm run sync:soft    # same, but tolerates failures with placeholders
npm run serve        # sync + build + live preview on :8080
npm run serve:soft   # same, soft-mode preview
npm run build        # sync + build (no serve)
npm run deploy       # build + push public/ to gh-pages branch (triggers Action)
```

---

## Excalidraw rendering — automatic

The vault has **538 `.excalidraw.md` source files**. Quartz cannot embed them
directly, so the sync script auto-renders each one to SVG on demand using
`excalidraw-to-svg` (jsdom + node-canvas, headless).

You do **not** need to enable any Obsidian setting or run any export command.

### How it works
For each `![[Foo.excalidraw]]` (or `![[Foo.excalidraw.md]]`) in a published
note, the sync script:
1. Decompresses the lz-string `compressed-json` block from the source.
2. Renders it to SVG (cached by sha1 of source — unchanged files are skipped).
3. Writes `Foo.excalidraw.svg` next to the source in the vault.
4. Copies the SVG into `content/`, mirroring the vault path.
5. Rewrites the embed in the copied note to a relative `<img>` link.

The generated `.excalidraw.svg` files live next to the source files in the
vault. The Obsidian Excalidraw plugin recognizes them as its own SVG exports,
so they don't clutter the file explorer or interfere with the plugin.

The raw `.excalidraw.md` (full JSON scene, including any erased text) is
**never** copied to `content/`.

### Native dependency
`node-canvas` (a transitive dep of `excalidraw-to-svg`) needs cairo + pango.
On macOS:

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
cd quartz && npm install && npm approve-scripts canvas && npm rebuild canvas
```

Note: rendering happens locally during `npm run deploy`. The GitHub Actions
workflow only publishes the pre-built `public/` artifact on the `gh-pages`
branch, so CI does **not** need cairo / pango / canvas installed.

### When auto-rendering fails
If a single drawing fails to render (corrupt source, unsupported feature),
the sync prints which file failed and continues. The build fails by default;
use `npm run sync:soft` to swap the failing embed for a placeholder and keep
going.

---

## Safety nets

Five independent layers prevent private content from leaking:

1. **`publish.config.mjs` + frontmatter** — only allowlisted folders or
   `publish: true` notes reach `content/`.
2. **Quartz `explicit-publish` filter** — every page must have `publish: true`
   at render time; sync script injects it for folder-allowed notes.
3. **Sync script wipes `content/` on every run** — removed or unflagged
   notes can't linger.
4. **`scripts/pre-commit-guard.sh`** — refuses to commit anything under
   `content/` except `index.md` and `_static/**`. Install with:
   ```bash
   ln -sf ../../scripts/pre-commit-guard.sh .git/hooks/pre-commit
   ```
5. **`gh-pages` branch contains only `public/`** (rendered HTML) — the
   source markdown never reaches the public branch.

Sixth (redundant): `quartz.config.yaml` adds `**/*.excalidraw.md` to
`ignorePatterns`, so even a leaked raw source wouldn't render.

---

## Initial GitHub setup (one-time)

```bash
cd quartz
git init
git add -A
git status                            # confirm content/* is NOT staged
git commit -m "Initial Quartz setup"

gh repo create chauhansandeep/firstprinciplesengineering --public --source=. --remote=origin --push

ln -sf ../../scripts/pre-commit-guard.sh .git/hooks/pre-commit
npm run deploy                        # creates gh-pages branch
```

Then on GitHub: repo → **Settings** → **Pages** → Source: **GitHub Actions**.

---

## Known limitations / future polish

- **Dark mode default**: currently follows system preference; forcing dark
  default needs a small head-script tweak.
- **Light Excalidraw theme only**: the renderer emits a single SVG; dark-theme
  variants are not produced.
- **Custom domain**: when ready, set `baseUrl` in `quartz.config.yaml`,
  add a `CNAME` under `content/`, and configure DNS.
- **Cross-folder wikilinks**: links from a published note to an
  unpublished note are reported as "unresolved" warnings and render as plain
  text.
