# Supabase Skills Parity Analysis

Comparing `supabase/agent-skills` (official Supabase repo) with `SKILL.md` (this repo).

Reviewed: March 2026  
Repo: https://github.com/supabase/agent-skills  
Install this skill: `npx skills add visaoenhance/supabase-debug-playground`

---

## TL;DR

**No meaningful overlap. Complementary, not competing.**

The two skills occupy different niches:

| | `supabase/agent-skills` | `SKILL.md` (this repo) |
|---|---|---|
| **What it is** | Postgres best practices reference library | Supabase validation behavioral contract |
| **What it tells agents** | How to write good SQL | How to verify Supabase actions actually worked |
| **Activation trigger** | Writing/reviewing SQL or schema | Any Supabase action in a task |
| **Output** | Correct SQL patterns with EXPLAIN analysis | Pass/fail terminal commands |
| **Format** | Agent Skills Open Standard (SKILL.md + references/) | Agent Skills Open Standard (SKILL.md + references/) |
| **Installed via** | `npx skills add supabase/agent-skills` | `npx skills add visaoenhance/supabase-debug-playground` |

---

## What `supabase/agent-skills` covers

Currently one published skill: **`supabase-postgres-best-practices`** (v1.1.0, January 2026).

Organized into 8 priority tiers with individual reference files:

| Priority | Category | Files |
|---|---|---|
| CRITICAL | Query Performance | `query-missing-indexes.md`, `query-composite-indexes.md`, `query-covering-indexes.md`, `query-partial-indexes.md`, `query-index-types.md` |
| CRITICAL | Connection Management | `conn-pooling.md`, `conn-limits.md`, `conn-idle-timeout.md`, `conn-prepared-statements.md` |
| CRITICAL | Security & RLS | `security-rls-basics.md`, `security-rls-performance.md`, `security-privileges.md` |
| HIGH | Schema Design | `schema-data-types.md`, `schema-foreign-key-indexes.md`, `schema-primary-keys.md`, `schema-partitioning.md`, `schema-constraints.md`, `schema-lowercase-identifiers.md` |
| MEDIUM-HIGH | Concurrency & Locking | `lock-deadlock-prevention.md`, `lock-short-transactions.md`, `lock-advisory.md`, `lock-skip-locked.md` |
| MEDIUM | Data Access Patterns | `data-pagination.md`, `data-batch-inserts.md`, `data-upsert.md`, `data-n-plus-one.md` |
| LOW-MEDIUM | Monitoring & Diagnostics | `monitor-explain-analyze.md`, `monitor-pg-stat-statements.md`, `monitor-vacuum-analyze.md` |
| LOW | Advanced Features | `advanced-jsonb-indexing.md`, `advanced-full-text-search.md` |

**What it does NOT cover:**
- Edge functions (none)
- RPC shape validation (none)
- CRUD response validation (none)
- Type generation / schema drift detection (none)
- Production deploy validation (none)
- Any pass/fail verification loop (none)
- Agent safety rules around destructive commands (none)

---

## What `SKILL.md` covers

A behavioral contract enforcing validation discipline across 10 Supabase action patterns:

| Pattern | Episode | What it validates |
|---|---|---|
| Edge function (local) | EP1 | HTTP 200 + `ok: true` + `request_id` present |
| Edge function (production) | EP6 | Same checks against live URL |
| RPC | EP2 | No error + response contains expected data shape |
| CRUD | EP3 | Non-null array with `id` returned (not just exit 0) |
| RLS | EP4 | All 3 roles tested: unauthed blocked, authed allowed, service_role allowed |
| Schema drift | EP5 | `types.gen.ts` matches live DB after every migration |
| Auth-gated query | EP7 | All 3 auth states tested: no session → empty, wrong user → empty, owner → rows |
| Realtime subscription | EP8 | `pg_publication_tables` membership confirmed + INSERT event received within timeout |
| RPC auth context | EP9 | Unauthenticated call → explicit error + `anon` execute revoked |
| Query performance | EP10 | EXPLAIN shows Index Scan (not Seq Scan) on ≥ 1,000 row table |

**What it does NOT cover:**
- How to write performant SQL
- Index strategy
- Connection pooling configuration
- Query optimization
- Lock management
- Postgres internals

