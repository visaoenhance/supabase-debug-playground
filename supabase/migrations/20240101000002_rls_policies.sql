-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Baseline RLS policies
-- Episode 4 intentionally manipulates these via scripts/ep4_rls.ts
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Anyone can read profiles (demo simplicity)
create policy "profiles: public read"
  on public.profiles
  for select
  using (true);

-- Only the owner can update their own profile
create policy "profiles: owner update"
  on public.profiles
  for update
  using (id = auth.uid());

-- ── receipts ─────────────────────────────────────────────────────────────────
-- RLS is DISABLED at baseline so that all episodes work before ep4 is set up.
-- ep4:break enables RLS and then removes the insert policy, demonstrating
-- the classic "RLS blocks anonymous inserts" failure.
alter table public.receipts disable row level security;

-- The policies below exist but are inactive until RLS is enabled.
-- ep4:verify re-enables RLS AND these policies are already present.
create policy "receipts: owner read"
  on public.receipts
  for select
  using (user_id = auth.uid());

create policy "receipts: authenticated insert"
  on public.receipts
  for insert
  with check ((select auth.role()) = 'authenticated');

create policy "receipts: owner delete"
  on public.receipts
  for delete
  using (user_id = auth.uid());
