# Parity gate checklist (Sequential Thinking MCP + verification)

**Canonical matrix:** [`STITCH_VERIFICATION_MATRIX.md`](./STITCH_VERIFICATION_MATRIX.md)

Before **each** implementation cluster:

## 1. Sequential Thinking MCP — paste template

```
Goal: [one sentence]

RN routes touched: [see src/navigation/types.ts]
Stitch contract: [path(s) under stitch_fresh_as_ever_food_rescue-2/*/code.html]

Data assumptions:
- Tables/APIs: [...]
- Auth role: [customer | merchant_staff | admin]

Hazards:
- PII / logging
- PayHere / payments
- Supabase RLS (anon client cannot [...])

Rollback:
- Revert commit / feature flag name

Exit decision: PROCEED | REVISE_SCOPE | SPIKE_FIRST
Reason (2–3 lines):
```

## 2. Supabase MCP (when schema or policies might change)

- `list_tables` / `execute_sql` read-only: confirm columns and RLS expectations.
- After migrations: re-check policies for least privilege.

## 3. Verification gate (required before next cluster)

- [ ] `npm run ci` in `fresh-as-ever-mobile`
- [ ] Jest: extend tests if linking/copy/assertions are stable
- [ ] Maestro: add flow under `.maestro/` or extend README with flow id
- [ ] Update matrix row(s): RN route, status, last verified commit hash, notes

## 4. Promotion

Merge only on green gate.
