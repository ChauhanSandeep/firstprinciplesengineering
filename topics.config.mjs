/**
 * topics.config.mjs
 *
 * Canonical list of top-level topics for First Principles Engineering.
 * One source of truth used by:
 *
 *   - scripts/build/inject-topic-nav.mjs   (top-of-page nav strip on
 *                                           home + folder index pages)
 *   - content/index.md                     (manually mirrored in the
 *                                           Topics section — keep in sync)
 *   - (Phase 8) tag-page polish, topic landing pages
 *
 * Adding a new top-level topic = one edit here + one matching
 * <a class="fpe-topic-pill"> entry in content/index.md.
 *
 * Notes
 * -----
 * - `path` is the URL slug under the site basePath (no leading slash).
 *   It must resolve either to a real published note or to a folder that
 *   Quartz's FolderPage emitter generates an index for.
 * - `order` is used only to sort the topic nav strip. Lower = earlier.
 * - `icon` is the inline SVG markup rendered inside a fixed-size box.
 *   Stroke / fill / sizing live in topic-nav.scss; the SVG just supplies
 *   the geometry (use stroke="currentColor" so the icon recolors with
 *   the surrounding text).
 * - `blurb` is one short phrase, shown under the label on the home
 *   Topics grid but NOT in the compact topic nav strip.
 */

const ICONS = {
  network: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></svg>`,
  architecture: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4"/></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>`,
  api: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="20" cy="17" r="2"/></svg>`,
  series: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13M3 12h13M3 18h13"/><circle cx="20" cy="6" r="1.5"/><circle cx="20" cy="12" r="1.5"/><circle cx="20" cy="18" r="1.5"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></svg>`,
}

export const topics = [
  {
    label: "Distributed Systems",
    path: "01-Fundamentals/01-Concepts/01-Distributed-Systems/",
    order: 10,
    icon: ICONS.network,
    blurb: "Primitives → consensus → microservices.",
  },
  {
    label: "Databases",
    path: "01-Fundamentals/02-Databases/01-Fundamentals/",
    order: 20,
    icon: ICONS.database,
    blurb: "ACID, CAP, MVCC, internals.",
  },
  {
    label: "Architecture",
    path: "01-Fundamentals/01-Concepts/02-Architecture/",
    order: 30,
    icon: ICONS.architecture,
    blurb: "Event sourcing, BFF, strangler fig.",
  },
  {
    label: "AI Systems",
    path: "01-Fundamentals/05-AI-ML/",
    order: 40,
    icon: ICONS.sparkles,
    blurb: "RAG, model serving, embeddings.",
  },
  {
    label: "APIs & Networking",
    path: "01-Fundamentals/01-Concepts/05-API/",
    order: 50,
    icon: ICONS.api,
    blurb: "TCP/UDP/QUIC, REST, gRPC, GraphQL.",
  },
  {
    label: "Roadmaps",
    path: "03-Roadmaps/",
    order: 55,
    icon: ICONS.map,
    blurb: "Dependency-ordered reading paths.",
  },
  {
    label: "Reading Series",
    path: "02-Series/",
    order: 60,
    icon: ICONS.series,
    blurb: "Curated paths in dependency order.",
  },
]

export const BASE_PATH = "/firstprinciplesengineering"

export default { topics, BASE_PATH }
