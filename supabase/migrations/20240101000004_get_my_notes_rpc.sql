-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Broken baseline for get_my_notes() RPC
-- Episode 9 intentionally starts with this unguarded version.
-- EP9 fix.ts replaces it with a hardened version that includes:
--   • auth.uid() null guard (raises explicit error when unauthenticated)
--   • explicit search_path
--   • scoped EXECUTE grants (authenticated only, not anon)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_notes()
returns setof public.user_notes
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  -- ❌ BUG: no null guard on auth.uid()
  -- If the caller has no active session, auth.uid() returns NULL.
  -- WHERE author_id = NULL matches no rows → silent empty result.
  -- The caller cannot tell if: (a) there are no notes, or (b) they are not authenticated.
  return query
    select * from public.user_notes
    where author_id = auth.uid();
end;
$$;

comment on function public.get_my_notes() is
  'Returns notes owned by the authenticated user. EP9 baseline: deliberately unguarded — no auth.uid() null check.';

-- Intentionally grant to anon so the silent-failure bug is reproducible
grant execute on function public.get_my_notes() to anon, authenticated;
