---
name: quartz-publish-notes
description: >-
    End-to-end publishing of new and changed notes from the private Obsidian
    vault at ~/Idea/ObisdianNotes to the live Quartz site at
    https://chauhansandeep.github.io/firstprinciplesengineering. Discovers
    notes flagged `publish: true`, validates Excalidraw dark/light pairs and
    wikilinks, updates Featured / Reading Series cards on the home page,
    builds, validates with Playwright (light/dark/mobile), deploys to
    gh-pages, and emits a structured report. Stops only on critical issues.
    Invoke when the user says things like "publish my new notes",
    "ship the latest from the vault", "update the site with my latest notes",
    or "quartz-publish-notes".
user-invocable: true
---

# `quartz-publish-notes` — vault → live site, end-to-end

You are running the **quartz-publish-notes skill** for the First Principles
Engineering Quartz site. Your job: take new and changed notes from the
private Obsidian vault and ship them to the public site with top-quality
output and zero human intervention in the common case. Prompt the user only
when a genuinely critical issue blocks progress.

## Phase 0 — Anchor the working directory (always your first action)

This skill ships with the site repo and is also exposed via a symlink at
`~/.copilot/skills/quartz-publish-notes`, so it may be invoked from
**either** of:

- `/Users/sandeep/Idea/FirstPrinciplesEngineering` (site repo), **or**
- `/Users/sandeep/Idea/ObisdianNotes` (the private vault)

Before doing anything else, **`cd` into the site repo** so every relative
path (`npm run …`, `scripts/publish/*.mjs`, `content/index.md`, etc.)
resolves correctly:

```bash
cd /Users/sandeep/Idea/FirstPrinciplesEngineering
```

All subsequent commands in the phases below assume this is your cwd. The
helper scripts under `scripts/publish/` resolve their site/vault paths via
their own `__dirname`, so they also work if you ever need to call them
from elsewhere, but `npm run …` does not — so always anchor first.

## Repository facts you must use

- Site repo: `/Users/sandeep/Idea/FirstPrinciplesEngineering` (Quartz v5)
- Vault repo: `/Users/sandeep/Idea/ObisdianNotes` (private, separate git root)
- Vault path is configured in `publish.config.mjs` → `vaultRoot`
- Site is published at https://chauhansandeep.github.io/firstprinciplesengineering
- Build pipeline: `npm run sync` (vault → content/) → `npx quartz build` (content → public/) → `npm run fix-paths` (rewrite Excalidraw URLs + apply dark/light pair). `npm run build` runs all three. `npm run deploy` runs build + gh-pages push.
- Existing safety net: `scripts/pre-commit-guard.sh` rejects commits to `content/*` other than `index.md`, `about.md`, `_static/**`.
- The home page (`content/index.md`) has two card sections:
  - `## Featured` — `<a class="fpe-article-card">` blocks with `.article-eyebrow`, `.article-title`, `.article-desc`
  - `## Reading Series` — `<a class="fpe-path-card">` blocks with `.path-title`, `.path-desc`, `.path-count`

## Frontmatter convention (vault notes)

| Key                 | Required          | Default                                   | Effect                                                                              |
| ------------------- | ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `publish`           | yes (for publish) | —                                         | `true` = publish; `false` = always skip.                                            |
| `title`             | yes               | —                                         | Page title.                                                                         |
| `description`       | recommended       | first paragraph                           | Page description and (fallback) social description.                                 |
| `socialDescription` | optional          | `description`                             | OG-image text override.                                                             |
| `tags`              | optional          | —                                         | Tag list.                                                                           |
| `featured`          | optional          | `false`                                   | Promote to home `## Featured` grid.                                                 |
| `card_eyebrow`      | optional          | first folder segment, stripped of `NN-`   | Eyebrow label on the card.                                                          |
| `card_title`        | optional          | H1                                        | Short title on the card.                                                            |
| `card_description`  | optional          | drafted by skill                          | One-sentence pitch in the site's voice.                                             |
| `card_order`        | optional          | recency                                   | Stable position in the Featured grid (lower = earlier).                             |
| `series`            | optional          | none                                      | Slug matching `02-Series/<slug>.md` OR a new series.                                |
| `series_order`      | optional          | append                                    | Position within the series' "Read in order" list.                                   |

## Phases — run in order

### 1. Discover

Run `node scripts/publish/discover.mjs` and capture its JSON output. It
walks the vault, parses frontmatter, and classifies each candidate as
`new`, `changed`, `unchanged`, or `removed` against the current `content/`.

### 2. Validate

For each new/changed candidate, run in parallel:

- `node scripts/publish/validate-excalidraw.mjs <note-path>` — verifies both
  `*.excalidraw.light.svg` and `*.excalidraw.dark.svg` sidecars exist for
  every embed.
- `node scripts/publish/validate-wikilinks.mjs <note-path>` — resolves every
  `[[Target]]` against the union of (a) other to-publish notes in this
  batch, (b) already-published notes, (c) URL frontmatter aliases.

Collect their JSON output into one batch report.

### 3. Plan

Materialize the full diff:

- Featured-grid changes to `content/index.md` (insert/remove/reorder cards).
- Reading-Series changes to `content/index.md` (path cards) AND new
  `02-Series/<slug>.md` files in the vault.
- Card metadata to fill in for notes that omitted `card_description` etc.
  Draft these now using the site's existing voice as the in-context example:
  - One sentence, opinionated, often ends with a concrete claim or named
    system. Match the tone of existing cards in `content/index.md`.
  - Read the note's intro paragraph(s) for substance. Don't invent facts.

