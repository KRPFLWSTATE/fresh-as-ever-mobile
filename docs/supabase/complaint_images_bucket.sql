-- complaint_images_bucket_v1
--
-- Public bucket for customer complaint evidence photos.
-- Path scheme: `<auth.uid()>/<order_id>/<uuid>.jpg`
-- Mobile/web upload via anon client; public URL reads via buckets.public = true.
--
-- Apply via Supabase MCP: apply_migration name=complaint_images_bucket_v1

insert into storage.buckets (id, name, public)
values ('complaint-images', 'complaint-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "complaint-images owner insert" on storage.objects;
create policy "complaint-images owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'complaint-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "complaint-images owner update" on storage.objects;
create policy "complaint-images owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'complaint-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'complaint-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "complaint-images owner delete" on storage.objects;
create policy "complaint-images owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'complaint-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Customers may only file complaints on orders they placed.
drop policy if exists "Users can create complaints" on public.complaints;
create policy "Users can create complaints"
  on public.complaints
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.customer_id = auth.uid()
    )
  );
