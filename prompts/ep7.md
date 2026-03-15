# EP7 — Authentication & Row Level Security

**Pattern introduced:** 3-state auth validation — assert all three RLS auth states (no session, wrong session, owner session)

---

## What this episode covers

A Supabase query returns an empty array even though rows exist in the table. RLS is enabled with auth.uid() policies. Because the client has no active session, `auth.uid()` returns null — and the RLS policy quietly filters every row. There's no error, no hint, just empty data. We trace the three possible auth states, diagnose which one is producing the empty result, and confirm the owner session is the only one that surfaces the data.

---

## What the viewer learns

- Why `auth.uid()` returns null when no JWT is present, and what that means for RLS policies
- The 3-state reality of auth-gated data: no session / wrong user / owner — all return different things
- How to distinguish an RLS empty-set from a genuine no-data condition
- How to trace an active JWT session and verify it matches the row's `author_id`
- Why the right fix is ensuring your client has a valid session before calling the query

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep7:reset` | Restores baseline — user_notes table with RLS enabled | Output: `✔ reset complete` |
| 2 | `pnpm ep7:break` | Seeds a note, confirms RLS is on | Output: confirms relrowsecurity |
| 3 | `pnpm ep7:run` | Calls user_notes with no session, then wrong session | **Both return empty — the silent bug** |
| 4 | `pg_policies` query | Shows RLS policies on user_notes | SELECT policy using `auth.uid()` |
| 5 | `pnpm ep7:fix` | Shows the 3 states side-by-side, including owner session | **owner session returns rows** |
| 6 | `pnpm ep7:verify` | Asserts all 3 states with real auth users | `✔ EP7 PASSED` |
| 7 | `pnpm ep7:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep7:reset
pnpm ep7:break
```

**Say:** "`ep7:reset` resets the database. `ep7:break` seeds a note and confirms RLS is active — the table has rows, and the policies use `auth.uid()`. The stage is set for the silent empty."

---

### 2 · Reproduce

```bash
pnpm ep7:run
```

**Expected output:**
```
State 1 — No session (unauthenticated)
  Result: []

⚠  State 1: Empty result — silent failure (the bug). No error, no indication of why.

State 2 — Wrong user session (other user)
  Result: []

✔ State 2: Empty result — correct (other user's notes not visible)
```

**Say:** "Two calls, two empty arrays, zero errors. A developer staring at this output has no idea whether the table is empty, RLS is blocking them, or they forgot to sign in. States 1 and 2 are indistinguishable without checking the auth session explicitly."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_notes';"

docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'user_notes';"
```

**Expected:** `relrowsecurity = t` and policies with `auth.uid()` in the qual.

**Say:** "`relrowsecurity = t` — RLS is on. The SELECT policy filters with `author_id = auth.uid()`. When there's no session, `auth.uid()` returns null. In Postgres, `null = null` is false. Every row is filtered out. Not an error — just silence."

---

### 4 · Fix

```bash
pnpm ep7:fix
```

**Say:** "`ep7:fix` demonstrates all three states with a real owner session. The key step is signing in with `signInWithPassword` before calling the query — that's all it takes. The JWT populates `auth.uid()` inside the RLS evaluation."

---

### 5 · Verify

```bash
pnpm ep7:verify
```

**Expected output:**
```
✔ State 1 (no session):    empty — correct, no data leaked
✔ State 2 (wrong user):    empty — RLS scoped correctly
✔ State 3 (owner session): rows returned ✔
✔  EP7 PASSED
```

**Say:** "Three assertions, covering the full auth surface. The agent pattern here is to always test all three states when validating an auth-gated query — not just the happy path."

---

### 6 · Reset

```bash
pnpm ep7:reset
```

---

## Outro script

> "The pattern: any time you're debugging a Supabase query that returns empty — check `auth.uid()` first. Is there a session? Is it the right user? These two questions cover 90% of RLS empty-result bugs.
>
> Three states: no session, wrong user, owner. All three need to return the right thing.
>
> Here's the prompt for your agent."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: Realtime subscriptions — how a single ALTER PUBLICATION command silently stops all your live updates."

---

## The bug (reference)

**Root cause:** RLS SELECT policy uses `author_id = auth.uid()`. With no session, `auth.uid()` is null. `null = null` evaluates to false in SQL — every row is filtered out.

**Broken state confirmation:**
```
State 1 (no session)    : [] ← empty, no error
State 2 (wrong user)    : [] ← empty, no error
-- same output, different root cause
```

**Fix:**
```typescript
await client.auth.signInWithPassword({ email, password });
const { data } = await client.from("user_notes").select("*");
// → returns the signed-in user's rows
```
