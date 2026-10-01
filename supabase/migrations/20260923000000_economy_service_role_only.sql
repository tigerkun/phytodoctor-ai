--    Economy RPCs are service-role only — 2026-10-01
--
--    This project has no migration runner: there is no
--    supabase_migrations.schema_migrations table, so every file in this
--    directory has been pasted into the Supabase SQL editor by hand. Run this
--    one the same way. It is idempotent and safe to replay.
--
--    ── The defect ────────────────────────────────────────────────────────────
--    Two SECURITY DEFINER functions in the seed economy were granted EXECUTE to
--    `authenticated` (see 20260913010000, 20260917000000, 20260918000000 and
--    20260914030000). Every validation those functions rely on therefore lived
--    only in server.ts, which is not on the path a direct PostgREST call takes.
--    A signed-in user could call either RPC with their own JWT, skipping Express
--    entirely.
--
--    purchase_pro_with_seeds was the severe one, because its cost is a
--    parameter. It rejects p_cost <= 0 but not p_cost = 1, and the caller names
--    the price. Measured on a throwaway account against production:
--
--        POST /rest/v1/rpc/purchase_pro_with_seeds
--             {"p_user_id": <self>, "p_cost": 1}
--        -> 200 {"seeds": 499, "tier": "pro", "pro_expires_at": ... +31 days}
--
--    A free account that starts on 500 seeds bought 31 days of Pro for one
--    seed. The Rs 99 price was not a constraint on anything.
--
--    increment_seeds was the second door: p_amount is likewise caller-supplied,
--    so a user could mint credits up to the daily_credit_cap (2000) directly,
--    with none of seed-sync's checks. Pro costs 1000.
--
--    ── The fix ───────────────────────────────────────────────────────────────
--    1. Revoke EXECUTE from anon and authenticated on both functions, leaving
--       service_role as the only caller. server.ts already calls
--       purchase_pro_with_seeds through supabaseAdmin, and its seed-sync route
--       has been switched from userClient(authToken) to supabaseAdmin to match,
--       so Express remains the single audited path in. The browser never calls
--       either RPC — the only client rpc() in the app is take_guest_scan, which
--       was already service-role-only.
--
--    2. Pin the Pro price inside the function as well. The revoke above is the
--       real fix, but a caller-named price that the database simply accepts is
--       a hazard that reappears the moment anyone adds a grant. Rejecting any
--       p_cost other than 1000 means a future accidental re-grant still cannot
--       sell Pro for a rupee.
--
--    If PRO_COST_SEEDS in server.ts ever changes, change canonical_pro_cost
--    here in the same commit, or every Pro purchase will fail with
--    'invalid cost'.
--
--    Verify with:
--      select proname, proacl from pg_proc
--       join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
--       where nspname = 'public'
--         and proname in ('increment_seeds', 'purchase_pro_with_seeds');
--    Neither proacl should mention 'authenticated' or 'anon' afterwards.

-- ── 1. Stop the browser reaching the economy directly ────────────────────────
revoke all on function public.increment_seeds(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.purchase_pro_with_seeds(uuid, integer) from public, anon, authenticated;

grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to service_role;
grant execute on function public.purchase_pro_with_seeds(uuid, integer) to service_role;

-- ── 2. Pin the Pro price so a future re-grant still cannot sell it cheap ────
-- p_cost stays in the signature so PostgREST overload resolution and the
-- server.ts call site are unchanged; it is simply no longer negotiable.
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
  -- Keep in lockstep with PRO_COST_SEEDS in server.ts.
  canonical_pro_cost constant integer := 1000;
  v_profile public.profiles;
  v_expires timestamptz;
  v_new_seeds integer;
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
  -- Was `p_cost is null or p_cost <= 0`, which a caller could satisfy with 1.
  if p_cost is distinct from canonical_pro_cost then
    raise exception 'invalid cost';
  end if;

  select * into v_profile from public.profiles
   where user_id = p_user_id for update;
  if not found then raise exception 'profile not found'; end if;
  if v_profile.tier = 'pro' and v_profile.pro_expires_at > now() then
    raise exception 'already pro';
  end if;
  if v_profile.seeds < canonical_pro_cost then
    raise exception 'insufficient seeds';
  end if;

  v_expires := now() + interval '31 days';
  v_new_seeds := v_profile.seeds - canonical_pro_cost;
  update public.profiles
     set seeds = v_new_seeds, tier = 'pro', pro_expires_at = v_expires
   where user_id = p_user_id;
  insert into public.seed_transactions (user_id, amount, source, description)
    values (p_user_id, -canonical_pro_cost, 'spend', 'Pro Commission (seeds)');
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

revoke all on function public.purchase_pro_with_seeds(uuid, integer) from public, anon, authenticated;
grant execute on function public.purchase_pro_with_seeds(uuid, integer) to service_role;
