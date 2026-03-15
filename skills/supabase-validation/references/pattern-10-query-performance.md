# Pattern 10 — Query Performance

**Episode:** EP10
**Trigger:** after any migration that creates or drops an index, or after any
report of a slow query on a large table.

---

## Core Diagnostic

Run `EXPLAIN (ANALYZE, BUFFERS)` on the representative query and assert **plan
shape** — not execution time alone, since timing varies by machine load.

## Validation Steps

1. **Confirm row count is meaningful** (≥ 1,000 rows; seed if needed)

2. **Confirm index exists** via `pg_indexes`:
   ```sql
   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '<table>';
   ```

3. **Run `ANALYZE <table>`** to ensure planner statistics are current after
   any data changes.

4. **Run `EXPLAIN (ANALYZE, BUFFERS)`** on the query and assert:
   - With index present: plan contains `Index Scan` (or `Index Only Scan` /
     `Bitmap Index Scan`) — **not** `Seq Scan`
   - Without index: plan contains `Seq Scan` (confirms the break state)

## Index Direction Matters

For `ORDER BY created_at DESC LIMIT N` queries, create the index as
`(created_at DESC)` — the planner can then skip a sort step entirely:

```sql
CREATE INDEX idx_table_created_at_desc ON public.<table> (created_at DESC);
ANALYZE public.<table>;
```

## Production Note

Use `CREATE INDEX CONCURRENTLY` in production to avoid holding an exclusive
lock during index creation. This cannot be used inside a transaction block.

## Key Insight

A Seq Scan on a small table is **normal** — the planner chooses Seq Scan below
its cost threshold regardless of index presence. Use ≥ 1,000 rows to get a
meaningful EXPLAIN result.

## Docs

- [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)
- [Supabase Indexes](https://supabase.com/docs/guides/database/postgres/indexes)
- [Debugging and Monitoring](https://supabase.com/docs/guides/database/inspect)

## Done When

EXPLAIN shows Index Scan (not Seq Scan) on a ≥ 1,000 row table.
