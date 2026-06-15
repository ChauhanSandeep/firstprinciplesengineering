# Phase 5 — Analytics via Plausible

> Branch: `phase-05-analytics` · base: `phase-04-comments`

## Goal

Know which articles get traffic, which entry points convert, which
search queries fail, and which referrers send engaged readers —
without cookies, consent banners, IP storage, or a 35 KB JS payload.

**Recommendation:** **Plausible Cloud** ($9 / month for the smallest
plan). Self-hosted Plausible (Docker) is the $0 alternative if you
want to own the data and don't mind running another container.

## Why Plausible (vs the alternatives)

| Option | Cost | Cookies | Bundle | Verdict |
| --- | --- | --- | --- | --- |
| **Plausible Cloud** | $9 / mo | No | ~1 KB | **Recommended.** |
| Self-hosted Plausible | $0 | No | ~1 KB | Same data, own server. |
| GoatCounter | $0 / cheap | No | ~3 KB | Simpler UI; viable fallback. |
| Umami | $0 (self-host) | Optional | ~2 KB | Heavier UI; more setup. |
| Google Analytics 4 | $0 | **Yes** | ~35 KB | **Rejected.** GDPR consent banner debt + bloated client + privacy concerns conflict with the "minimal, premium" feel. |

## What shipped

### `analytics.config.mjs` (new, repo root)

Single-file Plausible configuration. Ships with:

```js
{
  enabled: false,
  domain: "chauhansandeep.github.io/firstprinciplesengineering",
  scriptHost: "https://plausible.io",
  scriptName: "script.outbound-links.tagged-events.js",
}
```

`scriptName` picks the bundle:

- `script.js` — page views only.
- `script.outbound-links.js` — + outbound link clicks.
- `script.file-downloads.js` — + file download clicks.
- `script.tagged-events.js` — + custom events via `data-*` attrs.
- `script.outbound-links.tagged-events.js` — what we ship (~1 KB
  combined, gives both outbound link tracking and custom event
  capability for future use like "diagram zoomed", "search submitted").

### `scripts/build/inject-analytics.mjs` (new)

Post-build step. Walks every HTML file under `public/`, inserts a
two-line block before `</head>`:

```html
<script data-fpe-analytics="true" defer
        data-domain="…"
        src="https://plausible.io/js/script.outbound-links.tagged-events.js"></script>
<script data-fpe-analytics="true">
window.plausible = window.plausible || function() {
  (window.plausible.q = window.plausible.q || []).push(arguments)
}
</script>
```

The second script is Plausible's recommended queueing shim — it lets
any inline call to `plausible('Some Event')` queue safely while the
deferred bundle is still loading.

Idempotent via `data-fpe-analytics="true"` marker.

### Build wiring

```
… → inject-comments → inject-analytics
```

No-op when `enabled: false`.

## What we'll track (when enabled)

Out of the box (page views only):

- **Top pages** — confirms which articles attract traffic.
- **Entry pages** — where readers start (SEO signal).
- **Referrers** — which external sites drive traffic.
- **Bounce rate** — pages where readers leave without scrolling /
  navigating.
- **Sources / countries / browsers** — coarse audience profile.

Custom events to add **once analytics is live** (one-liner per call
site — left as follow-ups in `phase-05-analytics-events.md` after
enable):

- `plausible('Search Submitted', { props: { q: query } })` —
  inside the search component once a query lands.
- `plausible('Diagram Zoomed')` — from the Phase 10 medium-zoom
  bootstrap.
- `plausible('RSS Subscribe Click')` — from the RSS link in the
  footer.

## Trade-offs

- **$9 / month** — only the cost line item this whole initiative
  adds. Self-hosted Plausible is free if you'd rather. Switch by
  changing `scriptHost` to your self-hosted URL.
- **No real-user latency metrics.** Plausible measures behaviour,
  not performance. For perf metrics, Phase 14's Lighthouse runs are
  the right answer (or hook up `web-vitals` later).
- **DNT respected by default.** Readers with Do-Not-Track on are
  not counted — which is the right behaviour but means the numbers
  understate traffic from privacy-conscious audiences (i.e., the
  engineers we're aiming for).

## Validation

- Build passes with `enabled: false`: `inject-analytics: analytics
  disabled in analytics.config.mjs; skipping`.
- Enabled-path will be verifiable after PR merge by opening the
  live site in DevTools' Network tab — expect one
  `script.outbound-links.tagged-events.js` request (~1 KB) per page
  load + an `/api/event` POST.

## Follow-ups (after enable)

- **Wire custom events** — the three listed above, plus one PR-
  worth of effort to attach `data-analytics-event="…"` markers to
  any link the user wants tracked declaratively.
- **Plausible API → site widget** — once 30 days of data exist,
  consume `https://plausible.io/api/v1/stats/aggregate` to surface
  a "Most popular this month" home-page section (auto-replacing the
  Phase-1 hand-curated Popular list).
- **Dashboard sharing** — Plausible lets you make the dashboard
  public-read with a link. Optional — but a transparency win that
  matches the site's "learning in public" voice.
