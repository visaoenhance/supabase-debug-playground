-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add receipts to supabase_realtime publication
-- Baseline for EP8 (Realtime: Subscription Not Receiving Events).
-- EP8 break.ts removes receipts from the publication; fix.ts adds it back.
-- ─────────────────────────────────────────────────────────────────────────────

-- The supabase_realtime publication is created by Supabase automatically.
-- Tables must be explicitly added to receive change events.
alter publication supabase_realtime add table public.receipts;
