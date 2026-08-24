#!/usr/bin/env node
/**
 * scripts/build/fix-excalidraw-light-contrast.mjs
 *
 * Contrast safety-net for mis-exported Excalidraw light diagrams.
 *
 * Some `*.excalidraw.light.svg` exports from the vault are not genuine
 * light-theme renders: only the page background was switched to light
 * (`#dcdfe5`) while the element/text colors kept the GitHub-DARK neutral
 * foreground palette. The result is near-invisible message text and arrows
 * — e.g. light-gray `#c9d1d9` text (contrast ~1.1:1) directly on the light
 * background. Box labels stay readable only because they are white text on
 * dark-colored boxes.
 *
 * This pass rewrites just the dark-theme NEUTRAL foreground colors
 * (`#c9d1d9`, `#e6edf3`, `#8b949e`) to dark ink when a file is detected as
 * one of these hybrid exports. It deliberately does NOT touch:
 *   - `#fff` (white box labels sitting on dark boxes),
 *   - accent colors (green/blue/red/purple/orange), or
 *   - already-dark neutrals like `#30363d`.
 *
 * Detection (must satisfy ALL to be rewritten):
 *   1. filename ends with `.light.svg`
 *   2. the full-canvas background rect is the light paper `#dcdfe5`
 *   3. the file contains near-white NEUTRAL *text* (`fill="#c9d1d9"` or
 *      `fill="#e6edf3"`) — a genuine light theme would never do this.
 *
 * Idempotent: after rewriting, the trigger colors are gone, so a re-run is a
 * no-op. Runs before `optimize-svgs` so SVGO re-minifies the result.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

// Light paper background used by the site's Excalidraw light exports.
const LIGHT_BG = "#dcdfe5"

// Dark-theme neutral foreground colors that vanish on the light background,
// mapped to light-theme equivalents. Text (fill) goes to a strong ink; lines
// (stroke) go to a slightly softer mid-dark so arrows/lifelines don't read as
// heavy black bars. Values mirror the tones used by correctly-exported light
// diagrams (ink ~#1d2328, muted ~#4d555d, lines ~#454d57).
const REMAP = {
  fill: {
    "#c9d1d9": "#1d2328", // bright neutral text -> ink
    "#e6edf3": "#1d2328", // bright neutral text -> ink
    "#8b949e": "#4d555d", // muted neutral text -> darker muted
  },
  stroke: {
    "#c9d1d9": "#454d57", // neutral lines/arrows -> mid-dark
    "#e6edf3": "#454d57",
    "#8b949e": "#6b7480", // muted lines -> mid gray
  },
}

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(abs)))
    else if (e.isFile() && /\.excalidraw[^/]*\.light\.svg$/i.test(e.name)) out.push(abs)
  }
  return out
}

function isHybridDarkOnLight(svg) {
  // Full-canvas light background rect, e.g. fill="#dcdfe5" d="M0 0h780v1145H0z"
  const hasLightBg = new RegExp(`fill="${LIGHT_BG}"\\s+d="M0 0h\\d+v\\d+H0z"`, "i").test(svg)
  if (!hasLightBg) return false
  // Near-white neutral TEXT is the tell-tale of a dark palette on light paper.
  return /<text[^>]*\bfill="(#c9d1d9|#e6edf3)"/i.test(svg)
}

function remapColors(svg) {
  let out = svg
  let count = 0
  for (const [attr, table] of Object.entries(REMAP)) {
    for (const [from, to] of Object.entries(table)) {
      const re = new RegExp(`(\\b${attr}=")${from}(")`, "gi")
      out = out.replace(re, (_m, pre, post) => {
        count++
        return `${pre}${to}${post}`
      })
    }
  }
  return { out, count }
}

async function main() {
  const files = await walk(PUBLIC_DIR)
  let scanned = 0
  let rewritten = 0
  let replacements = 0

  for (const abs of files) {
    scanned++
    const svg = await fs.readFile(abs, "utf8")
    if (!isHybridDarkOnLight(svg)) continue
    const { out, count } = remapColors(svg)
    if (count > 0 && out !== svg) {
      await fs.writeFile(abs, out, "utf8")
      rewritten++
      replacements += count
    }
  }

  console.log(
    `fix-excalidraw-light-contrast: scanned ${scanned} light SVG(s); ` +
      `fixed ${rewritten} hybrid dark-on-light export(s), ` +
      `${replacements} color replacement(s).`,
  )
}

main().catch((e) => {
  console.error("fix-excalidraw-light-contrast failed:", e)
  process.exit(1)
})
