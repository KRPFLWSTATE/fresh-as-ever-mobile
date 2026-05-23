-- storage_buckets_bag_images_and_avatars_v1
-- storage_buckets_drop_broad_select_policies_v1 (follow-up; APPLIED)
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr`
-- (migration names `storage_buckets_bag_images_and_avatars_v1`
-- and `storage_buckets_drop_broad_select_policies_v1`).
--
-- NOTE on SELECT policies: the first migration also created
--   "bag-images public read" and "avatars public read"
-- as `for select using (bucket_id = ...)` policies. These triggered the
-- Supabase `public_bucket_allows_listing` security advisor (broad SELECT
-- policies on a public bucket allow `storage.from(b).list()` to enumerate
-- every file). The mobile app never lists files -- it only writes to a
-- known path and rehydrates via the public URL it just got from
-- `upload(...)` -- so the follow-up migration
-- `storage_buckets_drop_broad_select_policies_v1` drops both SELECT
-- policies. Public-URL fetches still work because the buckets have
-- `public = true`, which Supabase resolves without consulting
-- `storage.objects` RLS.
--
-- Provisions two public storage buckets for native photo upload from the
-- mobile app:
--   * `bag-images` -- listing covers for merchants; path scheme
--     `<merchant_id>/<uuid>.jpg`. Public read via `buckets.public = true`;
--     merchant-staff write/update/delete via
--     `public.is_merchant_staff_for(merchant_id)`.
--   * `avatars` -- customer / merchant profile photos; path scheme
--     `<auth.uid()>/<filename>`. Public read via `buckets.public = true`;
--     owner write/update/delete only.
--   * `complaint-images` -- customer complaint evidence; see
--     `complaint_images_bucket.sql`. Path `<auth.uid()>/<order_id>/<uuid>.jpg`.
--
-- Idempotent. Re-runs are safe: bucket inserts use `on conflict (id) do update
-- set public = excluded.public` so any stale `public = false` row is corrected,
-- and every policy is dropped (if present) before being recreated.

insert into storage.buckets (id, name, public)
values ('bag-images', 'bag-images', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- --- bag-images ---------------------------------------------------------

-- (No SELECT policy -- public-URL reads work via `buckets.public = true`.
-- The original migration created a `"bag-images public read"` policy but
-- the follow-up migration `storage_buckets_drop_broad_select_policies_v1`
-- drops it to close the `public_bucket_allows_listing` advisor.)
drop policy if exists "bag-images public read" on storage.objects;

-- Merchant staff insert: first folder segment must be a merchant_id the
-- caller is staff for. Path scheme is `<merchant_id>/<uuid>.jpg`, so
-- (storage.foldername(name))[1] == merchant_id.
drop policy if exists "bag-images merchant staff insert" on storage.objects;
create policy "bag-images merchant staff insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bag-images'
    and public.is_merchant_staff_for(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bag-images merchant staff update" on storage.objects;
create policy "bag-images merchant staff update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'bag-images'
    and public.is_merchant_staff_for(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'bag-images'
    and public.is_merchant_staff_for(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "bag-images merchant staff delete" on storage.objects;
create policy "bag-images merchant staff delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'bag-images'
    and public.is_merchant_staff_for(((storage.foldername(name))[1])::uuid)
  );

-- --- avatars ------------------------------------------------------------

-- (No SELECT policy -- same rationale as `bag-images` above.)
drop policy if exists "avatars public read" on storage.objects;

-- Authenticated users may write/update/delete only inside their own folder.
-- Path scheme: `<auth.uid()>/<filename>`.
drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
