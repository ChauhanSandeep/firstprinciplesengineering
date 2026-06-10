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
const SCRIPT = path.join(__dirname, "render-report.mjs")

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

async function withState(state, fn) {
  const tmp = path.join(
    os.tmpdir(),
    `publish-state-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  )
  await fs.writeFile(tmp, JSON.stringify(state), "utf8")
  try {
    return await fn(tmp)
  } finally {
    await fs.unlink(tmp).catch(() => {})
  }
}

const MIN_STATE = {
  runStartedAt: "2025-01-01T00:00:00Z",
  runFinishedAt: "2025-01-01T00:00:30Z",
  discovery: {
    candidates: [
      {
        slug: "01-fundamentals/05-ai-ml/04-rag",
        vaultPath: "01-Fundamentals/05-AI-ML/04-RAG.md",
        status: "new",
        featured: true,
        series: "ai-systems",
      },
    ],
    stats: { parsed: 50, candidates: 1, new: 1, changed: 0, unchanged: 49 },
  },
  excalidraw: { results: [], summary: { ok: 2, warning: 1, critical: 0 } },
  wikilinks: { results: [], summary: { ok: 5, warning: 0, critical: 0 } },
  warnings: ["something minor"],
  errors: [],
  followUps: ["review drafted intro"],
  build: { ok: true, durationMs: 12000 },
  smokeLocal: { passed: true },
  deploy: { ok: true, baseUrl: "https://example.com" },
  smokeLive: { passed: true },
}

describe("render-report.mjs", () => {
  test("renders all sections from a minimal state", async () => {
    await withState(MIN_STATE, async (statePath) => {
      const { code, stdout } = await runScript(["--state", statePath])
      assert.strictEqual(code, 0)
      assert.match(stdout, /# Publish report/)
      assert.match(stdout, /## Shipped/)
      assert.match(stdout, /## Cards & Series/)
      assert.match(stdout, /## Warnings/)
      assert.match(stdout, /## Errors/)
      assert.match(stdout, /## Follow-ups/)
      assert.match(stdout, /## Stats/)
      assert.match(stdout, /04-RAG\.md/)
      assert.match(stdout, /something minor/)
      assert.match(stdout, /review drafted intro/)
      assert.match(stdout, /vault notes parsed: 50/)
      assert.match(stdout, /✅/)
    })
  })

  test("flags overall failure when any phase failed", async () => {
    const state = { ...MIN_STATE, errors: ["boom"] }
    await withState(state, async (statePath) => {
      const { code, stdout } = await runScript(["--state", statePath])
      assert.strictEqual(code, 0)
      assert.match(stdout, /❌ issues present/)
      assert.match(stdout, /🔴 boom/)
    })
  })
})
