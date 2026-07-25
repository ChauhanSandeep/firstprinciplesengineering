# Reader engagement — Supabase-backed likes, comments & read tracking

This adds a **seamless, sign-in-capable** engagement layer to the otherwise
static Quartz site: one-click Google (or email magic-link) sign-in, a global
header account chip, a like button with a live count, inline in-page comments,
a "mark as read" control that syncs across a reader's devices, a personal
`/account` page, and an auth-aware homepage. This **replaces** the retired
Cusdis/Giscus comment integration — comments are now backed by our own
Supabase project and tied to a real sign-in.

It is **opt-in and reversible**, mirroring `analytics.config.mjs`. While
disabled, nothing is injected and the build is unchanged.

## Why this instead of the full "members app" rewrite

The Quartz site stays static and free on GitHub Pages, keeping math,
backlinks, graph, search, and the folder hierarchy. Only per-reader
engagement (likes, reads, comments) lives in a managed Supabase project —
**no article content is ever uploaded**, there is **no paywall**, and there
is **no server to operate**. If you later want paid content, Stripe bolts
onto the same Supabase project without throwing any of this away.

## Moving parts

| File | Role |
| --- | --- |
| `engagement.config.mjs` | Opt-in flag, Supabase URL + anon key, feature toggles, auth providers. Shared by every piece below. |
| `supabase/schema.sql` | Tables + row-level security + grants. Run once in Supabase. |
| `content/_static/engagement.js` | The article widget (auth, likes, comments, read state). Served at `/_static/engagement.js`. Also records a per-article "last visited" marker used by the homepage. |
| `content/_static/header-auth.js` | The global header account chip (sign-in popover / avatar menu). Served at `/_static/header-auth.js`. |
| `content/account.md` + `content/_static/account.js` | The `/account` page: editable profile, your Liked / Read / Commented activity, sign out, delete-my-data. |
| `content/_static/home-personalize.js` | Homepage "Continue reading" strip + "Read" badges on cards. |
| `scripts/build/inject-engagement.mjs` | Mounts the article widget on every article page (skips home, about, account, tags, indexes). |
| `scripts/build/inject-header-auth.mjs` | Mounts the account chip into the top navigation bar on **every** page. |
| `scripts/build/inject-account.mjs` | Wires the hydration script into `/account`. |
| `scripts/build/inject-home-personalize.mjs` | Adds the personalization mount + script to the homepage (after `inject-home-rail`). |

The injectors are wired into `npm run build` / `npm run build:soft` after
`inject-prev-next-related`. Run any standalone, e.g. `npm run inject-engagement`
or `npm run inject-account`.

The old Cusdis/Giscus integration (`comments.config.mjs`,
`scripts/build/inject-comments.mjs`, and the Cusdis theme-sync helper in
`quartz/static/site.js`) has been removed — comments are now owned by this
Supabase layer.

## One-time setup

1. **Create a project** at <https://supabase.com> (free tier is plenty).
2. **Run the schema**: SQL editor → paste `supabase/schema.sql` → Run.
   (Creates `profiles`, `article_likes`, `article_reads`,
   `article_comments`, all with RLS.)
3. **Enable auth**: Authentication → Providers.
   - Turn on **Google** (recommended) — follow Supabase's Google OAuth guide.
   - Email magic-link is on by default; no SMTP needed at low volume.
   - Under **URL Configuration**, add to the allowed redirect URLs:
     - `https://firstprinciplesengineering.tech/**`
     - `http://localhost:8080/**` (for `npm run serve`)
4. **Copy keys**: Project Settings → API → copy the **Project URL** and the
   **anon public** key into `engagement.config.mjs`.
   The anon key is browser-safe — RLS, not key secrecy, protects the data.
   **Never** put the `service_role` key here.
5. **Enable + build**: set `enabled: true` in `engagement.config.mjs`, then
   `npm run build` (or `npm run serve` to preview locally).

## Account page & homepage personalization

- **Account chip** — every page shows a "Sign in" button (signed out) or the
  reader's avatar + name with an **Account / Sign out** menu (signed in), at the
  right edge of the full-width top navigation bar (`.fpe-topbar-actions`). Its
  popover opens leftward so it never overflows the viewport.
- **`/account`** — authored in `content/account.md` (kept across vault syncs
  via the preserve list in `scripts/sync-from-vault.mjs`). Signed in, it shows
  an editable display name (seeded from the Google profile), and the reader's
  **Liked / Read / Commented** articles (slugs resolved to titles via the
  static `/static/contentIndex.json`). "Delete my data" removes the reader's
  own likes, reads, comments, and profile rows (RLS-permitted) and signs them
  out. (A full auth-user deletion needs the service role and is out of scope.)
- **Homepage** — a "Continue reading" strip surfaces recently visited but
  unfinished articles (from the `fpe:last:*` markers the article widget
  writes), and finished articles get a small "Read" badge on their cards.
  These are localStorage-first (instant) and backfilled from `article_reads`
  when signed in.

## Moderation

Comments default to visible. To hide one without deleting history, open the
`article_comments` row in the Supabase table editor and set `hidden = true`.
Authors can edit/delete their own comments; hidden rows disappear for
everyone else via RLS.

## Feature toggles

Turn any capability off in `engagement.config.mjs` → `features` (e.g. ship
likes + read-state without comments). "Mark as read" also works **before**
sign-in via `localStorage`, then syncs up on first sign-in.

## Rolling back

Set `enabled: false` and rebuild — none of the pieces (article widget, header
chip, `/account` hydration, homepage personalization) are injected. The
`/account` page still builds but shows "not configured"; remove
`content/account.md` if you want it gone entirely. Nothing else in the site
depends on this layer.
