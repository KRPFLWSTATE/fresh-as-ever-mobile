-- perfection_pass_audit_extend — staff, bags, bank details, order paid
-- Apply via Supabase MCP: apply_migration name=perfection_pass_audit_extend

create or replace function public.trg_audit_merchant_staff_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_log_audit(
    'merchant_staff',
    tg_op,
    coalesce('Staff ' || coalesce(new.invited_email, old.invited_email), 'Staff update'),
    coalesce(new.status, old.status),
    'merchant',
    auth.uid(),
    'merchant_staff',
    coalesce(new.id, old.id),
    jsonb_build_object('role', coalesce(new.role, old.role))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_merchant_staff_change on public.merchant_staff;
create trigger trg_audit_merchant_staff_change
  after insert or update on public.merchant_staff
  for each row
  execute function public.trg_audit_merchant_staff_change();

create or replace function public.trg_audit_rescue_bags_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_log_audit(
    'bag',
    tg_op,
    coalesce(new.title, old.title, 'Bag'),
    coalesce(new.status, old.status),
    'merchant',
    auth.uid(),
    'rescue_bags',
    coalesce(new.id, old.id),
    jsonb_build_object('qty', coalesce(new.quantity_remaining, old.quantity_remaining))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_rescue_bags_change on public.rescue_bags;
create trigger trg_audit_rescue_bags_change
  after insert or update on public.rescue_bags
  for each row
  execute function public.trg_audit_rescue_bags_change();

create or replace function public.trg_audit_merchants_bank_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.bank_name is distinct from old.bank_name
    or new.bank_account_number is distinct from old.bank_account_number
    or new.bank_branch is distinct from old.bank_branch
  ) then
    perform public.fn_log_audit(
      'merchant',
      'bank_update',
      'Bank details updated',
      coalesce(new.business_name, old.business_name),
      'merchant',
      auth.uid(),
      'merchants',
      new.id,
      '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_merchants_bank_change on public.merchants;
create trigger trg_audit_merchants_bank_change
  after update on public.merchants
  for each row
  execute function public.trg_audit_merchants_bank_change();

create or replace function public.trg_audit_orders_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and lower(coalesce(new.payment_status, '')) = 'paid'
     and lower(coalesce(old.payment_status, '')) <> 'paid' then
    perform public.fn_log_audit(
      'order',
      'paid',
      'Order paid',
      coalesce(new.reservation_code, new.id::text),
      'system',
      new.customer_id,
      'orders',
      new.id,
      jsonb_build_object('total', new.total)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_orders_paid on public.orders;
create trigger trg_audit_orders_paid
  after update of payment_status on public.orders
  for each row
  execute function public.trg_audit_orders_paid();