---

## The one area of content adjacency: RLS

Both repos touch Row Level Security, but from different angles:

| | `supabase/agent-skills` — `security-rls-basics.md` / `security-rls-performance.md` | `SKILL.md` — Pattern 5 |
|---|---|---|
| **Question answered** | How do I write correct, performant RLS policies? | After I change a policy, how do I confirm it works for all roles? |
| **Output type** | SQL patterns with EXPLAIN analysis | Terminal commands producing binary pass/fail |
| **Scope** | SQL authoring | Post-change verification |

There is no conflict. An agent could read both: the `supabase/agent-skills` RLS references to write the policy correctly, then Pattern 5 from `SKILL.md` to verify all three role scenarios after applying it.

---

## Format comparison

| Dimension | `supabase/agent-skills` | `SKILL.md` (this repo) |
|---|---|---|
| Standard | Agent Skills Open Standard (agentskills.io) | Agent Skills Open Standard (agentskills.io) |
| Structure | `SKILL.md` manifest + `references/` directory + `AGENTS.md` (compiled) | `SKILL.md` manifest + `references/` directory (10 pattern files) |
| Distribution | `npx skills add supabase/agent-skills` | `npx skills add visaoenhance/supabase-debug-playground` |
| Supported agents | Claude Code, Cursor, GitHub Copilot, Roo Code, Goose, and others | Claude Code, Cursor, GitHub Copilot, Roo Code, Goose, and others |
| Modularity | References loaded on-demand | References loaded on-demand |

Both skills now share the same format and distribution mechanism. An agent installing this skill receives the contract layer (`SKILL.md`) with 10 pattern references loaded on-demand.

---

## Strategic positioning

```
supabase/agent-skills          SKILL.md (this repo)
─────────────────────          ────────────────────
"Write it right"               "Verify it worked"

Postgres performance           Edge function validation
Schema design patterns         RPC shape assertions
Index strategy                 CRUD insert confirmation
Connection pooling             RLS role coverage
Query optimization             Type drift detection
```

The two skills stack cleanly. A developer could install both:

1. `supabase/agent-skills` activates when writing or reviewing SQL → guides correct authoring
2. `SKILL.md` activates after any Supabase action → enforces validation before the agent reports done

---

## Gaps in `supabase/agent-skills` that this repo fills

None of these patterns exist in any form in `supabase/agent-skills`:

1. **Edge function debugging** — `Deno.env.get()` safety, `try/catch` discipline, `request_id` propagation
2. **Production deploy validation** — post-deploy HTTP assertion against a live URL
3. **RPC return shape validation** — Postgres error code taxonomy (`42703` etc.), `pg_get_functiondef` diagnostic
4. **CRUD insert confirmation** — the `Prefer: return=minimal` vs `return=representation` trap
5. **Multi-role RLS verification** — the three-scenario requirement (unauthed / authed / service_role)
6. **Schema drift detection** — `supabase gen types` + git diff as a CI gate
7. **Agent safety contract** — destructive command guardrails, environment confirmation rules
8. **Break/fix demo loop** — executable episodes for teaching and replay
9. **Auth-gated query 3-state validation** — the three-scenario requirement for `auth.uid()` policies (no session / wrong user / owner all behave differently but states 1 & 2 both return `[]` silently)
10. **Realtime subscription lifecycle** — `pg_publication_tables` membership assertion, listener-before-subscribe ordering requirement, INSERT event reception within timeout
11. **RPC auth context hardening** — `auth.uid()` null guard pattern, SECURITY INVOKER + `search_path` verification, `anon` EXECUTE revoke
12. **Query performance via EXPLAIN plan shape** — Index Scan vs Seq Scan assertion, index direction for ORDER BY, `ANALYZE` before assert, minimum row count for a meaningful plan

---

## Current state

`SKILL.md` is in the Agent Skills Open Standard format at the repo root with 10
patterns split across `references/`. Install with:

```sh
npx skills add visaoenhance/supabase-debug-playground
```

**Option: Submit to `supabase/agent-skills`**  
Open a PR adding this as a second skill (`supabase-validation-discipline`) alongside the existing `supabase-postgres-best-practices`. The content is ready; the only work is renaming the skill and opening the PR.
