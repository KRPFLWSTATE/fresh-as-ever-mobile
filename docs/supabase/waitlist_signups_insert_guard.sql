-- waitlist_signups_insert_guard_v1
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr`
-- (migration name `waitlist_signups_insert_guard_v1`).
--
-- The original `Anyone can insert waitlist signups` policy used `WITH CHECK (true)`, which the
-- Supabase advisor flagged as overly permissive (`rls_policy_always_true`). The marketing
-- landing page legitimately needs to capture leads from anonymous visitors, so the policy
-- stays public-writable; we only add light input guards so spam ingestion is less attractive.
--
-- Guards:
--   - `phone` is required and capped at 32 chars
--   - `email` (when supplied) is 3..254 chars and must contain an `@`
--   - `full_name` (when supplied) is <= 120 chars
--   - `city` (when supplied) is <= 80 chars
--   - `signup_source` (when supplied) is <= 64 chars
--
-- Idempotent (drop + recreate).

drop policy if exists "Anyone can insert waitlist signups" on public.waitlist_signups;
create policy "Anyone can insert waitlist signups"
  on public.waitlist_signups
  for insert
  with check (
    coalesce(phone, '') <> ''
    and char_length(phone) <= 32
    and (email is null or (char_length(email) between 3 and 254 and position('@' in email) > 0))
    and (full_name is null or char_length(full_name) <= 120)
    and (city is null or char_length(city) <= 80)
    and (signup_source is null or char_length(signup_source) <= 64)
  );
