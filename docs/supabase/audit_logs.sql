-- Additive migration: `public.audit_logs` + triggers
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name `audit_logs_v1`).
-- Retained here as the canonical reference. Safe to re-run (IF NOT EXISTS + DROP/CREATE).
--
-- Powers `AdminAuditLogsScreen` (kind/title/detail/actor/occurred_at with server-side
-- filtering + pagination) and `AdminPlatformOrderDetailScreen` (per-order audit trail).
-- SECURITY DEFINER triggers capture state-change events on `merchants`, `complaints`,
-- `settlements`, `orders`, and `profiles`. Reads are admin-only via RLS; writes happen
-- only via the triggers (no direct insert policy needed).

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  kind text not null,
  action text not null,
  title text not null,
  detail text,
  actor_role text,
  actor_id uuid,
  subject_type text,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_occurred_at_idx
  on public.audit_logs (occurred_at desc);

create index if not exists audit_logs_kind_idx
  on public.audit_logs (kind);

alter table public.audit_logs enable row level security;

drop policy if exists "Admins read audit_logs" on public.audit_logs;
create policy "Admins read audit_logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.fn_log_audit(
  p_kind text,
  p_action text,
  p_title text,
  p_detail text,
  p_actor_role text,
  p_actor_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_metadata jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (
    kind, action, title, detail, actor_role, actor_id,
    subject_type, subject_id, metadata
  ) values (
    p_kind, p_action, p_title, p_detail, p_actor_role, p_actor_id,
    p_subject_type, p_subject_id, coalesce(p_metadata, '{}'::jsonb)
  );
$$;

