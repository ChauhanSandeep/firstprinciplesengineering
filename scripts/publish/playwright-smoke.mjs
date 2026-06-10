#!/usr/bin/env node
/**
 * scripts/publish/playwright-smoke.mjs
 *
 * Phase 6 (local) and phase 7 verification (live) of the quartz-publish-notes
 * skill. Walks a list of slugs and runs assertions in light, dark, and
 * mobile viewports.
 *
 * Usage:
 *   node scripts/publish/playwright-smoke.mjs --local --slugs <slugs.txt>
 *   node scripts/publish/playwright-smoke.mjs --live  --slugs <slugs.txt>
 *
 * --local boots a `python3 -m http.server` on a free port serving `public/`.
 * --live  hits the deployed baseUrl from `quartz.config.yaml`.
 *
 * The slugs file is one slug per line, e.g.:
 *   /
 *   /01-fundamentals/05-ai-ml/04-rag-architecture
 *
 * Assertions per page:
 *   - HTTP 200 in all 3 viewports.
 *   - No console errors.
 *   - Document has a non-empty <h1>.
 *   - Every `img.excalidraw-light`/`img.excalidraw-dark` actually shows the
 *     correct variant for the saved-theme attribute, and the image is
 *     horizontally centered within its parent.
 *
 * Output (JSON to stdout):
 *   {
 *     mode: "local" | "live",
 *     baseUrl: "...",
 *     pages: [{ slug, light, dark, mobile, errors: [...] }],
 *     passed: bool,
 *   }
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import net from "node:net"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUARTZ_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(QUARTZ_ROOT, "public")
const CONFIG_PATH = path.join(QUARTZ_ROOT, "quartz.config.yaml")

function getFlag(name, dflt = null) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function readLiveBaseUrl() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8")
  const m = raw.match(/^\s*baseUrl:\s*(\S+)/m)
  if (!m) throw new Error("could not parse baseUrl from quartz.config.yaml")
  return `https://${m[1].replace(/^https?:\/\//, "")}`
}

async function startLocalServer() {
  const port = await freePort()
  const child = spawn("python3", ["-m", "http.server", String(port)], {
    cwd: PUBLIC_DIR,
    stdio: ["ignore", "ignore", "pipe"],
  })
  // Wait briefly for it to come up. http.server prints to stderr on bind.
  await sleep(800)
  return {
    base: `http://localhost:${port}`,
    stop: () => {
      try {
        child.kill("SIGTERM")
      } catch {}
    },
  }
}

async function readSlugs() {
  const slugsPath = getFlag("--slugs")
  if (slugsPath) {
    const raw = await fs.readFile(slugsPath, "utf8")
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (process.stdin.isTTY) return ["/"]
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  const lines = Buffer.concat(chunks).toString("utf8").split("\n")
  return lines.map((s) => s.trim()).filter(Boolean)
}

async function runPlaywright(base, slugs) {
  // Lazy import so the script doesn't require playwright when used in
  // discover/validation-only flows.
  const { chromium } = await import("playwright")
  const browser = await chromium.launch()

  const results = []
  for (const slug of slugs) {
    const u = base.replace(/\/$/, "") + (slug.startsWith("/") ? slug : `/${slug}`)
    const result = { slug, errors: [] }

    for (const variant of ["light", "dark", "mobile"]) {
      const viewport =
        variant === "mobile"
          ? { width: 390, height: 800 }
          : { width: 1280, height: 800 }
      const theme = variant === "dark" ? "dark" : "light"
      const ctx = await browser.newContext({ viewport })
      const page = await ctx.newPage()
      const consoleErrors = []
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      let resp
      try {
        resp = await page.goto(u, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
        await page.evaluate(
          ([t]) => {
            document.documentElement.setAttribute("saved-theme", t)
            try {
              localStorage.setItem("theme", t)
            } catch {}
          },
          [theme],
        )
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})

        const status = resp ? resp.status() : 0
        const h1 = await page.$eval("h1", (n) => n.textContent.trim()).catch(() => "")
        const excalidraw = await page.$$eval(
          `img.excalidraw-${theme}`,
          (imgs) =>
            imgs.map((img) => {
              const r = img.getBoundingClientRect()
              const cs = getComputedStyle(img)
              const p = img.parentElement.getBoundingClientRect()
              return {
                visible: cs.display !== "none" && r.width > 0,
                parentSlack: Math.max(0, p.width - r.width),
                offsetL: r.left - p.left,
                centered:
                  Math.abs(r.left - p.left - (p.width - r.width) / 2) <= 2,
              }
            }),
        )
        const allCentered = excalidraw.every((e) => e.centered)
        const ok = status === 200 && h1.length > 0 && allCentered && consoleErrors.length === 0
        result[variant] = {
          status,
          h1,
          excalidrawCount: excalidraw.length,
          excalidrawCentered: allCentered,
          consoleErrors,
          ok,
        }
        if (!ok) {
          if (status !== 200) result.errors.push(`${variant}: HTTP ${status}`)
          if (h1.length === 0) result.errors.push(`${variant}: empty h1`)
          if (!allCentered) result.errors.push(`${variant}: excalidraw not centered`)
          if (consoleErrors.length > 0)
            result.errors.push(`${variant}: ${consoleErrors.length} console errors`)
        }
      } catch (e) {
        result[variant] = { ok: false, error: e.message }
        result.errors.push(`${variant}: ${e.message}`)
      } finally {
        await ctx.close()
      }
    }
    results.push(result)
  }
  await browser.close()
  return results
}

async function main() {
  const mode = process.argv.includes("--local")
    ? "local"
    : process.argv.includes("--live")
      ? "live"
      : null
  if (!mode) {
    process.stderr.write("usage: playwright-smoke.mjs --local|--live [--slugs <path>]\n")
    process.exit(2)
  }

  const slugs = await readSlugs()
  if (slugs.length === 0) {
    process.stderr.write("no slugs provided\n")
    process.exit(2)
  }

  let base
  let stop = () => {}
  if (mode === "local") {
    const srv = await startLocalServer()
    base = srv.base
    stop = srv.stop
  } else {
    base = await readLiveBaseUrl()
    // Allow CDN/Pages propagation grace period.
    await sleep(parseInt(getFlag("--wait", "5000"), 10))
  }

  let pages
  try {
    pages = await runPlaywright(base, slugs)
  } finally {
    stop()
  }

  const passed = pages.every(
    (p) =>
      p.light?.ok !== false && p.dark?.ok !== false && p.mobile?.ok !== false,
  )
  process.stdout.write(
    JSON.stringify({ mode, baseUrl: base, pages, passed }, null, 2) + "\n",
  )
  if (!passed) process.exit(1)
}

main().catch((e) => {
  process.stderr.write(`playwright-smoke failed: ${e.stack || e.message}\n`)
  process.exit(1)
})
