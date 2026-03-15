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

-- ── EP10 seed: 10,000 time-spread receipts for query performance testing ──────
-- created_at is spread across 10,000 hours (~14 months of history).
-- A 7-day date range covers ~168 rows (1.7% selectivity) — reliably triggers
-- Index Scan after fix and Seq Scan after drop (confirmed with ANALYZE).
insert into public.receipts (user_id, title, amount, created_at)
select
  case when (i % 2 = 0)
    then '00000000-0000-0000-0000-000000000001'::uuid
    else '00000000-0000-0000-0000-000000000002'::uuid
  end,
  'EP10 receipt #' || i,
  round((1 + (i % 200))::numeric, 2),
  now() - (i || ' hours')::interval
from generate_series(1, 10000) i
on conflict do nothing;
