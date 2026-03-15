# Pattern 8 — Realtime Subscription

**Episode:** EP8
**Trigger:** after any `ALTER PUBLICATION supabase_realtime ADD TABLE` or
`DROP TABLE`, or after any change to a table whose changes are observed via
`supabase.channel(...).on('postgres_changes', ...)` subscriptions.

---

## Root Cause of Silent Failures

Supabase Realtime uses PostgreSQL logical replication. A table must be listed
in the `supabase_realtime` publication for the WAL stream to include its changes.
If the table is absent:

- Subscriptions operate normally (`SUBSCRIBED` status)
- Inserts succeed without error
- Events are **never delivered** — no error is raised anywhere

No client-side code change will fix a missing publication entry.

## Validation Steps (Strict Ordering)

1. **Confirm table membership** before touching subscriptions:
   ```sql
   SELECT tablename FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND tablename = '<table>';
   ```
   If absent → run: `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>`

2. **Register the event listener before calling `.subscribe()`**
   Adding the listener after the channel is already subscribed silently drops
   the callback.

3. **Wait for `SUBSCRIBED` status** before inserting.

4. **Insert the row** after subscription is confirmed ready.

5. **Assert the INSERT event arrives** within a timeout (≥ 5 seconds for local
   dev).

6. **Always clean up** — unsubscribe and call `client.realtime.disconnect()`
   in a `finally` block.

## Fail Signal

Event timeout with no error. The subscription appears healthy (`SUBSCRIBED`)
but events never arrive.

## Diagnostic

```sql
-- Full publication table list
SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

## Docs

- [Realtime Overview](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

## Done When

`pg_publication_tables` confirms table membership AND an INSERT event is
received within timeout.
