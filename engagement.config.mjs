/**
 * engagement.config.mjs
 *
 * Configuration for the Supabase-backed reader engagement widget injected
 * into every article page by scripts/build/inject-engagement.mjs.
 *
 * This is the seamless, sign-in-capable layer that Cusdis/Giscus can't
 * give you: Google one-click auth, a like button, inline (in-page)
 * comments, and a "mark as read" control that syncs across a reader's
 * devices once they sign in. The Quartz site stays fully static and free
 * on GitHub Pages; only per-reader engagement data lives in Supabase.
 *
 * IMPORTANT — this touches NO article content. Bodies are never uploaded
 * anywhere; the widget only reads/writes likes, reads, and comments keyed
 * by page slug. There is no paywall and no content gating here.
 *
 * Status — placeholder. To enable:
 *
 *   1. Create a free project at https://supabase.com.
 *   2. In the SQL editor, run the schema in `supabase/schema.sql`
 *      (creates tables + row-level security + grants).
 *   3. Authentication → Providers → enable Google (and/or leave email
 *      magic-link on, which is enabled by default).
 *      Add your site + localhost to the allowed redirect URLs:
 *        https://firstprinciplesengineering.tech/**
 *        http://localhost:8080/**
 *   4. Project Settings → API → copy the Project URL and the *anon*
 *      public key into `supabaseUrl` / `supabaseAnonKey` below.
 *      (The anon key is safe to ship to the browser — RLS is what
 *      protects the data, not key secrecy. Never put the service_role
 *      key here.)
 *   5. Set `enabled: true` and run `npm run build`.
 *
 * Until enabled (or while the keys are placeholders), inject-engagement
 * logs "disabled" and exits without touching any HTML — the build is
 * unaffected, exactly like inject-analytics.
 */

export default {
  // Flip to true after the Supabase project + schema + keys below are real.
  enabled: true,

  // ---- Supabase connection -----------------------------------------------
  // Project URL, e.g. "https://abcdefgh.supabase.co".
  supabaseUrl: "https://elxquponajrtsvviorck.supabase.co",
  // The *anon* public key (Project Settings → API). Browser-safe.
  // NEVER put the service_role key here.
  supabaseAnonKey: "sb_publishable_Ol4LBLcMNSF2cagSCeIKug_gp30yluw",

  // ---- Feature toggles ----------------------------------------------------
  // Each maps to a table in supabase/schema.sql. Turn any of these off to
  // ship a smaller widget without provisioning that table.
  features: {
    likes: true, // article_likes  — one-tap like + live count
    comments: true, // article_comments — inline one-level threads (plain text)
    readState: true, // article_reads  — mark-as-read (localStorage + synced)
  },

  // ---- Auth ---------------------------------------------------------------
  auth: {
    // OAuth providers to surface as one-click sign-in buttons. Must also
    // be enabled in the Supabase dashboard (Authentication → Providers).
    // "google" is the seamless default for a technical audience.
    oauthProviders: ["google"],
    // Show an email magic-link option as a no-account-needed fallback.
    // Supabase's email provider is on by default; no SMTP setup required
    // for the built-in flow at low volume.
    emailMagicLink: true,
  },

  // ---- Comments behaviour -------------------------------------------------
  comments: {
    // Plain text only (no HTML/markdown rendering) — matches the Zod-style
    // min/max the schema enforces. Keep small to deter spam walls.
    maxLength: 4000,
    // One level of replies (a comment can reply to a top-level comment,
    // but replies can't be replied to). Set false for a flat list.
    allowReplies: true,
  },
}
