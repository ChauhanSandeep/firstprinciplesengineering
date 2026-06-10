/**
 * publish.config.mjs
 *
 * USER-EDITABLE: controls which notes get published, in addition to per-note
 * `publish: true` frontmatter.
 *
 * Rules (evaluated by scripts/sync-from-vault.mjs):
 *   1. If a note has `publish: false` in frontmatter → NEVER published. (Escape hatch.)
 *   2. If a note has `publish: true`              → published.
 *   3. If a note's path matches any pattern in `publishFolders` → published
 *      (and the sync script injects `publish: true` into the copied frontmatter
 *      so Quartz's second-gate filter accepts it).
 *   4. Otherwise → not published.
 *
 * Patterns use minimatch glob syntax (relative to the vault root).
 */
export default {
  publishFolders: [
    // First curated batch — see PUBLISHING.md for how to add more.
    "01-Fundamentals/01-Concepts/**",
  ],
}
