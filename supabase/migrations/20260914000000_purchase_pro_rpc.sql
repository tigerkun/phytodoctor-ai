-- ==============================================================================
-- Migration: 20260914000000_purchase_pro_rpc.sql
-- Description: Atomic seed-funded Pro purchase, entirely inside the database.
--              Row-locked balance check + deduct + tier grant + ledger +
--              subscription record in one call — no read-then-write window
--              for concurrent requests to exploit.
-- ==============================================================================

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
  -- p_cost comes from the server (PRO_COST_SEEDS), never from the client.
  if p_cost is null or p_cost <= 0 then
    raise exception 'invalid cost';
  end if;

  select * into v_profile
    from public.profiles
   where user_id = p_user_id
     for update;               -- serialise concurrent purchases

  if not found then
    raise exception 'profile not found';
  end if;

  if v_profile.tier = 'pro' and v_profile.pro_expires_at > now() then
    raise exception 'already pro';
  end if;

  if v_profile.seeds < p_cost then
    raise exception 'insufficient:%', v_profile.seeds;
  end if;

  v_expires    := now() + interval '31 days';
  v_new_seeds  := v_profile.seeds - p_cost;

  update public.profiles
     set seeds = v_new_seeds,
         tier = 'pro',
         pro_expires_at = v_expires
   where user_id = p_user_id;

  insert into public.seed_transactions (user_id, amount, source, description)
  values (p_user_id, -p_cost, 'spend', 'Pro Commission (seeds)');

  insert into public.subscriptions (user_id, tier, started_at, expires_at)
  values (p_user_id, 'pro', now(), v_expires)
  on conflict (user_id) do update
     set tier = 'pro', started_at = now(), expires_at = v_expires;

  return json_build_object(
    'seeds', v_new_seeds,
    'tier', 'pro',
    'pro_expires_at', v_expires
  );
end;
$$;

revoke all on function public.purchase_pro_with_seeds(uuid, integer) from public, anon;
grant execute on function public.purchase_pro_with_seeds(uuid, integer) to authenticated;
