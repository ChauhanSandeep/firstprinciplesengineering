/**
 * publish.config.mjs
 *
 * Bootstrap configuration. Publishing is controlled primarily by each
 * vault note's frontmatter (`publish: true`). The in-vault manifest is an
 * optional legacy fallback for temporary path/glob allowlists.
 *
 * - `vaultRoot`    : path to your Obsidian vault, relative to this folder or
 *                    absolute. Override at runtime with QUARTZ_VAULT_ROOT.
 * - `manifestFile` : filename (vault-relative) of the optional publishing
 *                    manifest Markdown file. Default: "PUBLISH.md".
 *
 * The manifest is a Markdown file with YAML frontmatter, e.g.:
 *
 *   ---
 *   publish:
 *     - 01-Fundamentals/01-Concepts/**
 *     - 02-SystemDesign/**
 *   ---
 *
 * `publish: false` in note frontmatter is always a hard veto.
 */
export default {
  vaultRoot: "../ObisdianNotes",
  manifestFile: "PUBLISH.md",
}
