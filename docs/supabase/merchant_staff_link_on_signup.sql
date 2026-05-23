-- merchant_staff_link_on_signup
-- Links invited_email rows to auth user on signup / profile sync.

create unique index if not exists merchant_staff_merchant_invited_email_uidx
  on public.merchant_staff (merchant_id, invited_email)
  where invited_email is not null;

create or replace function public.link_merchant_staff_from_email(
  p_user_id uuid default auth.uid(),
  p_email text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_updated integer;
begin
  if p_user_id is null then
    return 0;
  end if;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if v_email is null or not v_email like '%@%' then
    select lower(trim(u.email))
    into v_email
    from auth.users u
    where u.id = p_user_id;
  end if;

  if v_email is null or v_email = '' then
    return 0;
  end if;

  update public.merchant_staff ms
  set
    user_id = p_user_id,
    status = 'active',
    updated_at = now()
  where ms.user_id is null
    and ms.invited_email is not null
    and lower(trim(ms.invited_email)) = v_email;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.link_merchant_staff_from_email(uuid, text) from public, anon;
grant execute on function public.link_merchant_staff_from_email(uuid, text) to authenticated;

revoke all on function public.trg_link_merchant_staff_on_auth_user() from public, anon, authenticated;

create or replace function public.trg_link_merchant_staff_on_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.link_merchant_staff_from_email(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists trg_link_merchant_staff_on_auth_user on auth.users;
create trigger trg_link_merchant_staff_on_auth_user
  after insert or update of email on auth.users
  for each row
  execute function public.trg_link_merchant_staff_on_auth_user();
