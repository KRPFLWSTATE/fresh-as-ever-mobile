# Phase 10 — Admin architecture decision (BFF vs RLS)

**Decision (epic default):** Mobile admin modules use the **existing Supabase JS client** with **RLS** allowing `admin` role to read/write platform tables. For aggregates that are unsafe to expose, add **Next.js route handlers** in `fresh-as-ever` and call them from RN with `Authorization: Bearer` (same pattern as PayHere hash).

**Rollback:** Feature-flag admin shell off by reverting to a single read-only dashboard only.

**Supabase MCP:** Run `list_tables` + read-only `execute_sql` to confirm columns before each admin screen ships.
