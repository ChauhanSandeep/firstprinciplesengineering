# Phase 08 — Discoverability

## What changed

- **`scripts/sync-from-vault.mjs`** — adds `autoTagsFor(rel)` and a
  `TAG_MAP` of path prefix → tag slugs. Every synced note gets one
  primary topic tag (and a secondary tag for sub-areas like NoSQL or
  Lakehouse). User-supplied `tags:` in frontmatter is **preserved**;
  auto-tags are additive. Vocabulary aligns with `topics.config.mjs`
  so the topic-nav and `/tags/<slug>/` pages refer to the same names.
- **`scripts/build/inject-search-hint.mjs`** (new, wired into `npm
  run build`) — post-build placeholder swap on the Quartz search
  input from `"Search for something..."` →
  `"Try: MVCC, RAG, consistent hashing…"`. Done at the HTML layer
  because the Search component ships from a `github:` plugin whose
  i18n is gitignored. Idempotent.
- **`scripts/publish/suggest-crosslinks.mjs`** (`npm run
  crosslinks:suggest`) — read-only analysis of the synced `content/`
  notes. For each note, find candidate places where another
  published note's title appears in prose but isn't linked. Outputs a
  Markdown triage list — never auto-fixes. Flags: `--json`, `--out
  path.md`, `--min-title N`, `--per-note N`.
- **`package.json`** — wires `inject-search-hint` into the `build` and
  `build:soft` chains; adds `crosslinks:suggest` as on-demand.

## Why

Three different discoverability gaps, three different tools:

1. **Tags didn't exist.** Quartz auto-generates `/tags/<slug>/`
   landing pages from frontmatter, but no published note had a
   `tags:` block. Auto-tagging from path is the cheapest way to
   bootstrap the vocabulary without asking the vault to do the work
   note-by-note. The build now generates **16 tag pages** (was 1, an
   empty `/tags/`), giving the search index a real third dimension
   beyond title and content.
2. **Search placeholder said "Search for something..."** — generic,
   doesn't suggest the site has anything worth searching for. A
   concrete prompt that names actual on-site topics is a tiny copy
   change with a measurable nudge effect on engagement.
3. **Cross-linking is one of the highest-impact discoverability
   investments**, but it's expensive at vault scale. A conservative
   literal-match suggester turns the "I should manually go look for
   missing links" task into a triage list that fits in a single
   review session.

## Trade-offs

- **Auto-tagging is path-based, not content-based.** A note that
  lives at `01-Fundamentals/02-Databases/01-Fundamentals/06-MVCC.md`
  gets `databases` even though MVCC is also a distributed-systems
  topic. Adding `tags:` in the vault frontmatter merges, so the user
  can layer on secondary tags. The path-tag is intentionally the
  primary one — `topics.config.mjs`'s top-level groups are the
  visible navigation.
- **`inject-search-hint.mjs` is fragile to upstream copy changes.**
  If the Quartz Search plugin renames its placeholder string, the
  injector becomes a no-op. Logging makes this obvious (it prints
  the page count it modified); if that suddenly drops to 0 after a
  `quartz plugin install`, the needle string needs updating. The
  fragility is the cost of keeping the placeholder configurable
  without forking the plugin.
- **The cross-link suggester is intentionally conservative.** No
  fuzzy matching, no NLP, no stemming. False positives in
  cross-link suggestions destroy the report's signal-to-noise ratio,
  and a triage list that's mostly noise gets ignored. The
  consequence: it misses pluralizations and inflections. That's the
  intended trade.
- **No `popular: true` curation in this PR.** Marking ~10 notes as
  popular requires per-note vault edits and a home Popular section
  rerender — better as a focused follow-up PR after the autopilot
  chain merges. Flagged in **Phase 8 follow-ups**.

## Verified locally

- `npm run sync` now writes `tags:` to **all 56 synced notes** (path
  matches one of the 14 prefix rules; verified on MVCC → `databases`,
  RAG → `ai-systems`, distributed-systems-roadmap → `roadmap`).
- `npm run build` runs clean. **86 pages** total. **16 tag pages**
  (was 1). All 7 topic-nav labels have a matching tag page
  (`distributed-systems`, `databases`, `architecture`, `ai-systems`,
  `apis`, `roadmap`, `series`) plus sub-area tags (`nosql`,
  `lakehouse`) and concept tags (`data`, `caching`, `security`,
  `operations`, `networking`, `systems`).
- `inject-search-hint` updated **85 pages** (all but the OG-image
  variants). Spot-check: `public/index.html` placeholder is now
  `"Try: MVCC, RAG, consistent hashing…"`.
- `npm run crosslinks:suggest` produces a clean report: **56 notes
  scanned, 47 candidates, 49 sources with at least one suggestion**.
  Hand-spot-checked the first ~10 suggestions — each is a real
  missing link, not a false positive.

## Follow-ups

- **Vault frontmatter pass to add `popular: true`** to the ~10 most
  foundational notes (Consistent Hashing, MVCC, RAG, Kafka, Consensus,
  CAP/PACELC, API Design, BFF, Spanner, DynamoDB). Then point the
  home `Popular` section's injector at that flag.
- **Topic-tag page polish.** Default Quartz tag pages render
  reasonably, but a custom intro paragraph + topic icon pulled from
  `topics.config.mjs` would make them feel curated rather than
  auto-generated. Needs a custom `quartz/components/TagContent.tsx`.
- **Apply cross-link suggestions in a vault PR**. The suggester is
  read-only by design; a human reviewer needs to accept each
  suggestion (some are spurious, e.g. when the source note is
  *about* the candidate and shouldn't re-link).
- **Search hints from analytics.** Once Plausible has 30+ days of
  data, swap the static placeholder for the top-3 most-searched
  terms.
