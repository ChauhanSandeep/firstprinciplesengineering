#!/usr/bin/env node
/**
 * scripts/publish/validate-wikilinks.mjs
 *
 * For each vault note path passed as an argument (or one per line via stdin),
 * find every `[[Target]]` wikilink (excluding `![[...]]` embeds) and resolve
 * it against:
 *   1. Other to-publish notes in this batch (passed via --batch <path>)
 *   2. Already-published notes in content/
 *   3. URL frontmatter aliases
 *
 * Severity:
 *   ok       → resolves
 *   warning  → unresolved (will render as plain text)
 *   critical → links into a vault note that is in the batch but failing
 *              validation upstream (rare; we just mark it warning here)
 *
 * Output (JSON):
 *   {
 *     results: [{ note, links: [{ target, severity, message, resolvedTo }] }],
 *     summary: { ok: N, warning: N, critical: N },
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
const CONTENT_DIR = path.join(QUARTZ_ROOT, "content")

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
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

// Build a map: basename (with and without .md) and stem → list of abs paths.
async function buildIndex(root, filter = (n) => n.endsWith(".md")) {
  const byKey = new Map()
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === ".obsidian")
        continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(abs)
      } else if (e.isFile() && filter(e.name)) {
        const base = e.name
        const stem = base.replace(/\.md$/, "")
        for (const k of [base, stem]) {
          if (!byKey.has(k)) byKey.set(k, [])
          byKey.get(k).push(abs)
        }
      }
    }
  }
  await walk(root)
  return byKey
}

function resolveAgainst(target, index, fromAbs) {
  const lookups = [target, target + ".md", path.posix.basename(target)]
  for (const k of lookups) {
    const hits = index.get(k)
    if (!hits || hits.length === 0) continue
    if (hits.length === 1) return hits[0]
    const fromDir = path.dirname(fromAbs)
    const sorted = [...hits].sort(
      (a, b) =>
        path.relative(fromDir, a).split(path.sep).length -
        path.relative(fromDir, b).split(path.sep).length,
    )
    return sorted[0]
  }
  return null
}

// Wikilink that is NOT an embed (no leading `!`).
const WIKILINK_RE = /(?<!\!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

function isExcalidrawTarget(target) {
  return /\.excalidraw(\.md|\.svg)?$/i.test(target) || /(^|\/)Excalidraw\//i.test(target)
}

async function loadBatch(batchPath) {
  // Batch file format: one vault-relative path per line. These are the notes
  // being published in this run. Links into them count as resolved.
  if (!batchPath) return new Set()
  if (!(await exists(batchPath))) return new Set()
  const raw = await fs.readFile(batchPath, "utf8")
  return new Set(
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

async function processNote(notePath, vaultIndex, contentIndex, batchSet) {
  const abs = path.isAbsolute(notePath)
    ? notePath
    : path.join(VAULT_ROOT, notePath)
  const raw = await fs.readFile(abs, "utf8")

  const links = []
  const seen = new Set()
  let m
  while ((m = WIKILINK_RE.exec(raw)) !== null) {
    const target = m[1].trim()
    if (seen.has(target)) continue
    seen.add(target)
    if (isExcalidrawTarget(target)) continue // handled by validate-excalidraw

    // (1) Resolve against vault notes
    const vaultHit = resolveAgainst(target, vaultIndex, abs)
    if (vaultHit) {
      const vaultRel = path
        .relative(VAULT_ROOT, vaultHit)
        .split(path.sep)
        .join("/")
      const inBatch = batchSet.has(vaultRel)
      // (2) Check whether this target is already-published
      const contentHit = resolveAgainst(target, contentIndex, abs)
      const isPublished = !!contentHit
      if (inBatch || isPublished) {
        links.push({
          target,
          severity: "ok",
          message: inBatch ? "in this batch" : "already published",
          resolvedTo: vaultRel,
        })
      } else {
        links.push({
          target,
          severity: "warning",
          message:
            "resolves to a vault note that is neither in this batch nor already published; will render as plain text",
          resolvedTo: vaultRel,
        })
      }
    } else {
      // (3) Maybe it's a published-only note (rare). Check content index.
      const contentHit = resolveAgainst(target, contentIndex, abs)
      if (contentHit) {
        links.push({
          target,
          severity: "ok",
          message: "resolves to already-published note",
          resolvedTo: path
            .relative(CONTENT_DIR, contentHit)
            .split(path.sep)
            .join("/"),
        })
      } else {
        links.push({
          target,
          severity: "warning",
          message: "unresolved wikilink (will render as plain text)",
          resolvedTo: null,
        })
      }
    }
  }

  return { note: path.relative(VAULT_ROOT, abs).split(path.sep).join("/"), links }
}

function getFlag(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null
}

async function main() {
  const batchPath = getFlag("--batch")
  const positional = process.argv
    .slice(2)
    .filter((a, i, arr) => a !== "--batch" && (i === 0 || arr[i - 1] !== "--batch"))
  const stdinPaths = await readStdin()
  const notes = [...positional, ...stdinPaths]
  if (notes.length === 0) {
    process.stderr.write(
      "usage: validate-wikilinks.mjs [--batch <batch.txt>] <path>... (or pipe via stdin)\n",
    )
    process.exit(2)
  }

  const [vaultIndex, contentIndex, batchSet] = await Promise.all([
    buildIndex(VAULT_ROOT),
    buildIndex(CONTENT_DIR),
    loadBatch(batchPath),
  ])

  const results = []
  for (const n of notes) {
    try {
      results.push(await processNote(n, vaultIndex, contentIndex, batchSet))
    } catch (e) {
      results.push({
        note: n,
        links: [
          {
            target: null,
            severity: "critical",
            message: `failed to process: ${e.message}`,
            resolvedTo: null,
          },
        ],
      })
    }
  }

  const summary = { ok: 0, warning: 0, critical: 0 }
  for (const r of results)
    for (const l of r.links) summary[l.severity] = (summary[l.severity] || 0) + 1

  process.stdout.write(JSON.stringify({ results, summary }, null, 2) + "\n")
}

main().catch((e) => {
  process.stderr.write(`validate-wikilinks failed: ${e.stack || e.message}\n`)
  process.exit(1)
})
