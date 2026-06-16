#!/usr/bin/env node
/**
 * scripts/build/inject-status-badges.mjs
 *
 * Phase 11 — Surface "New" and "Updated" badges near each article's
 * H1 based on real vault git history.
 *
 * Why git history (not content/ mtimes): the `content/` tree is
 * regenerated on every `npm run sync`, so file mtimes there are all
 * "now". The vault repo at ~/Idea/ObisdianNotes has the real
 * authoring + edit history per source file.
 *
 * Rules (configurable below):
 *   - `created < 30 days ago`  → "New"
 *   - else `modified < 14 days && created >= 30 days` → "Updated"
 *   - frontmatter `status:` in the vault note overrides the rule.
 *     Values: "new", "updated", "evergreen". "evergreen" suppresses
 *     any badge regardless of dates.
 *
 * Idempotent via `class="fpe-status-badge"`. Skips index pages,
 * /tags, /03-roadmaps landings, /about, /404.
 *
 * Emits sidecar `public/static/statusIndex.json` so the 404 page
 * (and a future explorer overlay) can show "new/updated" markers
 * without re-shelling out to git on every page render.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import matter from "gray-matter"

const execFileP = promisify(execFile)

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const CONTENT_INDEX = path.join(PUBLIC_DIR, "static", "contentIndex.json")
const STATUS_INDEX_OUT = path.join(PUBLIC_DIR, "static", "statusIndex.json")
const VAULT_ROOT_DEFAULT = "/Users/sandeep/Idea/ObisdianNotes"
const VAULT_ROOT = process.env.VAULT_ROOT || VAULT_ROOT_DEFAULT

const MARKER_CLASS = "fpe-status-badge"
const NEW_WINDOW_DAYS = 30
const UPDATED_WINDOW_DAYS = 14

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/,
  /^tags(\/|$)/,
  /^03-roadmaps$/,
]

const H1_RE = /(<h1\b[^>]*class="article-title"[^>]*>)([\s\S]*?)(<\/h1>)/i

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function daysSince(iso) {
  if (!iso) return Infinity
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return Infinity
  return (Date.now() - then) / (1000 * 60 * 60 * 24)
}

async function vaultDates(relInVault) {
  try {
    const created = (
      await execFileP(
        "git",
        [
          "-C",
          VAULT_ROOT,
          "log",
          "--diff-filter=A",
          "--follow",
          "--format=%aI",
          "-1",
          "--",
          relInVault,
        ],
        { maxBuffer: 1024 * 1024 },
      )
    ).stdout.trim()
    const modified = (
      await execFileP(
        "git",
        [
          "-C",
          VAULT_ROOT,
          "log",
          "--format=%aI",
          "-1",
          "--",
          relInVault,
        ],
        { maxBuffer: 1024 * 1024 },
      )
    ).stdout.trim()
    return { created: created || null, modified: modified || created || null }
  } catch {
    return { created: null, modified: null }
  }
}

async function vaultFrontmatterStatus(relInVault) {
  try {
    const abs = path.join(VAULT_ROOT, relInVault)
    const raw = await fs.readFile(abs, "utf8")
    const { data } = matter(raw)
    return data && data.status ? String(data.status).toLowerCase() : null
  } catch {
    return null
  }
}

function decideStatus(override, created, modified) {
  if (override === "evergreen") return null
  if (override === "new") return "new"
  if (override === "updated") return "updated"
  const cAge = daysSince(created)
  const mAge = daysSince(modified)
  if (cAge < NEW_WINDOW_DAYS) return "new"
  if (mAge < UPDATED_WINDOW_DAYS && cAge >= NEW_WINDOW_DAYS) return "updated"
  return null
}

function renderBadge(kind) {
  const label = kind === "new" ? "New" : "Updated"
  const title =
    kind === "new"
      ? `Created within the last ${NEW_WINDOW_DAYS} days`
      : `Updated within the last ${UPDATED_WINDOW_DAYS} days`
  const icon =
    kind === "new"
      ? // sparkle
        `<svg class="${MARKER_CLASS}-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>`
      : // refresh-clock
        `<svg class="${MARKER_CLASS}-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>`
  return `<div class="${MARKER_CLASS}-wrap"><span class="${MARKER_CLASS} ${MARKER_CLASS}--${escapeHtml(kind)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${icon}<span class="${MARKER_CLASS}-label">${escapeHtml(label)}</span></span></div>`
}

async function loadContentIndex() {
  try {
    const raw = await fs.readFile(CONTENT_INDEX, "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function walkHtml(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkHtml(abs)))
    else if (e.isFile() && e.name.endsWith(".html")) out.push(abs)
  }
  return out
}

function slugFromHtml(abs) {
  const rel = path.relative(PUBLIC_DIR, abs)
  return rel.replace(/\.html$/, "").split(path.sep).join("/").toLowerCase()
}

async function main() {
  const contentIndex = await loadContentIndex()
  const pages = await walkHtml(PUBLIC_DIR)

  const statusIndex = {} // slug → { status, created, modified }
  let injected = 0
  let skipped = 0

  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    if (SKIP_SLUG_RE.some((re) => re.test(slug))) {
      skipped++
      continue
    }
    const entry = contentIndex[slug]
    if (!entry || !entry.filePath) {
      skipped++
      continue
    }

    const { created, modified } = await vaultDates(entry.filePath)
    const override = await vaultFrontmatterStatus(entry.filePath)
    const status = decideStatus(override, created, modified)

    if (status) {
      statusIndex[slug] = { status, created, modified }
      const html = await fs.readFile(abs, "utf8")
      if (html.includes(`class="${MARKER_CLASS}`)) {
        // Already injected; preserve previous render.
        skipped++
        continue
      }
      if (!H1_RE.test(html)) {
        skipped++
        continue
      }
      // Place the badge as a sibling AFTER the </h1>, so it sits on
      // its own line below the title rather than competing with it.
      const next = html.replace(
        H1_RE,
        (_m, open, inner, close) => `${open}${inner}${close}${renderBadge(status)}`,
      )
      if (next === html) {
        skipped++
        continue
      }
      await fs.writeFile(abs, next, "utf8")
      injected++
    } else {
      if (created || modified) {
        statusIndex[slug] = { status: null, created, modified }
      }
      skipped++
    }
  }

  await fs.mkdir(path.dirname(STATUS_INDEX_OUT), { recursive: true })
  await fs.writeFile(
    STATUS_INDEX_OUT,
    JSON.stringify(statusIndex, null, 0),
    "utf8",
  )

  const newCount = Object.values(statusIndex).filter((s) => s.status === "new").length
  const updCount = Object.values(statusIndex).filter((s) => s.status === "updated").length
  console.log(
    `inject-status-badges: injected ${injected} badge(s) ` +
      `(new: ${newCount}, updated: ${updCount}); skipped ${skipped}; ` +
      `wrote ${Object.keys(statusIndex).length} entries to ${path.relative(SITE_ROOT, STATUS_INDEX_OUT)}.`,
  )
}

main().catch((e) => {
  console.error("inject-status-badges failed:", e)
  process.exit(1)
})
