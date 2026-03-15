-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create user_notes table
-- Used by EP7 (Authentication) and EP9 (RPC Auth Context)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_notes (
  id         uuid        primary key default gen_random_uuid(),
  author_id  uuid        not null,
  content    text        not null,
  created_at timestamptz not null default now()
);

comment on table public.user_notes is
  'User-owned notes scoped to the authenticated user. Used in EP7 (auth) and EP9 (RPC auth context).';

-- Index on author_id for efficient per-user queries
create index if not exists user_notes_author_id_idx on public.user_notes (author_id);

-- Enable RLS — this is the baseline state for EP7 and EP9.
-- Querying without a valid session returns empty results with no error.
alter table public.user_notes enable row level security;

create policy "user_notes: owner select"
  on public.user_notes
  for select
  using (author_id = auth.uid());

create policy "user_notes: owner insert"
  on public.user_notes
  for insert
  with check (author_id = auth.uid());

create policy "user_notes: owner delete"
  on public.user_notes
  for delete
  using (author_id = auth.uid());
