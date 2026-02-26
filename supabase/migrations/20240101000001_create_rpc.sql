-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create RPC helper
-- Function: create_receipt(title text, amount numeric) returns receipts
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.create_receipt(
  title  text,
  amount numeric
)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  new_receipt public.receipts;
begin
  -- Structured log visible in `supabase db logs` output
  raise notice 'create_receipt » title=%, amount=%', title, amount;

  insert into public.receipts (title, amount)
  values (title, amount)
  returning * into new_receipt;

  raise notice 'create_receipt » created id=%', new_receipt.id;
  return new_receipt;
end;
$$;

comment on function public.create_receipt(text, numeric) is
  'Inserts a new receipt and returns the full row. Episode 2 target.';

-- Grant execute to authenticated + anon roles so we can demo both
grant execute on function public.create_receipt(text, numeric)
  to authenticated, anon, service_role;
