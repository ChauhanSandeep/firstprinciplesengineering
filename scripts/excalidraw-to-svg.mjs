/**
 * excalidraw-to-svg.mjs
 *
 * Convert Obsidian Excalidraw plugin files (`*.excalidraw.md`) to SVG.
 *
 * Obsidian's Excalidraw plugin stores scenes inside a markdown file. The scene
 * JSON lives in one of two code-block forms after a `## Drawing` heading:
 *
 *   ```compressed-json     ← lz-string base64-compressed JSON (default)
 *   …
 *   ```
 *
 *   ```json                ← uncompressed (older / "compress: false" setting)
 *   …
 *   ```
 *
 * We decompress as needed, then hand the JSON to `excalidraw-to-svg`, which
 * renders headlessly via jsdom + node-canvas. The result is written next to
 * the source file (e.g. `Foo.excalidraw.md` → `Foo.excalidraw.svg`) and the
 * absolute path returned.
 *
 * Results are cached by content hash so unchanged files are skipped.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import crypto from "node:crypto"
import lzstring from "lz-string"
import excalidrawToSvg from "excalidraw-to-svg"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CACHE_DIR = path.resolve(__dirname, "..", ".excalidraw-cache")

// jsdom logs non-fatal "Width and height must be set on the svg element" /
// "HTMLCanvasElement.getContext not implemented" errors for some embeds.
// Suppress them so the build log stays readable; real failures still throw.
const origErr = console.error
function silenceJsdomNoise(fn) {
  console.error = (...args) => {
    const s = args.map((a) => (typeof a === "string" ? a : "")).join(" ")
    if (
      s.includes("Width and height must be set on the svg element") ||
      s.includes("HTMLCanvasElement.prototype.getContext") ||
      s.includes("Cannot use 'in' operator to search for 'filter' in null")
    ) {
      return
    }
    origErr(...args)
  }
  return fn().finally(() => {
    console.error = origErr
  })
}

function extractScene(content, sourceLabel) {
  const compressed = content.match(/```compressed-json\n([\s\S]*?)\n```/)
  if (compressed) {
    const base64 = compressed[1].replace(/\s+/g, "")
    const jsonStr = lzstring.decompressFromBase64(base64)
    if (!jsonStr) {
      throw new Error(
        `lz-string decompression returned null for ${sourceLabel}. ` +
          `File may be corrupted or use an unsupported compression variant.`,
      )
    }
    return JSON.parse(jsonStr)
  }
  const plain = content.match(/```json\n([\s\S]*?)\n```/)
  if (plain) return JSON.parse(plain[1])
  throw new Error(
    `${sourceLabel}: no \`\`\`compressed-json\`\`\` or \`\`\`json\`\`\` block under ## Drawing.`,
  )
}

function hashContent(s) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12)
}

/**
 * Generate (or reuse cached) SVG for an Obsidian Excalidraw markdown file.
 *
 * @param {string} excalidrawMdAbs - absolute path to a `*.excalidraw.md` file
 * @returns {Promise<string>} absolute path to the generated `.excalidraw.svg`
 */
export async function ensureSvg(excalidrawMdAbs) {
  if (!excalidrawMdAbs.endsWith(".excalidraw.md")) {
    throw new Error(
      `ensureSvg expects a *.excalidraw.md path, got: ${excalidrawMdAbs}`,
    )
  }
  const dir = path.dirname(excalidrawMdAbs)
  const base = path.basename(excalidrawMdAbs, ".md")
  const outAbs = path.join(dir, `${base}.svg`)
  // Cache markers live inside quartz/.excalidraw-cache/, keyed by an absolute-
  // path hash, so they don't pollute the vault with hidden sidecar files.
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const cacheKey = crypto
    .createHash("sha1")
    .update(excalidrawMdAbs)
    .digest("hex")
  const cacheMarker = path.join(CACHE_DIR, `${cacheKey}.hash`)

  const md = await fs.readFile(excalidrawMdAbs, "utf8")
  const hash = hashContent(md)

  try {
    const [existingSvg, existingHash] = await Promise.all([
      fs.access(outAbs).then(() => true),
      fs.readFile(cacheMarker, "utf8").catch(() => null),
    ])
    if (existingSvg && existingHash === hash) {
      return outAbs
    }
  } catch {
    /* fall through */
  }

  const scene = extractScene(md, path.basename(excalidrawMdAbs))
  if (!scene || !Array.isArray(scene.elements) || scene.elements.length === 0) {
    throw new Error(
      `${path.basename(excalidrawMdAbs)}: scene has no elements; nothing to render.`,
    )
  }

  const svgNode = await silenceJsdomNoise(() => excalidrawToSvg(scene))
  const svgString = svgNode.outerHTML
  if (!svgString || !svgString.startsWith("<svg")) {
    throw new Error(
      `${path.basename(excalidrawMdAbs)}: excalidraw-to-svg returned an unexpected result.`,
    )
  }

  await fs.writeFile(outAbs, svgString, "utf8")
  await fs.writeFile(cacheMarker, hash, "utf8")
  return outAbs
}
