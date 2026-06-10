/**
 * publish.config.mjs
 *
 * Bootstrap configuration. The actual publish allowlist lives INSIDE the
 * vault — see `<vaultRoot>/<manifestFile>` (default: PUBLISH.md).
 *
 * - `vaultRoot`    : path to your Obsidian vault, relative to this folder or
 *                    absolute. Override at runtime with QUARTZ_VAULT_ROOT.
 * - `manifestFile` : filename (vault-relative) of the publishing manifest
 *                    Markdown file. Default: "PUBLISH.md".
 *
 * The manifest is a Markdown file with YAML frontmatter, e.g.:
 *
 *   ---
 *   publish:
 *     - 01-Fundamentals/01-Concepts/**
 *     - 02-SystemDesign/**
 *   ---
 *
 * Per-note overrides still work via `publish: true` / `publish: false`
 * in the note's own frontmatter.
 */
export default {
  vaultRoot: "../ObisdianNotes",
  manifestFile: "PUBLISH.md",
}
