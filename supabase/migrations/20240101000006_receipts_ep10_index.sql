-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add created_at index for EP10 (Query Performance)
-- EP10 break.ts drops this index to demonstrate a sequential scan.
-- EP10 fix.ts recreates it to demonstrate an index scan via EXPLAIN ANALYZE.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists receipts_created_at_idx
  on public.receipts (created_at desc);

comment on index receipts_created_at_idx is
  'Descending index on receipts.created_at — used by EP10 to demonstrate seq scan vs index scan.';
