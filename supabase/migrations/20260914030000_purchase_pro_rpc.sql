create or replace function public.purchase_pro_with_seeds(
  p_user_id uuid,
  p_cost integer default 1000
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_expires timestamptz;
  v_new_seeds integer;
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_cost is null or p_cost <= 0 then
    raise exception 'invalid cost';
  end if;

  select * into v_profile
    from public.profiles
   where user_id = p_user_id
   for update;
  if not found then raise exception 'profile not found'; end if;
  if v_profile.tier = 'pro' and v_profile.pro_expires_at > now() then
    raise exception 'already pro';
  end if;
  if v_profile.seeds < p_cost then
    raise exception 'insufficient seeds';
  end if;

  v_expires := now() + interval '31 days';
  v_new_seeds := v_profile.seeds - p_cost;
  update public.profiles
     set seeds = v_new_seeds, tier = 'pro', pro_expires_at = v_expires
   where user_id = p_user_id;
  insert into public.seed_transactions (user_id, amount, source, description)
    values (p_user_id, -p_cost, 'spend', 'Pro Commission (seeds)');
  insert into public.subscriptions (user_id, tier, started_at, expires_at)
    values (p_user_id, 'pro', now(), v_expires)
  on conflict (user_id) do update
    set tier = 'pro', started_at = now(), expires_at = v_expires;

  return json_build_object('seeds', v_new_seeds, 'tier', 'pro', 'pro_expires_at', v_expires);
end;
$$;

revoke all on function public.purchase_pro_with_seeds(uuid, integer) from public, anon;
grant execute on function public.purchase_pro_with_seeds(uuid, integer) to authenticated, service_role;
