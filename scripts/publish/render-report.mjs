#!/usr/bin/env node
/**
 * scripts/publish/render-report.mjs
 *
 * Final phase of the quartz-publish-notes skill. Consumes a JSON "state" object
 * accumulated across previous phases and emits a markdown report.
 *
 * Input (stdin or --state <path>):
 *   {
 *     runStartedAt: ISO timestamp,
 *     runFinishedAt: ISO timestamp,
 *     discovery: { ... },             // discover.mjs output
 *     excalidraw: { results, summary },
 *     wikilinks:  { results, summary },
 *     cardsPlan:  { ... },            // the plan handed to update-home-cards
 *     seriesPlan: { ... },            // the plan handed to manage-series
 *     build:      { ok: bool, durationMs, stderr },
 *     smokeLocal: { passed, pages },
 *     deploy:     { ok: bool, commit, gitTag },
 *     smokeLive:  { passed, pages },
 *     errors:     [ ... ],            // collected error strings
 *     warnings:   [ ... ],
 *     followUps:  [ ... ],            // drafts/decisions to review
 *   }
 *
 * Output: markdown to stdout. Also written to
 *   $COPILOT_SESSION_STATE_DIR/files/publish-report-<ISO>.md if env is set.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getFlag(name, dflt = null) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt
}

async function readState() {
  const p = getFlag("--state")
  if (p) return JSON.parse(await fs.readFile(p, "utf8"))
  if (process.stdin.isTTY) {
    process.stderr.write("usage: render-report.mjs --state <state.json>\n")
    process.exit(2)
  }
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function fmtMs(ms) {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusEmoji(ok) {
  return ok ? "✅" : "❌"
}

function renderShipped(state) {
  const pubs = (state.discovery?.candidates || []).filter(
    (c) => c.status === "new" || c.status === "changed",
  )
  if (pubs.length === 0) return "No notes published this run.\n"
  const lines = ["| Status | Note | Featured | Series | Live URL |", "|---|---|---|---|---|"]
  const live = state.deploy?.baseUrl || state.smokeLive?.baseUrl || ""
  for (const c of pubs) {
    const liveUrl = live
      ? `[link](${live.replace(/\/$/, "")}/${c.slug})`
      : c.slug
    lines.push(
      `| ${c.status} | \`${c.vaultPath}\` | ${c.featured ? "★" : ""} | ${
        c.series || ""
      } | ${liveUrl} |`,
    )
  }
  return lines.join("\n") + "\n"
}

function renderCardsAndSeries(state) {
  const parts = []
  const cp = state.cardsPlan || {}
  const sp = state.seriesPlan || {}
  const added = (cp.featured_add || []).length
  const removed = (cp.featured_remove || []).length
  const updated = (cp.featured_update || []).length
  const sAdd = (sp.series_add || []).length
  const sRem = (sp.series_remove || []).length
  const sUpd = (sp.series_update || []).length
  const sPages = (sp.series_pages || []).length

  if (added + removed + updated > 0) {
    parts.push(
      `**Featured grid:** +${added} / -${removed} / ~${updated} cards`,
    )
    for (const c of cp.featured_add || []) {
      parts.push(`  - + \`${c.href}\` — ${c.title}`)
    }
    for (const h of cp.featured_remove || []) {
      parts.push(`  - − \`${h}\``)
    }
  }
  if (sAdd + sRem + sUpd + sPages > 0) {
    parts.push(
      `**Reading Series:** +${sAdd} / -${sRem} / ~${sUpd} cards, ${sPages} landing page(s) written`,
    )
    for (const s of sp.series_add || []) {
      parts.push(`  - + \`${s.slug || s.href}\` — ${s.title}`)
    }
    for (const s of sp.series_pages || []) {
      parts.push(`  - 📄 wrote \`02-Series/${s.slug}.md\``)
    }
  }
  return parts.length === 0 ? "No card or series changes.\n" : parts.join("\n") + "\n"
}

function renderWarnings(state) {
  const items = []
  for (const r of state.excalidraw?.results || []) {
    for (const e of r.embeds || []) {
      if (e.severity === "warning")
        items.push(`- 🟡 excalidraw: \`${r.note}\` — ${e.target}: ${e.message}`)
    }
  }
  for (const r of state.wikilinks?.results || []) {
    for (const l of r.links || []) {
      if (l.severity === "warning")
        items.push(`- 🟡 wikilink: \`${r.note}\` — [[${l.target}]]: ${l.message}`)
    }
  }
  for (const w of state.warnings || []) items.push(`- 🟡 ${w}`)
  return items.length === 0 ? "_None._\n" : items.join("\n") + "\n"
}

function renderErrors(state) {
  const items = []
  for (const r of state.excalidraw?.results || []) {
    for (const e of r.embeds || []) {
      if (e.severity === "critical")
        items.push(`- 🔴 excalidraw: \`${r.note}\` — ${e.target}: ${e.message}`)
    }
  }
  for (const r of state.wikilinks?.results || []) {
    for (const l of r.links || []) {
      if (l.severity === "critical")
        items.push(`- 🔴 wikilink: \`${r.note}\` — [[${l.target}]]: ${l.message}`)
    }
  }
  for (const e of state.errors || []) items.push(`- 🔴 ${e}`)
  if (state.build && state.build.ok === false)
    items.push(`- 🔴 build failed: ${state.build.stderr?.slice(0, 200) ?? ""}`)
  if (state.smokeLocal && state.smokeLocal.passed === false)
    items.push(`- 🔴 local smoke failed`)
  if (state.smokeLive && state.smokeLive.passed === false)
    items.push(`- 🔴 live smoke failed`)
  return items.length === 0 ? "_None._\n" : items.join("\n") + "\n"
}

function renderFollowUps(state) {
  const items = state.followUps || []
  if (items.length === 0) return "_None._\n"
  return items.map((f) => `- 📝 ${f}`).join("\n") + "\n"
}

function renderStats(state) {
  const d = state.discovery?.stats || {}
  const ex = state.excalidraw?.summary || {}
  const wl = state.wikilinks?.summary || {}
  const lines = [
    `- vault notes parsed: ${d.parsed ?? "—"}`,
    `- candidates: ${d.candidates ?? "—"} (new: ${d.new ?? 0}, changed: ${d.changed ?? 0}, unchanged: ${d.unchanged ?? 0})`,
    `- excalidraw embeds: ${(ex.ok ?? 0) + (ex.warning ?? 0) + (ex.critical ?? 0)} (ok ${ex.ok ?? 0} / warn ${ex.warning ?? 0} / crit ${ex.critical ?? 0})`,
    `- wikilinks: ${(wl.ok ?? 0) + (wl.warning ?? 0) + (wl.critical ?? 0)} (ok ${wl.ok ?? 0} / warn ${wl.warning ?? 0} / crit ${wl.critical ?? 0})`,
    `- build: ${state.build?.ok === false ? "FAILED" : state.build?.ok === true ? "ok" : "skipped"} (${fmtMs(state.build?.durationMs)})`,
    `- local smoke: ${state.smokeLocal?.passed === false ? "FAILED" : state.smokeLocal?.passed === true ? "ok" : "skipped"}`,
    `- deploy: ${state.deploy?.ok === false ? "FAILED" : state.deploy?.ok === true ? "ok" : "skipped"}`,
    `- live smoke: ${state.smokeLive?.passed === false ? "FAILED" : state.smokeLive?.passed === true ? "ok" : "skipped"}`,
  ]
  return lines.join("\n") + "\n"
}

function render(state) {
  const dur =
    state.runStartedAt && state.runFinishedAt
      ? new Date(state.runFinishedAt).getTime() -
        new Date(state.runStartedAt).getTime()
      : null
  const overall =
    (state.errors?.length ?? 0) === 0 &&
    state.build?.ok !== false &&
    state.smokeLocal?.passed !== false &&
    state.deploy?.ok !== false &&
    state.smokeLive?.passed !== false

  return [
    `# Publish report — ${state.runFinishedAt || new Date().toISOString()}`,
    "",
    `**Overall:** ${statusEmoji(overall)} ${overall ? "success" : "issues present"}` +
      (dur != null ? ` · ${fmtMs(dur)}` : ""),
    "",
    "## Shipped",
    "",
    renderShipped(state),
    "",
    "## Cards & Series",
    "",
    renderCardsAndSeries(state),
    "",
    "## Warnings",
    "",
    renderWarnings(state),
    "",
    "## Errors",
    "",
    renderErrors(state),
    "",
    "## Follow-ups",
    "",
    renderFollowUps(state),
    "",
    "## Stats",
    "",
    renderStats(state),
  ].join("\n")
}

async function saveReportToSession(md) {
  const dir = process.env.COPILOT_SESSION_STATE_DIR
  if (!dir) return null
  const filesDir = path.join(dir, "files")
  await fs.mkdir(filesDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const target = path.join(filesDir, `publish-report-${stamp}.md`)
  await fs.writeFile(target, md, "utf8")
  return target
}

async function main() {
  const state = await readState()
  const md = render(state)
  const saved = await saveReportToSession(md)
  if (saved) process.stderr.write(`report saved to ${saved}\n`)
  process.stdout.write(md)
}

main().catch((e) => {
  process.stderr.write(`render-report failed: ${e.stack || e.message}\n`)
  process.exit(1)
})
