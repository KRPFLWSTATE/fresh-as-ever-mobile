# Staff invite end-to-end QA

**Project:** `odkbpeelvcdmlimdflbr`  
**Migration:** `merchant_staff_link_on_signup` (RPC `link_merchant_staff_from_email` + auth.users trigger)

## Prerequisites

- Web dev server with `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see perfection-pass service-role guide).
- Owner merchant account on device or web.
- Fresh email alias not yet in auth (e.g. `staff+e2e-<date>@yourdomain.com`).

## Steps

1. **Invite** — As owner, open Merchant → Staff, invite the test email (or `POST /api/merchant/invite-staff` with `{ merchant_id, email }`).
2. **Verify row** — In Supabase SQL:
   ```sql
   select id, merchant_id, invited_email, user_id, status
   from public.merchant_staff
   where lower(invited_email) = lower('<test-email>');
   ```
   Expect `status = invited`, `user_id` null.
3. **Sign up** — Open invite link / sign up as invitee with the **same email**.
4. **Link** — Re-run SQL or call `select link_merchant_staff_from_email();` as invitee session. Expect `user_id` set and `status = active`.
5. **App** — Invitee opens merchant app; `useMerchantContext` loads merchant via staff row; bag image upload to `bag-images/<merchant_id>/…` succeeds.

## Pass criteria

- [ ] `merchant_staff.user_id` populated after signup
- [ ] Invitee sees merchant outlets (not empty context)
- [ ] Audit log row on staff insert (perfection_pass_audit_extend)

Record build + date in `PERFECTION_PASS_MCP_GATES.md` Phase 3 Staff pilot.
