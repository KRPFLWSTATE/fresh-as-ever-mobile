-- perfection_pass_v1 — complaints status, audit_logs FK, outlet halal, order↔complaint sync
-- Apply via Supabase MCP: apply_migration name=perfection_pass_v1

-- 1) Complaints: allow escalated + unresolved (app + admin UI)
alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints add constraint complaints_status_check
  check (status = any (array[
    'open'::text,
    'unresolved'::text,
    'investigating'::text,
    'escalated'::text,
    'resolved'::text,
    'dismissed'::text
  ]));

-- 2) audit_logs.actor_id → profiles (fixes PostgREST embed)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_actor_id_fkey'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_actor_id_fkey
      foreign key (actor_id) references public.profiles(id)
      on delete set null;
  end if;
end $$;

-- 3) Outlet-level halal certification
alter table public.outlets
  add column if not exists is_halal_certified boolean not null default false;

comment on column public.outlets.is_halal_certified is
  'True when the entire outlet is halal-certified; individual bags may still set is_halal when this is false.';

-- 4) Sync disputed orders → complaints (idempotent upsert)
create or replace function public.trg_sync_order_dispute_complaint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
begin
  if tg_op = 'UPDATE'
     and lower(coalesce(new.order_status, '')) = 'disputed'
     and lower(coalesce(old.order_status, '')) <> 'disputed' then
    select id into v_existing
    from public.complaints
    where order_id = new.id
    limit 1;
    if v_existing is null then
      insert into public.complaints (
        order_id,
        reporter_id,
        type,
        status,
        description
      ) values (
        new.id,
        new.customer_id,
        'other',
        'open',
        'Order marked disputed'
      );
    elsif exists (
      select 1 from public.complaints c
      where c.id = v_existing and lower(c.status) in ('resolved', 'dismissed')
    ) then
      update public.complaints
      set status = 'open',
          description = coalesce(description, 'Order marked disputed')
      where id = v_existing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_order_dispute_complaint on public.orders;
create trigger trg_sync_order_dispute_complaint
  after update of order_status on public.orders
  for each row
  execute function public.trg_sync_order_dispute_complaint();

-- 5) Increment promo_codes.used_count on paid orders
create or replace function public.trg_promo_code_used_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and lower(coalesce(new.payment_status, '')) = 'paid'
     and lower(coalesce(old.payment_status, '')) <> 'paid'
     and new.promo_code_id is not null then
    update public.promo_codes
    set used_count = coalesce(used_count, 0) + 1
    where id = new.promo_code_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_promo_code_used_count on public.orders;
create trigger trg_promo_code_used_count
  after update of payment_status on public.orders
  for each row
  execute function public.trg_promo_code_used_count();

-- Backfill complaints for existing disputed orders without a row
insert into public.complaints (order_id, reporter_id, type, status, description)
select o.id, o.customer_id, 'other', 'open', 'Order disputed (backfill)'
from public.orders o
where lower(coalesce(o.order_status, '')) = 'disputed'
  and not exists (select 1 from public.complaints c where c.order_id = o.id);
