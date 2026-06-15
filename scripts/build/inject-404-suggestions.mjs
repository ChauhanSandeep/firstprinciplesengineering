#!/usr/bin/env node
/**
 * scripts/build/inject-404-suggestions.mjs
 *
 * Phase 11 — Enhances the static 404 page so that when a reader
 * lands on a not-yet-published URL, they see up to five fuzzy-
 * matched suggestions of related public pages.
 *
 * The existing 404.html already has a case-fix redirect script
 * powered by `fetchData` (Quartz's contentIndex.json fetch). We
 * extend that same closure to:
 *
 *   1. Read the broken slug.
 *   2. Extract its last segment as a "title-ish" query
 *      (strip `NN-` prefixes, hyphens → spaces, dropped extensions).
 *   3. Score every contentIndex entry against the query using
 *      a cheap token-overlap + 3-gram metric.
 *   4. Render the top 5 (score ≥ threshold) as a bullet list
 *      inside #fpe-404-suggestions.
 *
 * Pure client-side. Idempotent via marker id="fpe-404-suggestions".
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const PAGE_404 = path.join(PUBLIC_DIR, "404.html")
const MARKER = 'id="fpe-404-suggestions"'

const CONTAINER = `<div ${MARKER} class="fpe-404-suggestions" hidden><h2 class="fpe-404-suggestions-title">Maybe one of these?</h2><ul class="fpe-404-suggestions-list"></ul></div>`

const SUGGEST_SCRIPT = String.raw`<script>
  (function(){
    if (typeof fetchData === "undefined") return;
    fetchData.then(function(index){
      var container = document.getElementById("fpe-404-suggestions");
      if (!container) return;
      var basePath = (document.body && document.body.dataset && document.body.dataset.basepath) || "";
      if (basePath.length > 1 && basePath.endsWith("/")) basePath = basePath.slice(0, -1);
      var pathname = window.location.pathname;
      if (basePath.length > 1 && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
      if (pathname.startsWith("/")) pathname = pathname.slice(1);
      if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
      if (pathname.endsWith(".html")) pathname = pathname.slice(0, -5);
      if (!pathname) return;

      // If the case-fix redirect is about to fire, defer to it.
      var lowered = pathname.toLowerCase();
      if (lowered !== pathname && index[lowered] != null) return;

      // Build a title-ish query from the last path segment.
      var seg = pathname.split("/").pop() || "";
      var query = seg.replace(/^\d+[-_]+/, "").replace(/[-_]+/g, " ").trim().toLowerCase();
      if (query.length < 3) return;

      function tokens(s){ return (s || "").toLowerCase().split(/[^a-z0-9]+/).filter(function(t){return t.length>1;}); }
      function trigrams(s){
        var t = (" " + (s||"").toLowerCase() + " ").replace(/[^a-z0-9 ]+/g, "");
        var out = [];
        for (var i=0;i<t.length-2;i++) out.push(t.slice(i,i+3));
        return out;
      }
      var qTokens = tokens(query);
      var qTri = trigrams(query);
      var qTriSet = {};
      qTri.forEach(function(g){ qTriSet[g]=true; });

      var hits = [];
      Object.keys(index).forEach(function(slug){
        var entry = index[slug];
        if (!entry || !entry.title) return;
        if (slug === "404" || slug === "index" || slug.endsWith("/index")) return;

        var title = entry.title;
        var tTokens = tokens(title);
        var overlap = 0;
        for (var i=0;i<qTokens.length;i++) if (tTokens.indexOf(qTokens[i]) >= 0) overlap++;

        var tTri = trigrams(title);
        var triOverlap = 0;
        for (var j=0;j<tTri.length;j++) if (qTriSet[tTri[j]]) triOverlap++;
        var triScore = qTri.length ? triOverlap / qTri.length : 0;

        var score = overlap * 2 + triScore * 3;
        // Title-substring boost — exact prefix or contained phrase.
        var titleLower = title.toLowerCase();
        if (titleLower.indexOf(query) >= 0) score += 4;
        if (titleLower.indexOf(qTokens[0] || "") === 0) score += 1;

        if (score >= 1.5) {
          hits.push({slug: slug, title: title, score: score});
        }
      });
      hits.sort(function(a,b){ return b.score - a.score; });
      var top = hits.slice(0, 5);
      if (top.length === 0) return;

      var ul = container.querySelector(".fpe-404-suggestions-list");
      if (!ul) return;
      top.forEach(function(h){
        var li = document.createElement("li");
        var a = document.createElement("a");
        var prefix = (basePath && basePath.length > 1) ? basePath : "";
        a.href = prefix + "/" + h.slug;
        a.textContent = h.title;
        li.appendChild(a);
        ul.appendChild(li);
      });
      container.hidden = false;
    });
  })();
</script>`

async function main() {
  let html
  try {
    html = await fs.readFile(PAGE_404, "utf8")
  } catch {
    console.log("inject-404-suggestions: 404.html not found; skipping.")
    return
  }
  if (html.includes(MARKER)) {
    console.log("inject-404-suggestions: already injected; skipping.")
    return
  }
  // Insert container after the last <ul> and before <script>.
  const next = html.replace(
    /(<\/ul>)(\s*<p>\s*<em>[^<]*<\/em>\s*<\/p>)?(\s*<script>)/,
    (_m, ul, em, script) => `${ul}${em || ""}\n${CONTAINER}\n${SUGGEST_SCRIPT}${script}`,
  )
  if (next === html) {
    console.log(
      "inject-404-suggestions: insertion anchor not found in 404.html; skipping.",
    )
    return
  }
  await fs.writeFile(PAGE_404, next, "utf8")
  console.log("inject-404-suggestions: enhanced 404.html with fuzzy suggestions.")
}

main().catch((e) => {
  console.error("inject-404-suggestions failed:", e)
  process.exit(1)
})
