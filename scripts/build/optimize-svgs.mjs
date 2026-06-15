#!/usr/bin/env node
/**
 * scripts/build/optimize-svgs.mjs
 *
 * Phase 14 — Post-build SVG optimization. Walks `public/` looking
 * for `*.excalidraw*.svg` files and runs SVGO with a conservative
 * preset. Excalidraw SVGs embed a base64 web font (Virgil) and use
 * inline IDs that the rest of the page does not reference, so the
 * defaults work without breaking rendering.
 *
 * Idempotent: SVGO is roughly idempotent on its own output, and we
 * write back in place. Re-running is cheap and safe.
 *
 * Why post-build and not at sync time:
 *   - The synced SVGs are an intermediate artifact under `content/`;
 *     we want the optimized version in `public/` (what ships).
 *   - This step is the last in the build chain, so any future
 *     injector that adds inline SVG markup also benefits if we
 *     decide to broaden the glob.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { optimize } from "svgo"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

// Conservative SVGO config: keep viewBox (responsive sizing depends
// on it), keep IDs (anchors / aria-labelledby may reference them),
// don't merge paths (excalidraw uses many tiny strokes that are
// faster to render individually on dense maps).
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false,
          mergePaths: false,
        },
      },
    },
  ],
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
    else if (e.isFile() && /\.excalidraw[^/]*\.svg$/i.test(e.name))
      out.push(abs)
  }
  return out
}

async function main() {
  const files = await walk(PUBLIC_DIR)
  if (files.length === 0) {
    console.log("optimize-svgs: no excalidraw SVGs found; skipping.")
    return
  }
  let bytesBefore = 0
  let bytesAfter = 0
  let optimized = 0
  let unchanged = 0
  let errored = 0

  for (const abs of files) {
    const raw = await fs.readFile(abs, "utf8")
    bytesBefore += Buffer.byteLength(raw, "utf8")
    try {
      const r = optimize(raw, { path: abs, ...SVGO_CONFIG })
      const out = r.data
      const outBytes = Buffer.byteLength(out, "utf8")
      if (outBytes < raw.length) {
        await fs.writeFile(abs, out, "utf8")
        bytesAfter += outBytes
        optimized++
      } else {
        bytesAfter += raw.length
        unchanged++
      }
    } catch (e) {
      errored++
      bytesAfter += raw.length
      console.warn(
        `optimize-svgs: failed on ${path.relative(PUBLIC_DIR, abs)}: ${e.message}`,
      )
    }
  }
  const savedKb = ((bytesBefore - bytesAfter) / 1024).toFixed(1)
  const pct = bytesBefore
    ? (((bytesBefore - bytesAfter) / bytesBefore) * 100).toFixed(1)
    : "0.0"
  console.log(
    `optimize-svgs: processed ${files.length} file(s); optimized ${optimized}, unchanged ${unchanged}, errored ${errored}. ` +
      `Saved ${savedKb} KB (${pct}%).`,
  )
}

main().catch((e) => {
  console.error("optimize-svgs failed:", e)
  process.exit(1)
})
