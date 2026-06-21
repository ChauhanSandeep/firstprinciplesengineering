import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const EXPECTED_DOMAIN = "firstprinciplesengineering.tech"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const siteRoot = path.resolve(__dirname, "..", "..")
const quartzConfigPath = path.join(siteRoot, "quartz.config.yaml")
const cnamePath = path.join(siteRoot, "public", "CNAME")

function normalizeDomain(value) {
  const trimmed = value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
  const parsed = new URL(`https://${trimmed}`)
  if (parsed.pathname !== "/") {
    throw new Error(`expected a bare domain, got ${value}`)
  }
  return parsed.hostname.toLowerCase()
}

async function readConfiguredDomain() {
  const raw = await fs.readFile(quartzConfigPath, "utf8")
  const match = raw.match(/^\s*baseUrl:\s*["']?([^"'\s]+)["']?\s*$/m)
  if (!match) {
    throw new Error(`could not parse baseUrl from ${quartzConfigPath}`)
  }
  return normalizeDomain(match[1])
}

async function readCnameDomain() {
  const raw = await fs.readFile(cnamePath, "utf8")
  return normalizeDomain(raw)
}

try {
  const [configuredDomain, cnameDomain] = await Promise.all([
    readConfiguredDomain(),
    readCnameDomain(),
  ])

  const failures = []
  if (configuredDomain !== EXPECTED_DOMAIN) {
    failures.push(`quartz.config.yaml baseUrl is ${configuredDomain}`)
  }
  if (cnameDomain !== EXPECTED_DOMAIN) {
    failures.push(`public/CNAME is ${cnameDomain}`)
  }

  if (failures.length > 0) {
    throw new Error(
      [
        `Refusing to deploy: expected domain is ${EXPECTED_DOMAIN}.`,
        ...failures.map((failure) => `- ${failure}`),
        "Run npm run build after fixing quartz.config.yaml, then retry npm run deploy.",
      ].join("\n"),
    )
  }

  console.log(`deploy domain verified: ${EXPECTED_DOMAIN}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