### 4. Critical-issue gate

Before executing, check these critical conditions. If ANY are true, **stop**
and prompt the user with a clear, actionable question (use the `ask_user`
tool). Only proceed after explicit confirmation.

1. Excalidraw source has **no** `.svg` sidecars at all (build would fail).
   → Prompt: "Open Obsidian, run command 'Excalidraw: Re-export SVG/PNG for
   every Excalidraw file', then resume."
2. Wikilink targets a not-published, not-in-batch note.
   → Prompt: "Include `<target>` in this batch (set `publish: true`), or
   rewrite the link as plain text?"
3. A **new** series introduced with `<3` notes — likely a typo.
   → Prompt to confirm series name.
4. Featured grid would exceed **12 cards**.
   → Prompt for which existing card to demote.
5. More than **5 notes** added in a single run.
   → Prompt: "This run will publish N notes; proceed?"
6. New series landing page drafted with low confidence (no clear intro to
   base it on).
   → Show draft, ask for approval.

Non-critical issues (missing one Excalidraw variant, soft warnings, etc.)
are collected for the report and **do not stop the run**.

### 5. Execute

- Edit vault files (new series landing pages, card-metadata frontmatter
  the user omitted but you drafted with high confidence).
- Edit `content/index.md` to apply card changes:
  `node scripts/publish/update-home-cards.mjs --plan <plan.json>`
  `node scripts/publish/manage-series.mjs --plan <plan.json>`
  (both accept `--dry-run` and `--index <path>` for testing; the series
  mutator also takes `--series-dir <path>` for the vault landing-page
  directory.)
- Run `npm run build` (sync + quartz build + fix-paths). Failure → critical,
  stop, surface error.

### 6. Validate live (local)

Run `node scripts/publish/playwright-smoke.mjs --local --slugs <slugs.txt>` which:
- Boots a `python3 -m http.server` on a free port serving `public/`.
- Asserts every new/changed page + home in light, dark, mobile.
- Asserts HTTP 200, no console errors, H1 present, Excalidraw pair images
  visible and horizontally centered.

Failure → critical, dump screenshot, stop.

### 7. Deploy

- In the vault repo, commit any vault changes you made (new series files,
  filled-in frontmatter): `git -C ~/Idea/ObisdianNotes add -A && git commit`.
- In the site repo, commit any `content/index.md` edits: `git add content/index.md`
  and `git commit`.
- Push both: `git push origin <branch>` for each.
- `npm run deploy` from the site repo.
- Wait ~60s, then `node scripts/publish/playwright-smoke.mjs --live --slugs <slugs.txt>` for a
  final smoke pass against the live URL.

Always include this trailer on commits the skill makes:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### 8. Report

Run `node scripts/publish/render-report.mjs --state <state.json>` which emits a
markdown report with these sections:

- **Shipped** — note titles + live URLs, cards added/removed, series
  created/updated.
- **Warnings** — non-blocking issues with file:line citations.
- **Errors** — anything that prevented full success.
- **Follow-ups** — drafts to review (card descriptions, series intros).
- **Stats** — N parsed, N published, build time, image count, deploy duration.

Save the report to
`$COPILOT_SESSION_STATE_DIR/files/publish-report-<ISO timestamp>.md`
(create the dir if absent) and also print to stdout.

## Behavioural rules

- **Always run in dry-run mode first** when `PUBLISH_SKILL_DRY_RUN=1` is set
  in the environment. In dry-run: discover and validate run, the plan is
  printed, but no file is mutated, no build runs, no deploy.
- **Never bypass the pre-commit guard.** If `scripts/pre-commit-guard.sh`
  rejects a commit, treat it as a critical bug in the skill (not a thing
  to override).
- **Never commit anything under `content/*` other than `index.md`,
  `about.md`, `_static/**`.** The sync script wipes `content/` on every
  build; only those three are persistent.
- **Vault edits go in the vault repo. Site edits go in the site repo.**
  These are independent git roots and must be committed separately.
- **Card copy in the site's voice** — one sentence, often ending with a
  concrete claim or named system; opinionated; avoids marketing
  superlatives. Read the existing cards in `content/index.md` as examples
  before drafting.
- **Idempotency** — if you re-run the skill with no vault changes, it
  should detect nothing to do and exit cleanly with an empty report.

## When to ask vs decide

| Situation                                          | Behavior            |
| -------------------------------------------------- | ------------------- |
| Card description missing, intro is clear           | Auto-draft, log to Follow-ups |
| Card description missing, intro is unclear         | Stop, prompt        |
| Series doesn't exist yet, 3+ notes share the slug  | Auto-create page, log to Follow-ups |
| Series doesn't exist yet, 1-2 notes share the slug | Stop, prompt        |
| Excalidraw dark variant missing                    | Warn, continue (pipeline duplicates light into dark slot) |
| Excalidraw light AND dark both missing             | Stop, prompt        |
| Wikilink to unpublished note                       | Stop, prompt        |
| Featured grid > 12 cards after additions           | Stop, prompt        |
| Adding 1–5 notes                                   | Auto-proceed        |
| Adding > 5 notes                                   | Stop, confirm scope |
| Build / Playwright failure                         | Stop, surface error |

## Final reminder

Your end goal is the live site reflects the user's intent without them
having to think about cards, links, paths, deploys, or HTML. Errors should
arrive as crisp questions, never as silent failures. The report is the
human's audit trail.
