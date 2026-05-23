-- perfection_pass_inventory_v2 — bag quantity decrement + merchant_promotions redemption
-- Apply via Supabase MCP: apply_migration name=perfection_pass_inventory_v2

-- 1) Atomic decrement when order is reserved (prevents oversell at checkout)
create or replace function public.decrement_bag_quantity_on_reserve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if new.bag_id is null then
    return new;
  end if;

  update public.rescue_bags
  set
    quantity_remaining = greatest(0, coalesce(quantity_remaining, 0) - coalesce(new.quantity, 1)),
    status = case
      when greatest(0, coalesce(quantity_remaining, 0) - coalesce(new.quantity, 1)) <= 0
        then 'sold_out'
      else status
    end,
    updated_at = now()
  where id = new.bag_id
    and coalesce(quantity_remaining, 0) >= coalesce(new.quantity, 1)
  returning quantity_remaining into v_remaining;

  if not found then
    raise exception 'Bag is sold out or insufficient quantity'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_decrement_bag_on_reserve on public.orders;
create trigger trg_decrement_bag_on_reserve
  after insert on public.orders
  for each row
  when (lower(coalesce(new.order_status, '')) = 'reserved')
  execute function public.decrement_bag_quantity_on_reserve();

-- 2) Legacy RPC name (service role only) — wraps single decrement for tooling
create or replace function public.decrement_bag_quantity(p_bag_id uuid, p_qty integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update public.rescue_bags
  set
    quantity_remaining = greatest(0, coalesce(quantity_remaining, 0) - greatest(1, p_qty)),
    status = case
      when greatest(0, coalesce(quantity_remaining, 0) - greatest(1, p_qty)) <= 0 then 'sold_out'
      else status
    end,
    updated_at = now()
  where id = p_bag_id
    and coalesce(quantity_remaining, 0) >= greatest(1, p_qty)
  returning quantity_remaining into v_remaining;

  if not found then
    raise exception 'Bag is sold out or insufficient quantity' using errcode = 'P0001';
  end if;
  return v_remaining;
end;
$$;

revoke all on function public.decrement_bag_quantity(uuid, integer) from public, anon, authenticated;
grant execute on function public.decrement_bag_quantity(uuid, integer) to service_role;

-- 3) Match merchant_promotions.code to promo_codes.code on paid orders (increment used_count)
create or replace function public.trg_merchant_promotion_used_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if tg_op = 'UPDATE'
     and lower(coalesce(new.payment_status, '')) = 'paid'
     and lower(coalesce(old.payment_status, '')) <> 'paid'
     and new.promo_code_id is not null then
    select code into v_code from public.promo_codes where id = new.promo_code_id;
    if v_code is not null then
      update public.merchant_promotions
      set used_count = coalesce(used_count, 0) + 1
      where lower(trim(title)) = lower(trim(v_code));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_merchant_promotion_used_count on public.orders;
create trigger trg_merchant_promotion_used_count
  after update of payment_status on public.orders
  for each row
  execute function public.trg_merchant_promotion_used_count();
