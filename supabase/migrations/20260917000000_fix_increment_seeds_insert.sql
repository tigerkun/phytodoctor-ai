-- Fix: increment_seeds() INSERT lists 5 target columns but supplies only 4 values.
--
-- Migration 20260915000000_reconcile_legacy_production.sql (migration 12) re-created
-- public.increment_seeds with this insert:
--
--   insert into public.seed_transactions (id, user_id, amount, source, description)
--   values (p_transaction_id, p_user_id, p_amount, left(coalesce(p_description, ''), 200))
--
-- p_source is missing, so the statement raises
--   ERROR: INSERT has more target columns than expressions
-- at RUN time, not at CREATE time. Postgres does not validate the row shape when the
-- function is created, which is why the earlier pronargs = 5 verification passed while
-- the function was still unusable.
--
-- public.seed_transactions.source is `text not null` with no default
-- (20260912000000_game_economy.sql:57), so there is no fallback value.
--
-- Impact: every call to increment_seeds() fails with a 500. The client seed-sync outbox
-- treats 5xx as retryable and retains the entry, so no delta is silently dropped -- but
-- nothing is ever written to the ledger and no balance is ever applied.
--
-- This migration restores the verified-good body from
-- 20260913000000_harden_seed_mutations.sql, which supplies all five values.
-- Already-applied migration files are deliberately left untouched; this is an additive
-- corrective migration so the full history remains replayable in order.

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

revoke all on function public.increment_seeds(uuid, integer, text, text, uuid) from public, anon;
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to service_role;
