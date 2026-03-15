# EP8 — Realtime Subscription Lifecycle

**Pattern introduced:** Publication table validation — assert a table is in the supabase_realtime publication before relying on live updates

---

## What this episode covers

A Supabase Realtime subscription opens without errors, but INSERT events never arrive. The subscription channel reaches `SUBSCRIBED` status and appears healthy — but the events are silently dropped. The root cause is that the table was removed from the `supabase_realtime` publication, so the database WAL stream never sends changes for it. We trace the publication membership, diagnose the missing table, restore it, and verify the full subscription lifecycle end-to-end.

---

## What the viewer learns

- How `supabase_realtime` is a PostgreSQL logical replication publication — and why tables must be explicitly listed
- Why removing a table from the publication causes silent event loss (no error from Postgres, no error from the JS client)
- How to query `pg_publication_tables` to verify what tables are in the publication
- The correct subscription lifecycle: wait for `SUBSCRIBED` → insert → wait for event
- Why `ALTER PUBLICATION supabase_realtime ADD TABLE` is the fix — not a realtime config toggle

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep8:reset` | Restores baseline — receipts in publication | Output: `✔ reset complete` |
| 2 | `pnpm ep8:break` | Drops receipts from supabase_realtime publication | Output: confirms receipts gone from pg_publication_tables |
| 3 | `pnpm ep8:run` | Opens subscription, inserts row, waits for event | **6-second timeout — event never arrives** |
| 4 | `pg_publication_tables` query | Shows publication membership | No receipts row |
| 5 | `pnpm ep8:fix` | Adds receipts back to publication | Output: confirms receipts in pg_publication_tables |
| 6 | `pnpm ep8:run` | Same subscription loop | **Event received immediately after insert** |
| 7 | `pnpm ep8:verify` | Full lifecycle verification | `✔ EP8 PASSED` |
| 8 | `pnpm ep8:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep8:reset
pnpm ep8:break
```

**Say:** "`ep8:reset` resets the database. `ep8:break` removes the receipts table from the `supabase_realtime` publication. The table still exists, RLS has nothing to do with this — it's purely a publication membership issue."

---

### 2 · Reproduce

```bash
pnpm ep8:run
```

**Expected output:**
```
⚠  receipts is NOT in supabase_realtime publication
  → You are in a BROKEN state. Events will NOT arrive (silent timeout).

Channel status: SUBSCRIBED
✔ Channel subscribed — now inserting a row via service_role
✔ Row inserted — waiting for realtime event...

⚠  No event received within 6s — subscription timed out silently.

  Root cause: receipts table is not in the supabase_realtime publication.
  Fix: ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
  Or:  pnpm ep8:fix
```

**Say:** "The channel says `SUBSCRIBED`. The insert worked. But the event never comes. Six seconds pass. Silence. This is the most confusing Realtime failure mode — everything looks healthy, the bug is invisible at the client layer."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
```

**Expected:** No row with `tablename = receipts`.

**Say:** "`pg_publication_tables` shows exactly which tables are in the publication. Supabase Realtime uses PostgreSQL logical replication — the database decides what to stream. If the table isn't in this list, no changes flow, regardless of subscription status."

Show what it looks like when it's present:

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;"

docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
```

Revert for the fix demo:

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "ALTER PUBLICATION supabase_realtime DROP TABLE public.receipts;"
```

---

### 4 · Fix

```bash
pnpm ep8:fix
```

**Say:** "`ep8:fix` runs `ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts`. That's the entire fix — one SQL statement that tells the WAL stream to include this table."

---

### 5 · Confirm

```bash
pnpm ep8:run
```

**Expected output:**
```
✔ receipts is in supabase_realtime publication ✔
Channel status: SUBSCRIBED
✔ Channel subscribed — now inserting a row via service_role
✔ Row inserted — waiting for realtime event...
✔ INSERT event received ✔
  payload.new: { id: "...", title: "EP8 run receipt", amount: 8.08 }

Result:
  Event received — Realtime is working correctly.
```

**Say:** "Same code, same subscription, same insert — but now the event arrives. The fix was entirely on the Postgres side."

---

### 6 · Verify

```bash
pnpm ep8:verify
```

**Expected output:**
```
✔ Publication preflight: receipts in supabase_realtime
✔ Channel status: SUBSCRIBED
✔ INSERT event received ✔
✔  EP8 PASSED
```

---

### 7 · Reset

```bash
pnpm ep8:reset
```

---

## Outro script

> "The pattern: before adding any Realtime subscription, check `pg_publication_tables`. One query tells you whether events will arrive. If the table isn't in that list, no client-side code will fix it.
>
> ALTER PUBLICATION supabase_realtime ADD TABLE — that's the fix.
>
> Here's the prompt for your agent."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: RPC auth context — when a PostgreSQL function silently returns empty instead of raising an error."

---

## The bug (reference)

**Root cause:** `public.receipts` was removed from the `supabase_realtime` PostgreSQL logical replication publication. The WAL stream no longer includes changes for that table.

**Broken state confirmation:**
```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- receipts is absent
```

**Fix:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
```
