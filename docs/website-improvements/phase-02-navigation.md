# Phase 2 — Topic navigation (superseded)

The original Phase 2 added a horizontal topic-tab strip
(`inject-topic-nav.mjs` + `topics.config.mjs`). That was later removed.

Current decision:

- The homepage should not show topic tabs; they compete with the primary
  Roadmaps entry point.
- Internal navigation is handled by search, breadcrumbs, the explorer, and
  roadmap pages.
- Auto-tags still come from `TAG_MAP` in `scripts/sync-from-vault.mjs`.
