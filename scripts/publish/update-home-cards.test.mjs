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
const SCRIPT = path.join(__dirname, "update-home-cards.mjs")

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

async function withTempIndex(indexContent, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-cards-"))
  const indexPath = path.join(dir, "index.md")
  await fs.writeFile(indexPath, indexContent, "utf8")
  try {
    return await fn(indexPath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function withPlanFile(plan, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-plan-"))
  const planPath = path.join(dir, "plan.json")
  await fs.writeFile(planPath, JSON.stringify(plan), "utf8")
  try {
    return await fn(planPath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function runWithIndex(indexContent, plan, extraArgs = []) {
  return withTempIndex(indexContent, async (indexPath) => {
    return withPlanFile(plan, async (planPath) => {
      const { code, stdout, stderr } = await runScript([
        "--index",
        indexPath,
        "--plan",
        planPath,
        ...extraArgs,
      ])
      const after = await fs.readFile(indexPath, "utf8")
      return { code, stdout, stderr, after }
    })
  })
}

const FIXTURE_WITH_RAW_BLOCK = `# Home

## Featured

<div class="fpe-featured-grid">

<a class="fpe-article-card" href="01-Foo/Bar">
  <span class="article-eyebrow">FOO</span>
  <span class="article-title">Bar</span>
  <span class="article-desc">A bar.</span>
</a>

</div>
`

const EMPTY_PLAN = {
  featured_add: [],
  featured_remove: [],
  featured_update: [],
}

describe("update-home-cards.mjs", () => {
  test("first run wraps existing block in markers (idempotent thereafter)", async () => {
    const { after: after1 } = await runWithIndex(FIXTURE_WITH_RAW_BLOCK, EMPTY_PLAN)
    assert.match(after1, /publish-skill:featured-begin/)
    assert.match(after1, /publish-skill:featured-end/)
    assert.match(after1, /href="01-Foo\/Bar"/)

    // Second run with the marker-wrapped output must be a no-op.
    const { stdout: stdout2, after: after2 } = await runWithIndex(after1, EMPTY_PLAN)
    const result2 = JSON.parse(stdout2)
    assert.strictEqual(result2.changed, false, "second run must be a no-op")
    assert.strictEqual(after2, after1)
  })

  test("add inserts a new card", async () => {
    const plan = {
      featured_add: [
        {
          href: "01-NewSection/HelloWorld",
          eyebrow: "NEW",
          title: "Hello World",
          description: "A brand new card.",
        },
      ],
      featured_remove: [],
      featured_update: [],
    }
    const { stdout, after } = await runWithIndex(FIXTURE_WITH_RAW_BLOCK, plan)
    const result = JSON.parse(stdout)
    assert.strictEqual(result.added, 1)
    assert.strictEqual(result.cards, 2)
    assert.match(after, /href="01-NewSection\/HelloWorld"/)
    assert.match(after, /Hello World/)
  })

  test("remove drops the card by href", async () => {
    const plan = {
      featured_add: [],
      featured_remove: ["01-Foo/Bar"],
      featured_update: [],
    }
    const { stdout, after } = await runWithIndex(FIXTURE_WITH_RAW_BLOCK, plan)
    const result = JSON.parse(stdout)
    assert.strictEqual(result.removed, 1)
    assert.strictEqual(result.cards, 0)
    assert.doesNotMatch(after, /href="01-Foo\/Bar"/)
  })

  test("--dry-run does not write", async () => {
    const plan = {
      featured_add: [
        {
          href: "01-Z/Z",
          eyebrow: "Z",
          title: "Z",
          description: "Z desc.",
        },
      ],
      featured_remove: [],
      featured_update: [],
    }
    const before = FIXTURE_WITH_RAW_BLOCK
    const { stdout, after } = await runWithIndex(before, plan, ["--dry-run"])
    const result = JSON.parse(stdout)
    assert.strictEqual(result.dryRun, true)
    assert.strictEqual(after, before, "file must be untouched in dry-run")
  })
})
