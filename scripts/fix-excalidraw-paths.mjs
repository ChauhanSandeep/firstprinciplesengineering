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

const IMG_SRC_RE = /<img([^>]*?)\bsrc="([^"]*excalidraw\/[^"]+\.excalidraw\.svg)"([^>]*)>/g

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
let missingTargets = 0

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
      return match
    }
    const newSrc = fixSrc(html, src)
    if (newSrc === src) return match
    rewrites++
    return `<img${pre}src="${newSrc}"${post}>`
  })
  if (rewrites > 0) {
    await fs.writeFile(html, next, "utf8")
    totalFiles++
    totalRewrites += rewrites
  }
}

console.log(
  `fix-excalidraw-paths: rewrote ${totalRewrites} <img src> in ${totalFiles} HTML files` +
    (missingTargets > 0 ? ` (skipped ${missingTargets} missing targets)` : ""),
)
