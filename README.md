# Supabase Debug Playground

A **5-episode video series** repo demonstrating common Supabase debugging scenarios.  
Each episode has a **break → run → fix → verify** workflow you can execute entirely from the terminal — no dashboard required.

---

## File Tree

```
supabase-debug-playground/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
│
├── scripts/
│   ├── utils.ts                  ← shared helpers (clients, logging, state)
│   ├── ep1_edge_function.ts
│   ├── ep2_rpc.ts
│   ├── ep3_crud.ts
│   ├── ep4_rls.ts
│   ├── ep5_schema_drift.ts
│   └── reset.ts
│
└── supabase/
    ├── seed.sql
    ├── types.gen.ts              ← generated; git-ignored until ep5:verify
    ├── functions/
    │   ├── echo/
    │   │   ├── index.ts          ← active (good) version
    │   │   ├── index.broken.ts   ← intentional bugs for ep1:break
    │   │   └── index.baseline.ts ← auto-created on first ep1:break run
    │   └── secure-write/
    │       └── index.ts
    └── migrations/
        ├── 20240101000000_create_tables.sql
        ├── 20240101000001_create_rpc.sql
        └── 20240101000002_rls_policies.sql
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Supabase CLI | ≥ 1.200 | `brew install supabase/tap/supabase` |
| Docker Desktop | any | https://www.docker.com/products/docker-desktop |

---

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/your-org/supabase-debug-playground
cd supabase-debug-playground
pnpm install

# 2. Start local Supabase (requires Docker running)
pnpm supabase:start

# 3. Copy env and fill in values printed by the command above
cp .env.example .env
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_ANON_KEY=<anon key from output>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key from output>

# 4. Seed the database
pnpm supabase:seed

# 5. Start the edge function server (keep this terminal open)
supabase functions serve --no-verify-jwt

# 6. In a new terminal — run any episode
pnpm ep1:break && pnpm ep1:run
# ... watch the failure, then:
pnpm ep1:verify

# 7. Reset everything back to baseline at any time
pnpm reset
```

---

## Episode Commands

### Episode 1 — Edge Function Logging

> **Concept**: Diagnose opaque 500 errors from edge functions using `request-id` and structured JSON logs.

| Command | What happens |
|---------|-------------|
| `pnpm ep1:break` | Overwrites `echo/index.ts` with a version that crashes on every request (missing env var, no try/catch, no request_id) |
| `pnpm ep1:run` | POSTs to the echo function, prints status code + response body |
| `pnpm ep1:verify` | Asserts HTTP 200 and `request_id` present in response |

**Fix guide** (after `ep1:run` shows failure):
1. Open `supabase/functions/echo/index.broken.ts` and read the `// ❌ BUG` comments
2. The bugs are: accessing `Deno.env.get(...)` that returns `undefined`, then calling `.length` on it
3. The fix is already in `index.ts` (the baseline): wrap everything in try/catch, guard env vars, always propagate `request-id`
4. Run `pnpm reset` to restore the good version, then `pnpm ep1:verify`

**Expected output (broken)**:
```
✘  Expected 200, got 500
✘  request_id missing from response body
```

**Expected output (verified)**:
```
✔  HTTP 200 received
✔  request_id present in response: <uuid>
✔  Response body contains { ok: true }
✔  EP1 PASSED
```

---

### Episode 2 — RPC Debugging

> **Concept**: Read Supabase RPC error objects (`code`, `message`, `hint`) and use `RAISE NOTICE` for server-side logging.

| Command | What happens |
|---------|-------------|
| `pnpm ep2:break` | Replaces `create_receipt` SQL function with a version that INSERT-s into a non-existent column (`titl`) |
| `pnpm ep2:run` | Calls the RPC and prints the complete Supabase error object |
| `pnpm ep2:verify` | Restores correct SQL + calls RPC + asserts returned receipt |

**Fix guide**:
1. `ep2:run` prints `error.code: 42703` (column does not exist) and the bad column name
2. Open `supabase/migrations/20240101000001_create_rpc.sql` and see the correct version
3. `ep2:verify` applies the fixed SQL automatically

**Expected output (broken)**:
```
✘  RPC returned an error
  code    : 42703
  message : column "titl" of relation "receipts" does not exist
```

---

### Episode 3 — CRUD "Did it save?"

> **Concept**: `.insert()` without `.select()` returns `{ data: null, error: null }` on success — this is not a confirmation.

