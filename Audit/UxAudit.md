# UX Audit — First Principles Engineering

- **Reviewer role:** Senior UX Researcher / Information Architect / Technical Documentation Expert
- **Audience assumed:** Software engineers, senior/staff engineers, system-design interview candidates, engineers learning distributed systems — **first visit, zero prior context**
- **Environment tested:** Local ship candidate at `http://127.0.0.1:8099/` (Quartz v5 build)
- **Methods:** Real browser testing (Chrome DevTools) at desktop 1440×900 and mobile 390×844; Lighthouse (accessibility, performance, SEO, best-practices) on homepage + article; HTTP-verified site-wide link crawl; diagram-asset and frontmatter analysis
- **Date:** 2026-07-25
- **Build scope:** 83 built HTML pages · 274 unique internal links · 169 diagram embeds · 46 fundamentals articles

---

## Verdict (read this first)

This is a genuinely strong content site — excellent writing, per-page OG images, Lighthouse SEO 100 / Best-Practices 100, consistent Key Takeaways — sitting on top of **three ship-blocking defects**:

1. **29% of internal links 404** (mostly links into the author's private, unpublished vault).
2. **Every diagram renders as a white card in dark mode** (all 169 embeds hardcode `.light.svg`; correct dark variants exist but are unused).
3. **No `<main>` landmark** on any page (screen-reader + WCAG failure).

Plus two high-value gaps: **no prev/next reading pager** and **89% of articles have no SEO/social `description`**.

Fix these and the site moves from "good personal site" to "credible reference." The good news: the two most visible issues (dark diagrams, the 6 mis-resolved links) are fixable in hours because the assets and pages already exist.

---

## Friction Scores by Dimension

| # | Dimension | Friction (1=none, 10=severe) |
|---|---|---|
| 1 | First Impression | 3 (good) |
| 2 | Navigation | 6 |
| 3 | Learning Flow | 6 |
| 4 | Readability | 5 |
| 5 | Diagram Quality | 8 (major) |
| 6 | Information Architecture | 5 |
| 7 | Discoverability | 8 (major — headline issue) |
| 9 | Accessibility | 6 (Homepage a11y 95 / Article 87) |
| 10 | Performance Perception | 2 (excellent) |
| 11 | Content Quality | 4 |
| 12 | Developer Experience | 4 |
| 13 | SEO & Shareability | 5 |
| 14 | Trust Signals | 4 |

---

## 1. First Impression — Friction 3/10 (good)

In 10 seconds the user understands: dark, typographic site titled "First Principles Engineering" with the tagline "mental models before memorized patterns," a named credible author (Senior SWE @ LinkedIn), three labeled roadmaps (START HERE / INTERVIEW PREP / GROWING ROADMAP). Purpose is obvious; no cognitive overload above the fold. Homepage Lighthouse accessibility = 95.

### Issue 1.1 — Auth control over-emphasized for a free-reading site
- **Problem:** "Sign in / Your account" is among the most prominent header elements, before any content.
- **Why it matters:** A first-time reader of free notes wonders "why must I log in to read?" — an unnecessary trust/friction speed bump.
- **Evidence:** Header `button "Sign in"` (popup menu) + `link "Your account"` in nav; Supabase auth wired in.
- **Recommendation:** De-emphasize auth (icon-only or overflow). Never gate reading; label as clearly optional ("Sign in to save progress").
- **Estimated impact:** Low–Medium.

### Issue 1.2 — Say/do mismatch on homepage density
- **Problem:** Copy claims the site "intentionally keeps learning paths few and clear so the homepage does not become another notes folder," directly above **10** Recommended Reads cards (plus a "Newly Released" rail on production).
- **Why it matters:** Minor credibility mismatch between stated restraint and shown density.
- **Evidence:** Homepage snapshot: 3 roadmap cards + 10 recommended-read links + newly-released rail.
- **Recommendation:** Trim to ~6 curated cards or drop the self-referential sentence.
- **Estimated impact:** Low.

---

## 2. Navigation — Friction 6/10

**Positives:** breadcrumbs on every article, full right-hand TOC, working full-text search (index covers 82 pages), Explorer auto-expands to the current page, folder-landing pages render child cards ("7 items under this folder" — not dead ends).

### Issue 2.1 — No Previous/Next reading pager (biggest nav gap)
- **Problem:** Content is explicitly sequential (`01-`, `02-`, `03-` ordering) but there is no "Next → Distributed Lock" at the end of an article.
- **Why it matters:** A reader who finishes an article must return to the tree and hunt for the next one. For a learning site this is the single biggest navigation friction.
- **Evidence:** DOM query for `.page-nav / .pagination / .prev-next` → `pagerFound: false`; no `<a>` whose text starts with next/prev.
- **Recommendation:** Add a prev/next footer pager driven by folder order (Quartz has community components for this).
- **Estimated impact:** High.

### Issue 2.2 — Explorer nests 4 levels deep
- **Problem:** Hierarchy is Fundamentals › Concepts › Distributed Systems › article.
- **Why it matters:** Users can't predict whether "Consensus" lives under Concepts, Distributed Systems, or Technologies. Deep trees reduce predictability.
- **Evidence:** URL `/01-fundamentals/01-concepts/01-distributed-systems/03-consensus-algorithm` — 4 path segments.
- **Recommendation:** Flatten the "Concepts" bucket up one level (see IA §6). Target max 3 levels.
- **Estimated impact:** Medium.

### Issue 2.3 — Explorer folder rows below minimum tap-target size
- **Problem:** Folder rows are ~21.7px tall, below the 24×24px minimum.
- **Why it matters:** Hard to tap reliably on mobile; WCAG 2.5.8.
- **Evidence:** Lighthouse `target-size` failure on multiple `.folder-button` (21.7px height).
- **Recommendation:** Increase folder-row min-height to ≥32px.
- **Estimated impact:** Medium (mobile).

---

## 3. Learning Flow — Friction 6/10

**Positives:** The three roadmaps are the best feature — the Foundations roadmap links to **30** real articles, so a structured path genuinely exists. Every article opens with a "Story" hook and closes with Key Takeaways.

### Issue 3.1 — Prerequisites are invisible
- **Problem:** A beginner opening "Consensus Algorithm" is hit with FLP impossibility, quorums, and linearizability with no "read these first" scaffolding.
- **Why it matters:** Concepts are introduced before being explained; beginners get lost. Only a flat "Related Topics" line exists — peers, not ordered prerequisites.
- **Evidence:** `03-Consensus-Algorithm.md` "Related Topics" lists Zookeeper, Distributed-Lock, Distributed-Transactions, CAP-and-PACELC, Gossip-Protocol, Isolation-Levels — no prerequisite ordering.
- **Recommendation:** Add a "Prerequisites" callout (2–3 links) at the top of each article, distinct from "Related." Surface roadmap order per-page.
- **Estimated impact:** High.

### Issue 3.2 — Missing/broken cross-links break the learning graph
- **Problem:** The primary "learn adjacent concept" mechanism largely 404s (see §7).
- **Why it matters:** The exact exploration the site invites is where users hit dead ends.
- **Recommendation:** See §7.

---

## 4. Readability — Friction 5/10

**Positives:** Heading hierarchy, tables, bullet lists, and callouts are all well-formed. Every article ends with Key Takeaways.

### Issue 4.1 — Essay-length walls of text
- **Problem:** Articles run 9–37 minutes; the Consensus article alone has **46 headings** (12×h2, 20×h3, 14×h4) and a TOC taller than the viewport.
- **Why it matters:** "Curated notes" framing implies scannable notes; the reality is textbook chapters. High cognitive load with no top-of-page orientation.
- **Evidence:** Word-count scan — Database-Concepts 37 min, Authorization 28 min, Cryptography-Authentication 27 min, Redis 26 min, Consensus 25 min, DynamoDB 25 min. Heading counts via DOM.
- **Recommendation:** (a) Add a 3-bullet **TL;DR at the top** (mirror the bottom Key Takeaways). (b) Collapse deep-dive/failure-scenario sections into `<details>`. (c) Split 30-min articles.
- **Estimated impact:** High.

### Issue 4.2 — Wide tables scroll on mobile without affordance
- **Problem:** Some tables require horizontal scroll at 390px.
- **Why it matters:** Users may miss off-screen columns.
- **Evidence:** `.table-container` scrollWidth 676 vs client 468 at 390px (wrapped in a scroll container — acceptable but unsignposted).
- **Recommendation:** Add a subtle fade / "scroll →" affordance.
- **Estimated impact:** Low.

---

## 5. Diagram Quality — Friction 8/10 (major)

**Positive — content quality is excellent:** the Paxos sequence diagram has clear labels (`Prepare(n=5)`, `Promise(5,null)`, `Accept(5,v="x")`), color-coded actor lanes, phase boxes, and obvious top-down flow. A user could understand it **without** reading the article. Font size, color usage, and flow direction are all good.

### Issue 5.1 — Every diagram renders as a light image on a WHITE card, in a dark-default site (CRITICAL visual)
- **Problem:** All diagrams embed the light SVG variant, producing a bright white rectangle inside the dark reading flow, on every article.
- **Why it matters:** Jarring theme break site-wide; undermines the otherwise-polished impression and hurts readability. This is the highest visual-quality ROI fix on the site.
- **Evidence:** **All 169 diagram embeds across 49 articles hardcode `.light.svg`; zero use `.dark.svg`.** Built HTML contains 0 `<picture>`/`srcset` theme-swap. Confirmed visually (white Paxos card in dark mode). Crucially, the **dark variants already exist and are correct** — e.g. `Consensus-Algorithm-1.excalidraw.dark.svg` uses `fill="#0d1117"` background with orange accents; the light variant uses `fill="#dcdfe5"`.
- **Recommendation:** Make embeds theme-aware. Fastest: CSS `<picture>` with `.dark.svg`/`.light.svg` sources keyed off `html[saved-theme]`, or a build transformer that emits both variants. The assets are done — this is plumbing.
- **Estimated impact:** High.

### Issue 5.2 — `content-visibility: auto` collapses off-screen diagrams (layout shift)
- **Problem:** Off-screen diagrams collapse to 8×8px and pop to full size on scroll.
- **Why it matters:** Causes layout shift / scrollbar jank while scrolling and can throw off anchor-jump/TOC scroll accuracy.
- **Evidence:** Off-screen interior diagrams measured `clientWidth: 8` (natural 1068–1550px); after `scrollIntoView` they correctly render 716px. Computed `content-visibility: auto`, `contain-intrinsic-size: auto none`.
- **Recommendation:** Set `contain-intrinsic-size` per image's real aspect ratio, or remove `content-visibility:auto` on `article img`.
- **Estimated impact:** Medium.

### Issue 5.3 — No legends on multi-color diagrams
- **Problem:** Color meaning is implicit.
- **Why it matters:** Minor; inline labels mostly compensate.
- **Recommendation:** Add a one-line legend on multi-color diagrams.
- **Estimated impact:** Low.

---

## 6. Information Architecture — Friction 5/10

### Issue 6.1 — Raw numeric-prefixed folder names leak into the UI
- **Problem:** Folder-landing cards show "01-Distributed-Systems", "02-Architecture", "05-API" while the Explorer shows clean names ("Distributed Systems", "API").
- **Why it matters:** Inconsistent naming for the same node breaks the polished mental model.
- **Evidence:** `/01-fundamentals/01-concepts/` folder page cards titled `01-Distributed-Systems`, `05-API`, etc.
- **Recommendation:** Set folder `title:` frontmatter (or a folder-index transform) to strip `NN-` prefixes on display.
- **Estimated impact:** Medium.

### Issue 6.2 — Folder-landing cards are empty boxes
- **Problem:** Cards show a title only — no description, no child count.
- **Why it matters:** Wasted orientation opportunity; large empty rectangles.
- **Evidence:** `/01-concepts/` cards render title-only.
- **Recommendation:** Add a one-line description + item count per card.
- **Estimated impact:** Low–Medium.

### Issue 6.3 — "Concepts" is a semantically empty bucket
- **Problem:** Everything on the site is a concept; this bucket adds a nesting level without adding meaning.
- **Recommendation:** Promote its children (Distributed Systems, Architecture, Data, Caching, API, Security, Operations) directly under Fundamentals.
- **Estimated impact:** Medium.

---

## 7. Discoverability — Friction 8/10 (HEADLINE ISSUE)

### Issue 7.1 — 29% of internal links are dead (404) — CRITICAL
- **Problem:** The site's core value is a connected knowledge graph ("Related Topics" on every page), but most of those links point into the author's **private, unpublished** vault. A reader on Consensus clicks "Zookeeper" → 404 ("This note isn't published yet").
- **Why it matters:** Actively erodes trust and traps the exact exploration the site invites. This is the #1 issue on the site.
- **Evidence (HTTP-verified crawl, not heuristic):** **79 of 274 unique internal links return 404, across 30 of 83 pages.** Breakdown:
  - **~73 links → 37 genuinely unpublished notes:** e.g. `04-cassandra` (8×), `03-consistency-models` (7×), `07-two-phase-locking` (5×), `02-zookeeper` (5×), `03-rate-limiter` (4×), `02-memcached` / `05-mongodb` / `01-elasticsearch` / DDIA chapters (3× each).
  - **6 links → pages that DO exist but are mis-resolved:** `06-backend-for-frontend` and `04-api-protocols-compared`. From `/01-concepts/05-api/*` the emitted href is `../../.././02-architecture/06-backend-for-frontend` — this climbs 3 levels to root instead of 1, landing at `/02-architecture/...` → 404, even though the real page exists at `/01-fundamentals/01-concepts/02-architecture/06-backend-for-frontend` (HTTP 200). Sibling links on the same page use the correct `../../../01-fundamentals/...` form and work — so it is an inconsistent link-resolution bug.
- **Recommendation:**
  1. **Immediately** fix the 6 mis-resolved links (target exists — pure bug).
  2. For the ~73 links to unpublished notes: either render unresolved wikilinks as **non-clickable "coming soon" text** (Quartz can flag broken internal links) or strip them at publish time. Do not ship clickable links to 404s.
  3. Add broken-internal-link detection as a **publish gate**.
- **Estimated impact:** High (Critical).

**Positives:** search is fast and complete; the "Newly Released" rail (production) surfaces recent content; RSS present. No "popular pages" or tag-based "related" beyond the manual line.

---

## 8. User Journeys

1. **Beginner engineer** — Lands, clicks "Foundations Roadmap → START HERE" (good). Struggles: opens a 25-min article with no prereqs/TL;DR, hits FLP impossibility cold, clicks a "Related" link → 404. **Likely abandons at the first dead link.**
2. **Mid-level backend engineer** — Searches "MVCC" (works). Struggles: MVCC's one cross-link (`07-two-phase-locking`) 404s. Otherwise well-served.
3. **Senior engineer** — Skims via TOC (excellent). Wants primary sources on a Paxos claim → **no references section**. Mild credibility ding.
4. **Staff engineer** — Values trade-off framing (present and good). Frustrated by white diagrams breaking flow and dead cross-links to exactly the deep topics they'd want (Spanner internals, service mesh).
5. **Interview candidate** — Best-served persona: "System Design Interviews Roadmap" → 30 linked articles, trade-off narratives, Key Takeaways. Struggles: no prev/next means grinding the roadmap requires constant back-navigation.

**Common abandonment trigger across all five personas: clicking a Related Topic and hitting a 404.**

---

## 9. Accessibility — Friction 6/10 (Homepage a11y 95 / Article 87)

### Issue 9.1 — No `<main>` landmark on any page
- **Problem:** Pages expose only `banner` (header) and `contentinfo` (footer); main content floats in the root with no `main`.
- **Why it matters:** Screen-reader users can't "skip to main content"; WCAG 1.3.1 / landmark best practice. Site-wide.
- **Evidence:** Lighthouse `landmark-one-main` fails on homepage + article; accessibility snapshot shows no `main` node.
- **Recommendation:** Wrap article/body content in `<main>`. One-line template fix.
- **Estimated impact:** High (a11y), Small effort.

### Issue 9.2 — Invalid ARIA: `aria-controls="toc-2"` references a non-existent ID
- **Problem:** The TOC collapse button points `aria-controls` at an ID that doesn't exist.
- **Why it matters:** Breaks assistive-tech association; Lighthouse also reports the accessibility tree as "not well-formed."
- **Evidence:** Lighthouse `aria-valid-attr-value` + `agent-accessibility-tree` failures on articles.
- **Recommendation:** Set `aria-controls` to match the TOC panel `id`.
- **Estimated impact:** Medium.

### Issue 9.3 — Contrast below WCAG AA (4.5:1) on small text
- **Problem:** Muted small text fails AA.
- **Evidence:** `.roadmap-status` badges (START HERE, etc.) = **4.06:1**; search `⌘K` `<kbd>` = **4.27:1** (`#8b8273` on dark backgrounds).
- **Recommendation:** Lighten these foregrounds to ≥4.5:1.
- **Estimated impact:** Medium.

### Issue 9.4 — Search button label/name mismatch + small tap targets
- **Problem:** Search button `aria-label="Search"` vs visible "Search" text mismatch; Explorer folder targets 21.7px (see §2.3).
- **Evidence:** Lighthouse `label-content-name-mismatch` + `target-size`.
- **Recommendation:** Align accessible name with visible text; enlarge targets.
- **Estimated impact:** Low–Medium.

---

## 10. Performance Perception — Friction 2/10 (excellent)

- Fast and light: homepage ~330ms, ~29KB HTML (GitHub Pages + Fastly). Lighthouse **Best Practices 100**. Per-page OG images are WebP.
- **Only real perceived-perf issue:** the `content-visibility` layout shift on diagram reveal (see §5.2). Fixing it cleans up CLS.
- No blocking animations, no heavy initial payload, no obvious layout thrash beyond diagrams.

---

## 11. Content Quality — Friction 4/10

**Strengths:** every article has **Key Takeaways** (46/46), strong narrative hooks, real production anecdotes (Uber MVCC migration, Jim Gray), and explicit trade-off framing.

### Issue 11.1 — Thin citations for a "first principles" site
- **Problem:** Claims about famous work are rarely sourced.
- **Why it matters:** For a senior/staff audience, primary-source links raise credibility; their absence reads as "unfinished."
- **Evidence:** Only **11/46** articles have a References/Sources/Further-Reading heading; only **4/46** link to any external source. The Consensus article name-drops Lamport, FLP (1985), and "Paxos Made Simple" (2001) and links to none.
- **Recommendation:** Add a "References" section linking the primary papers already cited in prose.
- **Estimated impact:** Medium (trust).

### Issue 11.2 — No top-of-page TL;DR and no FAQs
- **Problem:** Summaries exist only at the bottom (Key Takeaways); **0 FAQ** sections.
- **Why it matters:** Readers can't orient before committing to a 25-min read.
- **Evidence:** Frontmatter/heading scan: 46 takeaways/summary sections, 0 FAQ; no top-of-page summary.
- **Recommendation:** Add a top-of-page TL;DR (higher value than FAQ).
- **Estimated impact:** Medium.

---

## 12. Developer Experience — Friction 4/10

### Issue 12.1 — Algorithm articles contain no code/pseudocode
- **Problem:** Prose-and-diagram style with essentially nothing to copy.
- **Why it matters:** A senior/staff audience expects copy-pasteable pseudocode/config on algorithm articles (Paxos, Raft, consistent hashing).
- **Evidence:** DOM `article pre` count = 0 on the 25-min Consensus article.
- **Recommendation:** Add pseudocode blocks with syntax highlighting (Quartz supports it) on algorithm-heavy pages. Verify copy-button + highlighting where code already exists elsewhere.
- **Estimated impact:** Medium.

---

## 13. SEO & Shareability — Friction 5/10

**Strong bones:** valid `og:title/type/url/image` (1200×630 WebP per page), `twitter:card=summary_large_image`, canonical URLs, RSS. Lighthouse **SEO 100**. Clean heading anchors and slugs.

### Issue 13.1 — 89% of articles have no `description` frontmatter
- **Problem:** `<meta name="description">`, `og:description`, and Twitter description all auto-fall-back to the first body sentence — usually the anecdote, literally starting with "The Story Lamport submitted the Paxos paper…".
- **Why it matters:** Every Google snippet and shared LinkedIn/Slack card shows a rambling story fragment instead of "what you'll learn." Directly reduces click-through for a site whose growth depends on sharing.
- **Evidence:** Frontmatter scan — **5 of 46** articles have `description:`, **41 do not**. Live `<meta name="description">` on Consensus = "The Story Lamport submitted the Paxos paper in 1990…". `Load Balancers` (which has a crafted description) demonstrates the correct pattern.
- **Recommendation:** Add a crafted one-sentence `description:` to all 41 missing articles.
- **Estimated impact:** High (reach), Medium effort.

---

## 14. Trust Signals — Friction 4/10

**Trustworthy overall:** real named author with LinkedIn/GitHub/email, "Senior SWE @ LinkedIn," update timestamps ("Jul 25, 2026 · 27 min read"), consistent voice, honest "notes I'm willing to be wrong about" framing.

**Two dents:** (1) dead links everywhere (§7) read as "unfinished/WIP"; (2) missing citations (§11) on claims about famous papers. Fixing both removes the "personal work-in-progress" smell.

---

## 15. Prioritized Roadmap

Legend — **Severity** (Critical/High/Medium/Low) · **Effort** (S/M/L) · **Impact** (High/Medium/Low).

### 🔴 Quick Wins (today — Small effort, high payoff)
1. **Fix the 6 mis-resolved internal links** (BFF, API-Protocols-Compared) — targets exist, pure resolution bug. — Critical / S / High
2. **Add `<main>` landmark** to the page template. — High / S / High (a11y)
3. **Fix `aria-controls="toc-2"`** invalid reference. — Medium / S / Medium
4. **Raise low-contrast tokens** (`.roadmap-status`, `⌘K` kbd) to ≥4.5:1. — Medium / S / Medium
5. **Enlarge Explorer folder tap targets** to ≥32px. — Medium / S / Medium

### 🟠 High-Impact (this week)
6. **Neutralize the ~73 dead cross-links** — render unresolved wikilinks as non-clickable "coming soon" text or strip at build; add a broken-link publish gate. — Critical / M / High  **(#1 overall)**
7. **Wire diagrams to dark variants** (`.dark.svg` in dark mode) — assets already exist. — High / M / High
8. **Add prev/next reading pager** from folder order. — High / M / High
9. **Add `description:` frontmatter** to the 41 missing articles. — High / M / High (SEO/share)
10. **Fix `content-visibility` diagram collapse** (`contain-intrinsic-size`). — Medium / S / Medium

### 🟡 Structural (this month)
11. **Add per-article Prerequisites callout + top-of-page TL;DR.** — High / M / High (learning)
12. **Strip numeric prefixes from folder-index card titles;** add descriptions/counts. — Medium / M / Medium
13. **Flatten the "Concepts" nesting level.** — Medium / M / Medium
14. **Collapse deep-dive sections into `<details>`; split 30-min articles.** — Medium / L / Medium

### 🟢 Long-term Enhancements
15. **Add References / primary-source links** to all algorithm articles. — Medium / L / Medium (trust)
16. **Add pseudocode/code blocks** to algorithm-heavy pages. — Medium / L / Medium (DevEx)
17. **Make sign-in visibly optional;** add "related by tag" / "popular pages." — Low / M / Medium

---

## Appendix — Evidence Log

| Check | Method | Result |
|---|---|---|
| Broken internal links | HTTP-verified crawl of all 83 pages, 274 unique internal links | 79 broken (29%) across 30 pages |
| — misresolved (target exists) | Compare href resolution vs live 200 | 6 occurrences (2 unique: BFF, api-protocols-compared) |
| — unpublished targets | 404 + no source page | ~73 occurrences → 37 unique notes |
| Diagram theme | Grep embeds + built HTML | 169 `.light.svg`, 0 `.dark.svg`; dark variants exist (`#0d1117`) |
| Diagram off-screen collapse | DevTools `evaluate_script` measure | 8×8px off-screen; 716px after scrollIntoView; `content-visibility:auto` |
| Homepage Lighthouse | navigation, desktop | A11y 95, BP 100, SEO 100 |
| Article Lighthouse | navigation, desktop | A11y 87, BP 100, SEO 100 |
| `<main>` landmark | Lighthouse + a11y snapshot | Missing site-wide |
| Invalid ARIA | Lighthouse | `aria-controls="toc-2"` invalid |
| Contrast | Lighthouse | `.roadmap-status` 4.06:1, `⌘K` kbd 4.27:1 |
| Tap targets | Lighthouse | `.folder-button` 21.7px |
| Prev/next pager | DOM query | Absent |
| Search index | `contentIndex.json` | 200, ~1.2MB, 82 pages indexed |
| Folder landing pages | Browser + curl | Populated (e.g. "7 items under this folder") — not dead ends |
| `description:` frontmatter | Frontmatter scan of 46 articles | 5 present, 41 missing |
| References sections | Heading scan | 11/46 have references; 4/46 link external |
| Key Takeaways | Heading scan | 46/46 present |
| Article length | Word-count/220wpm | 9–37 min; many 24–37 min |
| Heading density (Consensus) | DOM count | 46 headings (12 h2 / 20 h3 / 14 h4) |
| Code blocks (Consensus) | DOM `article pre` | 0 |
| Performance | curl timing | ~330ms, ~29KB HTML (Fastly/GitHub Pages) |
| 404 page | curl | Custom "This note isn't published yet" with home link |
