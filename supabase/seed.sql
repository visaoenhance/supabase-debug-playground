-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Minimal baseline data
-- Run via `pnpm supabase:seed` or `supabase db reset`
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed a demo profile (used as FK target in receipt inserts)
insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com')
on conflict (email) do nothing;

-- Seed a couple of receipts owned by alice
insert into public.receipts (id, user_id, title, amount)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Seed receipt – coffee',
    4.50
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Seed receipt – lunch',
    14.00
  )
on conflict (id) do nothing;
