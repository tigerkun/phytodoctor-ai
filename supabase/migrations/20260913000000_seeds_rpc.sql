-- ==============================================================================
-- Migration: 20260913000000_seeds_rpc.sql
-- Description: Close the seed-inflation hole. `seeds` is no longer directly
--              writable by clients (only the service role and this RPC can
--              change it). The RPC enforces, in the database itself:
--                - |delta| <= 10000 (the app-level cap, now DB-enforced)
--                - row-locked read-modify-write (no lost-update races)
--                - balance floors at 0
--                - every change lands in the seed_transactions ledger
-- ==============================================================================

-- 1. Strip `seeds` from the client-updatable column set.
revoke update on table public.profiles from authenticated;
grant update (display_name, current_streak, longest_streak, total_xp,
               collection_size, updated_at)
  on table public.profiles to authenticated;

-- 2. Ledger becomes service-role/RPC-written only (drop the client insert path).
drop policy if exists "Users can insert own seed transactions" on public.seed_transactions;
revoke insert on table public.seed_transactions from authenticated;

-- 3. The only client-reachable way to change seeds.
create or replace function public.increment_seeds(
  p_delta integer,
  p_source text default 'sync',
  p_description text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
  v_new integer;
  v_applied integer;
begin
  -- DB-enforced caps: no zero deltas, nothing beyond ±10,000 per call.
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'invalid seed delta';
  end if;

  -- Bootstrap the row on first touch.
  insert into public.profiles (user_id, seeds)
  values (auth.uid(), 500)
  on conflict (user_id) do nothing;

  -- Lock the row: concurrent RPCs serialise, so ledger maths stay exact.
  select seeds into v_old
    from public.profiles
   where user_id = auth.uid()
     for update;

  v_new := greatest(0, v_old + p_delta);
  v_applied := v_new - v_old;

  update public.profiles
     set seeds = v_new
   where user_id = auth.uid();

  insert into public.seed_transactions (user_id, amount, source, description)
  values (auth.uid(), v_applied,
          left(coalesce(p_source, 'sync'), 40),
          left(coalesce(p_description, ''), 200));

  return v_new;
end;
$$;

revoke all on function public.increment_seeds(integer, text, text) from public, anon;
grant execute on function public.increment_seeds(integer, text, text) to authenticated;