| Command | What happens |
|---------|-------------|
| `pnpm ep3:break` | Saves a flag that activates the broken pattern |
| `pnpm ep3:run` | Runs the broken insert (no `.select()`) and shows `data: null` alongside "success" |
| `pnpm ep3:verify` | Runs the fixed insert (`.select().throwOnError()`) and prints the returned row id |

**Fix guide**:
```ts
// ❌ Broken: no way to confirm the row was saved
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount });
// data is always null; error may be ignored

// ✔ Fixed: get the row back + throw on any error
const { data } = await supabase
  .from("receipts")
  .insert({ title, amount })
  .select()        // ← forces PostgREST to return the row
  .throwOnError(); // ← turns any error into a thrown exception
```

---

### Episode 4 — RLS / Policy vs Keys

> **Concept**: RLS + missing INSERT policy blocks anon inserts silently. Service role bypasses RLS. The fix is a `WITH CHECK` policy.

| Command | What happens |
|---------|-------------|
| `pnpm ep4:break` | Enables RLS on `receipts` AND drops the INSERT policy |
| `pnpm ep4:run` | Attempts the same insert with both anon key and service_role key; shows the difference |
| `pnpm ep4:verify` | Re-adds the INSERT policy; tests all three scenarios (unauthed anon, authed anon, service role) |

**Fix guide**:
```sql
-- ❌ No policy → anon key insert blocked
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- ✔ Fix: add INSERT policy for authenticated users
CREATE POLICY "receipts: authenticated insert"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

**Key insight**: `service_role` key always **bypasses RLS**. If service works but anon fails — check your policies, not your code.

---

### Episode 5 — Schema Drift / Types

> **Concept**: Adding a column without regenerating TypeScript types causes a silent mismatch — TS compiles fine but the column is invisible to your code.

| Command | What happens |
|---------|-------------|
| `pnpm ep5:break` | Adds `notes TEXT` column to `receipts` in the DB; writes a stale `types.gen.ts` that does NOT include it |
| `pnpm ep5:run` | Compares live DB columns to columns declared in `types.gen.ts`; reports drift |
| `pnpm ep5:verify` | Runs `supabase gen types typescript --local`, writes `types.gen.ts`, re-runs drift check |

**Fix guide**:
```bash
# After any migration that adds/removes/renames columns:
supabase gen types typescript --local > supabase/types.gen.ts
# Then commit types.gen.ts alongside the migration SQL
```

**Expected output (broken)**:
```
✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

**Expected output (verified)**:
```
✔  types.gen.ts is in sync with the live database schema.
✔  `notes` column is present in the regenerated types.
✔  EP5 PASSED
```

---

## Utility Commands

| Command | Description |
|---------|-------------|
| `pnpm supabase:start` | Start local Supabase stack (runs migrations automatically) |
| `pnpm supabase:stop` | Stop local Supabase stack |
| `pnpm supabase:reset` | Reset DB and re-run all migrations |
| `pnpm supabase:seed` | Reset DB + apply seed.sql |
| `pnpm reset` | Full playground reset: restores all broken files, clears state, reseeds DB |

---

## Observability Without the Dashboard

All observability in this repo uses CLI-only tools:

```bash
# View edge function logs (after pnpm ep1:run)
supabase functions logs echo --scroll 20

# View Postgres logs (RAISE NOTICE from ep2)
supabase db logs

# Query DB directly
supabase db execute --local --sql "SELECT * FROM receipts LIMIT 5;"

# List policies
supabase db execute --local --sql \
  "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'receipts';"

# Check RLS status
supabase db execute --local --sql \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('receipts','profiles');"
```

---

## Troubleshooting

### "Missing required env var: SUPABASE_URL"
Copy `.env.example` to `.env` and fill in the values from `pnpm supabase:start`.

### "supabase db execute" fails
Make sure Supabase is running: `pnpm supabase:start`.

### Edge function returns 404
Make sure `supabase functions serve --no-verify-jwt` is running in a separate terminal.

### EP4 verify fails on "authed anon insert"
This requires the local Supabase Auth service.  Make sure `pnpm supabase:start` completed without errors.

### EP5 gen types fails
The `supabase gen types typescript --local` command requires Supabase CLI 1.200+.  
Check version: `supabase --version`.

### Docker not running
All local Supabase commands require Docker Desktop to be running.

---

## Contributing

PRs welcome!  Each episode is isolated to one script file and one SQL change — keep it that way.

---

## License

MIT