-- Merchants: inserts (first MerchantOnboarding upsert)
-- Migration `audit_merchants_insert_v1` (APPLIED). Pairs with `trg_audit_merchants_status`
-- (UPDATE-only) so the audit timeline covers create + status transitions for every merchant.
create or replace function public.trg_audit_merchants_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  select role into v_role from public.profiles where id = v_actor;
  perform public.fn_log_audit(
    'merchant',
    'created',
    'Merchant created',
    coalesce(new.business_name, '—') || ' application submitted (status: ' || coalesce(new.status, 'pending') || ')',
    coalesce(v_role, 'merchant'),
    v_actor,
    'merchant',
    new.id,
    jsonb_build_object(
      'business_name', new.business_name,
      'legal_name', new.legal_name,
      'status', new.status,
      'owner_id', new.owner_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_merchants_insert on public.merchants;
create trigger trg_audit_merchants_insert
  after insert on public.merchants
  for each row
  execute function public.trg_audit_merchants_insert();

-- Merchants: status changes
create or replace function public.trg_audit_merchants_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    select role into v_role from public.profiles where id = v_actor;
    perform public.fn_log_audit(
      'merchant',
      lower(new.status),
      'Merchant ' || new.status,
      coalesce(new.business_name, '—') || ' status changed from ' ||
        coalesce(old.status, '—') || ' to ' || new.status,
      coalesce(v_role, 'admin'),
      v_actor,
      'merchant',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'rejection_reason', new.rejection_reason
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_merchants_status on public.merchants;
create trigger trg_audit_merchants_status
  after update on public.merchants
  for each row
  execute function public.trg_audit_merchants_status();

-- Complaints: insert + resolve
create or replace function public.trg_audit_complaints()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  select role into v_role from public.profiles where id = v_actor;

  if tg_op = 'INSERT' then
    perform public.fn_log_audit(
      'complaint',
      'opened',
      'Complaint opened',
      coalesce(new.type, 'Complaint'),
      coalesce(v_role, 'system'),
      v_actor,
      'complaint',
      new.id,
      jsonb_build_object('order_id', new.order_id, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    perform public.fn_log_audit(
      'complaint',
      lower(new.status),
      'Complaint ' || new.status,
      coalesce(new.type, 'Complaint'),
      coalesce(v_role, 'admin'),
      v_actor,
      'complaint',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'order_id', new.order_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_complaints_ins on public.complaints;
create trigger trg_audit_complaints_ins
  after insert on public.complaints
  for each row
  execute function public.trg_audit_complaints();

drop trigger if exists trg_audit_complaints_upd on public.complaints;
create trigger trg_audit_complaints_upd
  after update on public.complaints
  for each row
  execute function public.trg_audit_complaints();

-- Settlements: insert
create or replace function public.trg_audit_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_log_audit(
    'settlement',
    'created',
    'Settlement created',
    'Rs. ' || coalesce(new.net_payout::text, '0') || ' · ' || coalesce(new.status, 'pending'),
    'system',
    null,
    'settlement',
    new.id,
    jsonb_build_object(
      'merchant_id', new.merchant_id,
      'net_payout', new.net_payout,
      'status', new.status
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_settlements_ins on public.settlements;
create trigger trg_audit_settlements_ins
  after insert on public.settlements
  for each row
  execute function public.trg_audit_settlements();

-- Orders: cancellation
create or replace function public.trg_audit_orders_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if tg_op = 'UPDATE'
     and lower(coalesce(new.order_status, '')) = 'cancelled'
     and lower(coalesce(old.order_status, '')) <> 'cancelled' then
    select role into v_role from public.profiles where id = v_actor;
    perform public.fn_log_audit(
      'order',
      'cancelled',
      'Order cancelled',
      coalesce(new.cancellation_reason, 'No reason provided'),
      coalesce(v_role, coalesce(new.cancelled_by, 'system')),
      v_actor,
      'order',
      new.id,
      jsonb_build_object(
        'reservation_code', new.reservation_code,
        'total', new.total,
        'cancelled_by', new.cancelled_by
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_orders_cancel on public.orders;
create trigger trg_audit_orders_cancel
  after update on public.orders
  for each row
  execute function public.trg_audit_orders_cancel();

-- Profiles: suspensions
create or replace function public.trg_audit_profile_suspend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if tg_op = 'UPDATE'
     and (new.is_suspended is distinct from old.is_suspended) then
    select role into v_role from public.profiles where id = v_actor;
    perform public.fn_log_audit(
      'profile',
      case when new.is_suspended then 'suspended' else 'unsuspended' end,
      case when new.is_suspended then 'User suspended' else 'User unsuspended' end,
      coalesce(new.full_name, new.id::text),
      coalesce(v_role, 'admin'),
      v_actor,
      'profile',
      new.id,
      jsonb_build_object(
        'is_suspended', new.is_suspended,
        'no_show_count', new.no_show_count
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_profile_suspend on public.profiles;
create trigger trg_audit_profile_suspend
  after update on public.profiles
  for each row
  execute function public.trg_audit_profile_suspend();

-- Settlements: status changes
-- Migration `audit_settlements_status_v1` (APPLIED). Captures UPDATE-only status transitions
-- (pending -> processing -> paid / failed) on `public.settlements`. Combined with the existing
-- `trg_audit_settlements_ins` INSERT trigger this gives a full audit timeline for a settlement.
create or replace function public.trg_audit_settlements_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    select role into v_role from public.profiles where id = v_actor;
    perform public.fn_log_audit(
      'settlement',
      lower(coalesce(new.status, 'updated')),
      'Settlement ' || coalesce(new.status, 'updated'),
      'Rs. ' || coalesce(new.net_payout::text, '0') || ' · ' ||
        coalesce(old.status, '—') || ' → ' || coalesce(new.status, '—'),
      coalesce(v_role, 'admin'),
      v_actor,
      'settlement',
      new.id,
      jsonb_build_object(
        'merchant_id', new.merchant_id,
        'net_payout', new.net_payout,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_settlements_status on public.settlements;
create trigger trg_audit_settlements_status
  after update on public.settlements
  for each row
  execute function public.trg_audit_settlements_status();

-- Platform settings: flag flips
-- Migration `audit_platform_settings_v1` (APPLIED). Captures INSERT and UPDATE on
-- `public.platform_settings`. Metadata stores `key`, `old_value`, `new_value` so the audit
-- trail can show diffs between flag snapshots.
create or replace function public.trg_audit_platform_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_old jsonb := case when tg_op = 'UPDATE' then old.value else null end;
  v_changed boolean := tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.value is distinct from old.value);
begin
  if not v_changed then
    return new;
  end if;
  select role into v_role from public.profiles where id = v_actor;
  perform public.fn_log_audit(
    'platform_settings',
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    'Platform settings ' || new.key,
    case when tg_op = 'INSERT' then 'Created ' || new.key else 'Updated ' || new.key end,
    coalesce(v_role, 'admin'),
    v_actor,
    'platform_settings',
    null,
    jsonb_build_object(
      'key', new.key,
      'old_value', v_old,
      'new_value', new.value
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_platform_settings on public.platform_settings;
create trigger trg_audit_platform_settings
  after insert or update on public.platform_settings
  for each row
  execute function public.trg_audit_platform_settings();

-- Lock down PostgREST/RPC exposure: triggers still run because the engine
-- invokes the function directly (bypassing role privilege checks), but we don't
-- want anyone to be able to spoof audit entries through /rest/v1/rpc/*.
revoke all on function public.fn_log_audit(text, text, text, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.trg_audit_merchants_insert() from public, anon, authenticated;
revoke all on function public.trg_audit_merchants_status() from public, anon, authenticated;
revoke all on function public.trg_audit_complaints() from public, anon, authenticated;
revoke all on function public.trg_audit_settlements() from public, anon, authenticated;
revoke all on function public.trg_audit_settlements_status() from public, anon, authenticated;
revoke all on function public.trg_audit_platform_settings() from public, anon, authenticated;
revoke all on function public.trg_audit_orders_cancel() from public, anon, authenticated;
revoke all on function public.trg_audit_profile_suspend() from public, anon, authenticated;
