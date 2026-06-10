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
const SCRIPT = path.join(__dirname, "manage-series.mjs")

function runScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: REPO_ROOT,
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

const FIXTURE = `# Home

## Reading Series

<div class="fpe-learning-paths">

<a class="fpe-path-card" href="02-Series/existing-series">
  <span class="path-title">Existing Series</span>
  <span class="path-desc">An existing series.</span>
  <span class="path-count">3 articles</span>
</a>

</div>
`

async function runWithFixture(plan, args = []) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-series-"))
  const indexPath = path.join(dir, "index.md")
  const seriesDir = path.join(dir, "02-Series")
  const planPath = path.join(dir, "plan.json")
  await fs.writeFile(indexPath, FIXTURE, "utf8")
  await fs.writeFile(planPath, JSON.stringify(plan), "utf8")
  const { code, stdout, stderr } = await runScript([
    "--index",
    indexPath,
    "--series-dir",
    seriesDir,
    "--plan",
    planPath,
    ...args,
  ])
  const after = await fs.readFile(indexPath, "utf8")
  return {
    code,
    stdout,
    stderr,
    after,
    seriesDir,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  }
}

describe("manage-series.mjs", () => {
  test("adds a new series card and writes its landing page", async () => {
    const plan = {
      series_add: [
        {
          slug: "ai-systems",
          title: "AI Systems in Production",
          description: "From prompt to pager.",
          count: 5,
        },
      ],
      series_remove: [],
      series_update: [],
      series_pages: [
        {
          slug: "ai-systems",
          title: "AI Systems in Production",
          description: "From prompt to pager — what it actually takes.",
          notes: [
            {
              vaultPath: "01-Fundamentals/05-AI-ML/04-RAG-Architecture.md",
              displayTitle: "RAG Architecture",
              blurb: "Retrieval is the system; the model just answers.",
            },
          ],
        },
      ],
    }
    const { code, stdout, after, seriesDir, cleanup } = await runWithFixture(plan)
    try {
      assert.strictEqual(code, 0)
      const result = JSON.parse(stdout)
      assert.strictEqual(result.added, 1)
      assert.match(after, /href="02-Series\/ai-systems"/)
      assert.match(after, /AI Systems in Production/)
      assert.match(after, /5 articles/)
      const landing = await fs.readFile(
        path.join(seriesDir, "ai-systems.md"),
        "utf8",
      )
      assert.match(landing, /publish: true/)
      assert.match(landing, /## Read in order/)
      assert.match(landing, /\[\[04-RAG-Architecture\|RAG Architecture\]\]/)
    } finally {
      await cleanup()
    }
  })

  test("removes a series card by slug", async () => {
    const plan = {
      series_add: [],
      series_remove: ["existing-series"],
      series_update: [],
      series_pages: [],
    }
    const { code, after, cleanup } = await runWithFixture(plan)
    try {
      assert.strictEqual(code, 0)
      assert.doesNotMatch(after, /href="02-Series\/existing-series"/)
    } finally {
      await cleanup()
    }
  })

  test("--dry-run does not write landing pages", async () => {
    const plan = {
      series_add: [],
      series_remove: [],
      series_update: [],
      series_pages: [
        {
          slug: "should-not-exist",
          title: "x",
          description: "x",
          notes: [],
        },
      ],
    }
    const { code, stdout, seriesDir, cleanup } = await runWithFixture(plan, [
      "--dry-run",
    ])
    try {
      assert.strictEqual(code, 0)
      const result = JSON.parse(stdout)
      assert.strictEqual(result.dryRun, true)
      const exists = await fs
        .stat(path.join(seriesDir, "should-not-exist.md"))
        .then(() => true)
        .catch(() => false)
      assert.strictEqual(exists, false)
    } finally {
      await cleanup()
    }
  })
})
