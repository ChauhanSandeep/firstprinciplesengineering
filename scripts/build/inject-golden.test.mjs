import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import url from "node:url"
import { spawn } from "node:child_process"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "..", "..")

// Run an injector against a fixture public/ dir via FPE_PUBLIC_DIR.
function runInjector(scriptName, publicDir, extraEnv = {}) {
  const script = path.join(__dirname, scriptName)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: REPO_ROOT,
      env: { ...process.env, FPE_PUBLIC_DIR: publicDir, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => (stdout += d))
    child.stderr.on("data", (d) => (stderr += d))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

async function withPublicDir(files, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fpe-inject-"))
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, content, "utf8")
    }
    return await fn(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

const HEAD = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>`

describe("inject-security", () => {
  test("injects CSP + referrer meta with the expected origins", async () => {
    await withPublicDir({ "page.html": `${HEAD}<body>x</body></html>` }, async (dir) => {
      const r = await runInjector("inject-security.mjs", dir)
      assert.equal(r.code, 0, r.stderr)
      const out = await fs.readFile(path.join(dir, "page.html"), "utf8")
      assert.match(out, /http-equiv="Content-Security-Policy"/)
      assert.match(out, /name="referrer" content="strict-origin-when-cross-origin"/)
      // Connect origins the engagement + analytics layers require.
      assert.match(out, /connect-src[^;]*https:\/\/\*\.supabase\.co/)
      assert.match(out, /connect-src[^;]*wss:\/\/\*\.supabase\.co/)
      assert.match(out, /connect-src[^;]*https:\/\/esm\.sh/)
      // Script origins for supabase-js, mermaid, katex.
      assert.match(out, /script-src[^;]*https:\/\/esm\.sh/)
      assert.match(out, /script-src[^;]*https:\/\/cdnjs\.cloudflare\.com/)
      assert.match(out, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/)
      // Quartz explorer + bases-page serialize functions re-run via
      // `new Function`, and KaTeX pulls fonts from jsdelivr — both must
      // stay allow-listed or the site breaks. Lock them in.
      assert.match(out, /script-src[^;]*'unsafe-eval'/)
      assert.match(out, /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/)
      // Header-only directives must NOT be emitted as meta.
      assert.doesNotMatch(out, /X-Content-Type-Options/)
      assert.doesNotMatch(out, /frame-ancestors/)
    })
  })

  test("is idempotent (second run does not duplicate)", async () => {
    await withPublicDir({ "page.html": `${HEAD}<body>x</body></html>` }, async (dir) => {
      await runInjector("inject-security.mjs", dir)
      await runInjector("inject-security.mjs", dir)
      const out = await fs.readFile(path.join(dir, "page.html"), "utf8")
      const count = (out.match(/Content-Security-Policy/g) || []).length
      assert.equal(count, 1)
    })
  })

  test("FPE_CSP=off skips injection", async () => {
    await withPublicDir({ "page.html": `${HEAD}<body>x</body></html>` }, async (dir) => {
      await runInjector("inject-security.mjs", dir, { FPE_CSP: "off" })
      const out = await fs.readFile(path.join(dir, "page.html"), "utf8")
      assert.doesNotMatch(out, /Content-Security-Policy/)
    })
  })
})

describe("inject-seo", () => {
  const articleHtml = [
    `<!doctype html><html><head>`,
    `<meta property="og:url" content="https://firstprinciplesengineering.tech/topic/my-note"/>`,
    `<meta property="og:image" content="https://firstprinciplesengineering.tech/og.png"/>`,
    `<meta name="description" content="A note about caching."/>`,
    `</head><body>`,
    `<nav class="breadcrumb-container">`,
    `<div class="breadcrumb-element"><a href="../">Home</a></div>`,
    `<div class="breadcrumb-element"><a href="./">My Note</a></div>`,
    `</nav>`,
    `<h1 class="article-title">My Note</h1>`,
    `<time datetime="2024-01-02">Jan 2, 2024</time>`,
    `</body></html>`,
  ].join("")

  test("adds canonical + Article + BreadcrumbList JSON-LD on article pages", async () => {
    await withPublicDir({ "topic/my-note.html": articleHtml }, async (dir) => {
      const r = await runInjector("inject-seo.mjs", dir)
      assert.equal(r.code, 0, r.stderr)
      const out = await fs.readFile(path.join(dir, "topic/my-note.html"), "utf8")
      assert.match(
        out,
        /<link rel="canonical" href="https:\/\/firstprinciplesengineering\.tech\/topic\/my-note"\/>/,
      )
      assert.match(out, /data-fpe-jsonld="article"/)
      assert.match(out, /data-fpe-jsonld="breadcrumb"/)
      assert.match(out, /"headline":"My Note"/)
      assert.match(out, /"datePublished":"2024-01-02"/)
    })
  })

  test("skips Article JSON-LD on the home page", async () => {
    const home = articleHtml.replace("/topic/my-note", "/")
    await withPublicDir({ "index.html": home }, async (dir) => {
      await runInjector("inject-seo.mjs", dir)
      const out = await fs.readFile(path.join(dir, "index.html"), "utf8")
      assert.doesNotMatch(out, /data-fpe-jsonld="article"/)
    })
  })

  test("is idempotent", async () => {
    await withPublicDir({ "topic/my-note.html": articleHtml }, async (dir) => {
      await runInjector("inject-seo.mjs", dir)
      await runInjector("inject-seo.mjs", dir)
      const out = await fs.readFile(path.join(dir, "topic/my-note.html"), "utf8")
      assert.equal((out.match(/rel="canonical"/g) || []).length, 1)
      assert.equal((out.match(/data-fpe-jsonld="article"/g) || []).length, 1)
    })
  })
})

describe("inject-folder-pages", () => {
  const folderHtml = [
    `<!doctype html><html><head><title>t</title></head><body>`,
    `<nav class="breadcrumb-container">`,
    `<div class="breadcrumb-element"><a href="../">01-Fundamentals</a></div>`,
    `</nav>`,
    `<h1 class="article-title">01-Concepts</h1>`,
    `<div class="page-listing">`,
    `<ul class="section-ul">`,
    `<li class="section-li"><div class="section">`,
    `<h3><a href="03-data/">03-Data</a></h3>`,
    `<p class="meta"></p>`,
    `<ul class="tags"></ul>`,
    `</div></li>`,
    `</ul></div>`,
    `</body></html>`,
  ].join("")

  test("humanizes titles and adds an item-count footer to bare cards", async () => {
    await withPublicDir(
      {
        "01-concepts/index.html": folderHtml,
        // One child note so the "N items" count is deterministic.
        "01-concepts/03-data/note.html": "<html></html>",
      },
      async (dir) => {
        const r = await runInjector("inject-folder-pages.mjs", dir)
        assert.equal(r.code, 0, r.stderr)
        const out = await fs.readFile(path.join(dir, "01-concepts/index.html"), "utf8")
        // H1 + breadcrumb + card title all lose the NN- prefix.
        assert.match(out, /<h1[^>]*class="article-title"[^>]*>Concepts<\/h1>/)
        assert.match(out, /<div class="breadcrumb-element"><a[^>]*>Fundamentals<\/a>/) // breadcrumb humanized
        assert.match(out, /<h3>\s*<a[^>]*>Data<\/a>\s*<\/h3>/)
        // Bare card gains the item-count footer.
        assert.match(out, /fpe-folder-meta/)
        assert.match(out, /1 item/)
        // Idempotency marker set.
        assert.match(out, /data-fpe-folder-normalized/)
      },
    )
  })

  test("is idempotent (marker prevents re-processing)", async () => {
    await withPublicDir(
      {
        "01-concepts/index.html": folderHtml,
        "01-concepts/03-data/note.html": "<html></html>",
      },
      async (dir) => {
        await runInjector("inject-folder-pages.mjs", dir)
        const first = await fs.readFile(path.join(dir, "01-concepts/index.html"), "utf8")
        await runInjector("inject-folder-pages.mjs", dir)
        const second = await fs.readFile(path.join(dir, "01-concepts/index.html"), "utf8")
        assert.equal(first, second)
      },
    )
  })
})
