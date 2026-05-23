# Supabase role model vs RN (audit)

**Source of truth in app:** `profiles.role` (string), with fallbacks to `app_metadata` / `user_metadata` in [`AuthContext.tsx`](../../src/context/AuthContext.tsx). QA test emails may override role only when `__DEV__` or `ENABLE_QA_ROLE_OVERRIDES` (see `.env.example`).

| Resolved role | Meaning | Default shell | `authStackGate` behavior (guest) | Notes |
|---------------|---------|---------------|-----------------------------------|-------|
| `customer` | End user | `MainTabs` | N/A (Login allowed) | |
| `merchant_staff` | Merchant / outlet staff | `MerchantTabs` | Guest on `MerchantTabs` → `MainTabs` | Admin users may also use merchant portal per login hint |
| `admin` | Platform admin | `AdminShell` (stack) | Guest on `AdminShell` → `MainTabs` | Must not access admin data without `admin` profile |

## Admin data access (mobile)

The app uses the **anon** Supabase client only. Admin lists (orders, merchants, settlements) **require** RLS policies that allow `profiles.role = 'admin'` to `select` the relevant rows, **or** a thin **BFF** (Next.js) that uses the service role. Phase 10 UI calls `from('orders')`, `from('profiles')`, etc.; if queries return empty or error, screens show an inline “policy or table missing” message—fix in Supabase dashboard or API.

## Verification

Re-run **`list_tables`** / policy review via Supabase MCP whenever a new admin screen queries a new table.
