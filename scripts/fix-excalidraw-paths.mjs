#!/usr/bin/env node
// Post-build pass: walk public/**/*.html and rewrite any <img src> that
// points at an .excalidraw.svg with an over-resolved relative path.
//
// Quartz emits 5 `../` segments for excalidraw images (e.g.
//   ../../.././../../excalidraw/foo.excalidraw.svg
// ) which resolves ABOVE the GitHub Pages project root and 404s.
// We compute the correct file-mode relative path from the HTML file to
// public/excalidraw/<file> and substitute it.

import { promises as fs, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUARTZ_ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(QUARTZ_ROOT, "public")
const EXCALIDRAW_DIR = path.join(PUBLIC_DIR, "excalidraw")

// Match any <img> whose src points at the public/excalidraw/ folder and ends
// with one of the three Excalidraw export variants the pipeline produces:
//   - *.excalidraw.svg        (legacy single-theme export)
//   - *.excalidraw.light.svg  (light-theme companion of the dark/light pair)
//   - *.excalidraw.dark.svg   (defensive: in case sync ever emits dark first)
const IMG_SRC_RE =
  /<img([^>]*?)\bsrc="([^"]*excalidraw\/[^"]+\.excalidraw(?:\.dark|\.light)?\.svg)"([^>]*)>/g

async function walk(dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full)
  }
  return out
}

function fixSrc(htmlAbs, src) {
  // Extract just the file name (last path component)
  const fname = path.posix.basename(src)
  const targetAbs = path.join(EXCALIDRAW_DIR, fname)
  const htmlDir = path.dirname(htmlAbs)
  const rel = path.relative(htmlDir, targetAbs).split(path.sep).join("/")
  return rel.startsWith(".") ? rel : "./" + rel
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

let totalFiles = 0
let totalRewrites = 0
let totalWidthApplied = 0
let totalPairsUpgraded = 0
let missingTargets = 0

// Convert `alt="<digits>"` (Obsidian's `![<size>](…)` syntax) into an explicit
// `width="<digits>"` attribute so the browser renders the diagram at that
// size, capped responsively by CSS `max-width: 100%`. Skip if a width
// attribute is already present.
const ALT_DIGIT_RE = /\balt="(\d+)"/
const WIDTH_RE = /\bwidth=/

function applyAltAsWidth(tag) {
  if (WIDTH_RE.test(tag)) return tag
  const m = tag.match(ALT_DIGIT_RE)
  if (!m) return tag
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n <= 0) return tag
  totalWidthApplied++
  // Insert width attribute right after the opening `<img`
  return tag.replace(/<img\b/, `<img width="${n}"`)
}

// Merge a class name into an <img> tag, preserving existing classes.
function addClass(tag, className) {
  const classRe = /\bclass="([^"]*)"/
  if (classRe.test(tag)) {
    return tag.replace(classRe, (_m, existing) => {
      const set = new Set(existing.split(/\s+/).filter(Boolean))
      set.add(className)
      return `class="${[...set].join(" ")}"`
    })
  }
  return tag.replace(/<img\b/, `<img class="${className}"`)
}

// Force-set an attribute on an <img> tag (replaces any existing value).
function setAttr(tag, name, value) {
  const re = new RegExp(`\\b${name}="[^"]*"`)
  if (re.test(tag)) {
    return tag.replace(re, `${name}="${value}"`)
  }
  return tag.replace(/<img\b/, `<img ${name}="${value}"`)
}

// Swap the src of an <img> tag to a new URL.
function setSrc(tag, newSrc) {
  return tag.replace(/\bsrc="[^"]*"/, `src="${newSrc}"`)
}

// Variant constants — keep in one place so we don't drift across helpers.
const LIGHT_SUFFIX = ".excalidraw.light.svg"
const DARK_SUFFIX = ".excalidraw.dark.svg"

// Given the basename of one side of the pair, return the basename of the
// companion. Returns null if the input isn't part of a pair.
function companionBasename(fname) {
  if (fname.endsWith(LIGHT_SUFFIX)) {
    return fname.slice(0, -LIGHT_SUFFIX.length) + DARK_SUFFIX
  }
  if (fname.endsWith(DARK_SUFFIX)) {
    return fname.slice(0, -DARK_SUFFIX.length) + LIGHT_SUFFIX
  }
  return null
}

const htmls = await walk(PUBLIC_DIR)
for (const html of htmls) {
  const orig = await fs.readFile(html, "utf8")
  let rewrites = 0
  const next = orig.replace(IMG_SRC_RE, (match, pre, src, post) => {
    const fname = path.posix.basename(src)
    const targetAbs = path.join(EXCALIDRAW_DIR, fname)
    // Sanity check the target file exists; if not, leave src alone
    if (!existsSync(targetAbs)) {
      missingTargets++
      return applyAltAsWidth(match)
    }
    const newSrc = fixSrc(html, src)
    let baseTag = newSrc === src ? match : `<img${pre}src="${newSrc}"${post}>`
    if (newSrc !== src) rewrites++
    baseTag = applyAltAsWidth(baseTag)

    // If this <img> is one side of a dark/light pair AND the companion is
    // also present in the built output, upgrade the single tag into a pair:
    // the visible <img> follows :root[saved-theme]. When the companion is
    // missing we fall back to duplicating the single export into both slots
    // (per user-chosen "duplicate, never fail" policy) so the diagram still
    // shows in both themes — just without theme-specific colors.
    const companion = companionBasename(fname)
    if (companion) {
      const companionAbs = path.join(EXCALIDRAW_DIR, companion)
      const isLight = fname.endsWith(LIGHT_SUFFIX)
      const lightFname = isLight ? fname : companion
      const darkFname = isLight ? companion : fname
      const lightExists = isLight ? true : existsSync(companionAbs)
      const darkExists = isLight ? existsSync(companionAbs) : true

      const lightFile = lightExists ? lightFname : darkFname
      const darkFile = darkExists ? darkFname : lightFname

      const lightRelSrc = fixSrc(html, path.posix.join(path.posix.dirname(src), lightFile))
      const darkRelSrc = fixSrc(html, path.posix.join(path.posix.dirname(src), darkFile))

      let lightTag = setSrc(baseTag, lightRelSrc)
      lightTag = addClass(lightTag, "excalidraw-light")

      let darkTag = setSrc(baseTag, darkRelSrc)
      darkTag = addClass(darkTag, "excalidraw-dark")
      // Hide the duplicate from assistive tech so screen readers don't
      // announce the same alt text twice.
      darkTag = setAttr(darkTag, "aria-hidden", "true")
      darkTag = setAttr(darkTag, "alt", "")

      totalPairsUpgraded++
      return lightTag + darkTag
    }

    return baseTag
  })
  if (next !== orig) {
    await fs.writeFile(html, next, "utf8")
    if (rewrites > 0) {
      totalFiles++
      totalRewrites += rewrites
    }
  }
}

console.log(
  `fix-excalidraw-paths: rewrote ${totalRewrites} <img src> in ${totalFiles} HTML files` +
    `, applied width="alt" on ${totalWidthApplied} images` +
    `, upgraded ${totalPairsUpgraded} to dark/light pair` +
    (missingTargets > 0 ? ` (skipped ${missingTargets} missing targets)` : ""),
)
