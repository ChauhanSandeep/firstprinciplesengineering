#!/usr/bin/env node
/**
 * scripts/publish/validate-excalidraw.mjs
 *
 * For each vault note path passed as an argument (or one per line via stdin),
 * find every `![[Foo.excalidraw]]` / `![[Foo.excalidraw.svg]]` embed and check
 * that BOTH `Foo.excalidraw.light.svg` AND `Foo.excalidraw.dark.svg` sidecars
 * exist next to the source `.excalidraw.md` file in the vault.
 *
 * Severity classification:
 *   critical  → no sidecars exist at all (build would fail)
 *   warning   → only one variant exists (the dark/light pair upgrade in
 *               fix-excalidraw-paths.mjs falls back to duplicating the
 *               present one into both slots; theme parity is lost on that
 *               diagram but the page still renders)
 *   ok        → both sidecars present
 *
 * Output: JSON object to stdout with shape:
 *   {
 *     results: [{
 *       note: "<vault-relative path>",
 *       embeds: [{
 *         target: "Foo.excalidraw",
 *         resolved: "/abs/path/to/Foo.excalidraw.md" | null,
 *         severity: "ok" | "warning" | "critical",
 *         message: "...",
 *         lightSvg: "...path..." | null,
 *         darkSvg: "...path..." | null,
 *       }],
 *     }],
 *     summary: { critical: N, warning: N, ok: N },
 *   }
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import publishConfig from "../../publish.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUARTZ_ROOT = path.resolve(__dirname, "..", "..")
const VAULT_ROOT = path.resolve(
  QUARTZ_ROOT,
  process.env.QUARTZ_VAULT_ROOT || publishConfig.vaultRoot || "..",
)

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// Index every `.excalidraw.md` file in the vault by both bare stem and full
// basename so wikilink targets like `![[Foo.excalidraw]]` and
// `![[Excalidraw/Foo.excalidraw.md]]` both resolve.
let excalidrawIndex = null
async function buildIndex() {
  if (excalidrawIndex) return excalidrawIndex
  const byKey = new Map()
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules") continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(abs)
      } else if (e.isFile() && e.name.endsWith(".excalidraw.md")) {
        const base = e.name // "Foo.excalidraw.md"
        const stem = base.replace(/\.md$/, "") // "Foo.excalidraw"
        const bareStem = stem.replace(/\.excalidraw$/, "") // "Foo"
        for (const k of [base, stem, bareStem]) {
          if (!byKey.has(k)) byKey.set(k, [])
          byKey.get(k).push(abs)
        }
      }
    }
  }
  await walk(VAULT_ROOT)
  excalidrawIndex = byKey
  return byKey
}

function resolveTarget(target, index, fromAbs) {
  // Try several normalized lookups so we handle the common embed forms.
  const lookups = [
    target,
    target.replace(/\.svg$/, ""),
    target.replace(/\.svg$/, "") + ".md",
    target + ".md",
    path.posix.basename(target),
    path.posix.basename(target).replace(/\.svg$/, ""),
  ]
  for (const k of lookups) {
    const hits = index.get(k)
    if (hits && hits.length >= 1) {
      if (hits.length === 1) return hits[0]
      // Multi-match: prefer the one closest in the directory tree to the
      // embedding note.
      const fromDir = path.dirname(fromAbs)
      const sorted = [...hits].sort(
        (a, b) =>
          path.relative(fromDir, a).split(path.sep).length -
          path.relative(fromDir, b).split(path.sep).length,
      )
      return sorted[0]
    }
  }
  return null
}

async function checkSidecars(sourceAbs) {
  const dir = path.dirname(sourceAbs)
  const stem = path.basename(sourceAbs).replace(/\.md$/, "") // Foo.excalidraw
  const lightSvg = path.join(dir, `${stem}.light.svg`)
  const darkSvg = path.join(dir, `${stem}.dark.svg`)
  const legacySvg = path.join(dir, `${stem}.svg`)
  const lightExists = await exists(lightSvg)
  const darkExists = await exists(darkSvg)
  const legacyExists = await exists(legacySvg)

  if (lightExists && darkExists) {
    return {
      severity: "ok",
      message: "dark/light pair present",
      lightSvg,
      darkSvg,
    }
  }
  if (lightExists || darkExists) {
    return {
      severity: "warning",
      message: `only ${lightExists ? "light" : "dark"} variant exported; pair fallback will duplicate it into both slots`,
      lightSvg: lightExists ? lightSvg : null,
      darkSvg: darkExists ? darkSvg : null,
    }
  }
  if (legacyExists) {
    return {
      severity: "warning",
      message: "only legacy single-theme .svg present (no dark/light pair)",
      lightSvg: null,
      darkSvg: null,
    }
  }
  return {
    severity: "critical",
    message:
      "no Excalidraw sidecars exist at all. In Obsidian → Cmd-P → 'Excalidraw: Re-export SVG/PNG for every Excalidraw file'.",
    lightSvg: null,
    darkSvg: null,
  }
}

// Match every `![[...]]` embed, capturing the target (before any |alias or #header).
const EMBED_RE = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

function isExcalidrawTarget(target) {
  return (
    /\.excalidraw(\.md|\.svg)?$/i.test(target) ||
    /(^|\/)Excalidraw\//i.test(target)
  )
}

async function processNote(notePath) {
  const abs = path.isAbsolute(notePath)
    ? notePath
    : path.join(VAULT_ROOT, notePath)
  const raw = await fs.readFile(abs, "utf8")
  const index = await buildIndex()

  const embeds = []
  const seen = new Set()
  let m
  while ((m = EMBED_RE.exec(raw)) !== null) {
    const target = m[1].trim()
    if (!isExcalidrawTarget(target)) continue
    if (seen.has(target)) continue
    seen.add(target)

    const resolved = resolveTarget(target, index, abs)
    if (!resolved) {
      embeds.push({
        target,
        resolved: null,
        severity: "critical",
        message: `embed '${target}' could not be resolved to any .excalidraw.md in the vault`,
        lightSvg: null,
        darkSvg: null,
      })
      continue
    }
    const sidecar = await checkSidecars(resolved)
    embeds.push({ target, resolved, ...sidecar })
  }

  return { note: path.relative(VAULT_ROOT, abs).split(path.sep).join("/"), embeds }
}

async function readStdin() {
  if (process.stdin.isTTY) return []
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks)
    .toString("utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main() {
  const argPaths = process.argv.slice(2)
  const stdinPaths = await readStdin()
  const notes = [...argPaths, ...stdinPaths]
  if (notes.length === 0) {
    process.stderr.write(
      "usage: validate-excalidraw.mjs <vault-relative-or-absolute path>... (or pipe paths via stdin)\n",
    )
    process.exit(2)
  }

  const results = []
  for (const n of notes) {
    try {
      results.push(await processNote(n))
    } catch (e) {
      results.push({
        note: n,
        embeds: [
          {
            target: null,
            resolved: null,
            severity: "critical",
            message: `failed to process: ${e.message}`,
            lightSvg: null,
            darkSvg: null,
          },
        ],
      })
    }
  }

  const summary = { critical: 0, warning: 0, ok: 0 }
  for (const r of results)
    for (const e of r.embeds) summary[e.severity] = (summary[e.severity] || 0) + 1

  process.stdout.write(JSON.stringify({ results, summary }, null, 2) + "\n")
}

main().catch((e) => {
  process.stderr.write(`validate-excalidraw failed: ${e.stack || e.message}\n`)
  process.exit(1)
})
