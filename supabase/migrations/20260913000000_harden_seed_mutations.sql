-- Keep seed balance changes atomic and out of direct client column updates.
revoke update (seeds) on table public.profiles from authenticated;

create or replace function public.increment_seeds(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_description text default '',
  p_transaction_id uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance integer;
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;

  if p_source not in ('checkin', 'bonus', 'spend', 'reward')
     or p_amount = 0
     or abs(p_amount) > 10000 then
    raise exception 'invalid seed transaction';
  end if;

  insert into public.seed_transactions (id, user_id, amount, source, description)
  values (
    p_transaction_id,
    p_user_id,
    p_amount,
    p_source,
    left(coalesce(p_description, ''), 200)
  )
  on conflict (id) do nothing;

  if not found then
    select seeds into next_balance
    from public.profiles
    where user_id = p_user_id;
    return next_balance;
  end if;

  update public.profiles
  set seeds = seeds + p_amount
  where user_id = p_user_id
    and seeds + p_amount >= 0
  returning seeds into next_balance;

  if not found then
    raise exception 'insufficient seeds';
  end if;

  return next_balance;
end;
$$;

revoke all on function public.increment_seeds(uuid, integer, text, text, uuid) from public;
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to service_role;
