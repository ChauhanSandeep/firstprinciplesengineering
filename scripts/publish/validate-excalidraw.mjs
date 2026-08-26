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
 *   warning   → only one variant exists (the pair upgrade in
 *               fix-excalidraw-paths.mjs falls back to duplicating the
 *               present one into both slots; theme parity is lost on that
 *               diagram but the page still renders), OR both variants share
 *               the same background orientation (light/dark themes would look
 *               identical), OR a variant's own text is illegible against its
 *               own background (contrast < ~2:1)
 *   ok        → both sidecars present, backgrounds opposite, text legible
 *
 * Note on theme routing: the build assigns each variant to the site's light or
 * dark theme by the SVG's BACKGROUND COLOR, not its filename — the vault's
 * `.light.svg`/`.dark.svg` names are sometimes reversed. A reversed-but-
 * otherwise-healthy pair is therefore NOT flagged here (routing self-corrects);
 * only genuinely broken pairs (same orientation / illegible) are warned.
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

// ---- Theme/contrast analysis --------------------------------------------
// The build routes each Excalidraw pair to the site's light/dark theme by the
// SVG's BACKGROUND COLOR, not its filename (vault names are sometimes
// reversed). So the pairing is only healthy when the two sidecars have
// OPPOSITE background orientations (one light, one dark) and each variant's
// own text is legible against its own background. These checks surface the
// "wrong diagram / invisible text" class before it ships.
function hexLuminance(hex) {
  let h = hex.replace("#", "")
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(hexA, hexB) {
  const a = hexLuminance(hexA)
  const b = hexLuminance(hexB)
  const [hi, lo] = a >= b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

// Extract the full-canvas background fill (raw and SVGO-optimized forms, with
// decimal sizes), falling back to the first fill in the document.
function backgroundHex(svg) {
  let m =
    svg.match(/fill="(#[0-9a-fA-F]{3,6})"\s+d="M0 0[hH][\d.]+[vV][\d.]+[Hh]0z"/i) ||
    svg.match(/d="M0 0[hH][\d.]+[vV][\d.]+[Hh]0z"\s+fill="(#[0-9a-fA-F]{3,6})"/i)
  if (m) return m[1]
  const rectRe = /<rect\b[^>]*>/g
  let rm
  while ((rm = rectRe.exec(svg))) {
    const t = rm[0]
    if (/\bx="0"/.test(t) && /\by="0"/.test(t) && /\bwidth="\d/.test(t)) {
      const f = t.match(/\bfill="(#[0-9a-fA-F]{3,6})"/)
      if (f) return f[1]
    }
  }
  m = svg.match(/fill="(#[0-9a-fA-F]{3,6})"/)
  return m ? m[1] : null
}

// Most frequently used <text fill="#…"> color (the dominant body-text color).
function dominantTextHex(svg) {
  const counts = new Map()
  const re = /<text\b[^>]*\bfill="(#[0-9a-fA-F]{3,6})"/gi
  let m
  while ((m = re.exec(svg))) {
    const c = m[1].toLowerCase()
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  let best = null
  let bestN = 0
  for (const [c, n] of counts) if (n > bestN) ((best = c), (bestN = n))
  return best
}

async function analyzeSvg(svgPath) {
  try {
    const svg = await fs.readFile(svgPath, "utf8")
    const bg = backgroundHex(svg)
    const text = dominantTextHex(svg)
    return {
      bg,
      bgLight: bg ? hexLuminance(bg) > 0.4 : null,
      text,
      contrast: bg && text ? contrastRatio(bg, text) : null,
    }
  } catch {
    return { bg: null, bgLight: null, text: null, contrast: null }
  }
}

// Given the light/dark sidecar analyses, return any non-critical theme
// warnings. Two failure modes are detected:
//   1. Both variants share the same background orientation → the light/dark
//      themes render identically (routing can't distinguish them).
//   2. The pair is a "hybrid": both variants use the SAME dominant text color
//      (i.e. only the background was recolored, the foreground was never
//      re-themed) AND the light-background variant's text is illegible against
//      its own light background. This is the case content-based routing CANNOT
//      fix, because the file routed to light mode has light text on light
//      paper. Requiring the shared-text signal avoids false-positiving on
//      healthy pairs and legitimate white-on-dark-box flowcharts (whose light
//      variant correctly uses dark text). Returns [] when healthy.
function themeWarnings(light, dark) {
  const out = []
  if (light.bgLight !== null && dark.bgLight !== null) {
    if (light.bgLight === dark.bgLight) {
      out.push(
        `both variants have a ${light.bgLight ? "light" : "dark"} background; ` +
          `the light/dark themes will look identical (re-export the pair)`,
      )
      return out
    }
    // Opposite orientations (healthy naming or reversed-but-routable). Check
    // the variant that will be shown in the site's LIGHT theme.
    const lightVariant = light.bgLight ? light : dark
    const sameText = light.text && dark.text && light.text === dark.text
    if (sameText && lightVariant.contrast !== null && lightVariant.contrast < 2.0) {
      out.push(
        `hybrid export — the light-theme diagram has near-invisible text ` +
          `(contrast ${lightVariant.contrast.toFixed(1)}:1); its foreground ` +
          `was not re-themed for light mode. Re-export this diagram in Obsidian.`,
      )
    }
  }
  return out
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
    const [lightA, darkA] = await Promise.all([analyzeSvg(lightSvg), analyzeSvg(darkSvg)])
    const warnings = themeWarnings(lightA, darkA)
    if (warnings.length > 0) {
      return {
        severity: "warning",
        message: `dark/light pair present but: ${warnings.join("; ")}`,
        lightSvg,
        darkSvg,
      }
    }
    return {
      severity: "ok",
      message: "dark/light pair present (backgrounds opposite, text legible)",
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
  return /\.excalidraw(\.md|\.svg)?$/i.test(target) || /(^|\/)Excalidraw\//i.test(target)
}

async function processNote(notePath) {
  const abs = path.isAbsolute(notePath) ? notePath : path.join(VAULT_ROOT, notePath)
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
