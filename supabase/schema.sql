-- =========================================================================
-- First Principles Engineering — reader engagement schema (Supabase)
-- =========================================================================
-- Run this once in the Supabase SQL editor for the project referenced by
-- engagement.config.mjs. It provisions the tables the reader-engagement
-- widget uses (content/_static/engagement.js) plus row-level security and
-- grants.
--
-- Design notes / threat model:
--   * NO article content is stored here. Bodies live only in Quartz's
--     static HTML on GitHub Pages. These tables hold per-reader
--     engagement keyed by page `slug` (the Quartz URL path), nothing else.
--   * There is no paywall / premium gating. Every article is public, so
--     the only per-user data is likes, reads, and comments — all low-risk.
--   * RLS is the security boundary. The browser ships the anon key; these
--     policies (not key secrecy) are what stop a reader from writing
--     someone else's row or reading another reader's private read-state.
--   * Idempotent: safe to re-run. Uses IF NOT EXISTS + drop-then-create
--     for policies.
-- =========================================================================

-- Needed for gen_random_uuid(). On Supabase this is usually already on.
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- profiles — public display identity, 1:1 with auth.users
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Auto-provision a profile row when a new auth user is created, seeding
-- display_name / avatar from the OAuth metadata when present.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- article_likes — one row per (slug, user). Presence == liked.
-- -------------------------------------------------------------------------
create table if not exists public.article_likes (
  slug       text        not null,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slug, user_id)
);
create index if not exists article_likes_slug_idx on public.article_likes (slug);

-- -------------------------------------------------------------------------
-- article_reads — per-reader "I finished this". Private to the reader.
-- -------------------------------------------------------------------------
create table if not exists public.article_reads (
  slug    text        not null,
  user_id uuid        not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (slug, user_id)
);

-- -------------------------------------------------------------------------
-- article_comments — one-level threads, plain text.
-- -------------------------------------------------------------------------
create table if not exists public.article_comments (
  id         uuid primary key default gen_random_uuid(),
  slug       text        not null,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  parent_id  uuid        references public.article_comments (id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 4000),
  hidden     boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists article_comments_slug_idx
  on public.article_comments (slug, created_at);

-- =========================================================================
-- Row-level security
-- =========================================================================
alter table public.profiles         enable row level security;
alter table public.article_likes    enable row level security;
alter table public.article_reads    enable row level security;
alter table public.article_comments enable row level security;

-- ---- profiles: world-readable, self-writable ----------------------------
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (true);

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- article_likes: public read (for counts), owner writes --------------
drop policy if exists likes_select_public on public.article_likes;
create policy likes_select_public on public.article_likes
  for select using (true);

drop policy if exists likes_insert_own on public.article_likes;
create policy likes_insert_own on public.article_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists likes_delete_own on public.article_likes;
create policy likes_delete_own on public.article_likes
  for delete using (auth.uid() = user_id);

-- ---- article_reads: fully private to the reader -------------------------
drop policy if exists reads_select_own on public.article_reads;
create policy reads_select_own on public.article_reads
  for select using (auth.uid() = user_id);

drop policy if exists reads_insert_own on public.article_reads;
create policy reads_insert_own on public.article_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists reads_delete_own on public.article_reads;
create policy reads_delete_own on public.article_reads
  for delete using (auth.uid() = user_id);

-- ---- article_comments: public read of visible rows, owner writes --------
-- Non-hidden comments are readable by anyone. Authors can insert/edit/
-- delete their own. (Moderation: flip `hidden = true` from the Supabase
-- dashboard to hide a comment without deleting history.)
drop policy if exists comments_select_public on public.article_comments;
create policy comments_select_public on public.article_comments
  for select using (hidden = false or auth.uid() = user_id);

drop policy if exists comments_insert_own on public.article_comments;
create policy comments_insert_own on public.article_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists comments_update_own on public.article_comments;
create policy comments_update_own on public.article_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comments_delete_own on public.article_comments;
create policy comments_delete_own on public.article_comments
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Grants — RLS narrows these; grants make the tables reachable at all.
-- =========================================================================
grant usage on schema public to anon, authenticated;

-- anon (signed-out visitors): read-only where a public policy allows it.
grant select on public.profiles         to anon, authenticated;
grant select on public.article_likes    to anon, authenticated;
grant select on public.article_comments to anon, authenticated;

-- authenticated readers: write their own engagement.
grant select, insert, update, delete on public.profiles         to authenticated;
grant insert, delete                 on public.article_likes    to authenticated;
grant select, insert, delete         on public.article_reads    to authenticated;
grant insert, update, delete         on public.article_comments to authenticated;

-- =========================================================================
-- Comment integrity — trigger-enforced invariants that RLS alone can't do
-- =========================================================================
-- Threat: `comments_update_own` (above) lets an author UPDATE their own row.
-- RLS can gate *which* rows and *who*, but not *which columns* changed, so a
-- signed-in author could otherwise flip `hidden = false` to un-hide a
-- comment a moderator hid, or rewrite `slug`/`parent_id`/`created_at`. This
-- BEFORE UPDATE trigger pins every column except `body` to its previous
-- value when the caller is the row's author, so authors may only edit text.
--
-- Moderation still works: dashboard / service-role updates run with
-- `auth.uid()` = NULL, which bypasses the pin so a moderator can set
-- `hidden = true` (or any column). `updated_at` is always refreshed.
create or replace function public.enforce_comment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Author edits (auth.uid() matches the row owner): only `body` may change.
  if auth.uid() is not null and auth.uid() = old.user_id then
    new.user_id    := old.user_id;
    new.slug       := old.slug;
    new.parent_id  := old.parent_id;
    new.hidden     := old.hidden;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_update on public.article_comments;
create trigger trg_enforce_comment_update
  before update on public.article_comments
  for each row execute function public.enforce_comment_update();

-- Rolling-window insert rate limit: at most 5 comments per author per 60s.
-- Blocks comment-spam / flooding at the DB layer (independent of any
-- client-side throttle). Service-role inserts (auth.uid() IS NULL) are
-- exempt so backfills / migrations aren't throttled.
create or replace function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  select count(*) into recent
  from public.article_comments
  where user_id = new.user_id
    and created_at > now() - interval '60 seconds';
  if recent >= 5 then
    raise exception 'rate limit: too many comments, please wait a moment'
      using errcode = '53400';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_rate_limit on public.article_comments;
create trigger trg_enforce_comment_rate_limit
  before insert on public.article_comments
  for each row execute function public.enforce_comment_rate_limit();
