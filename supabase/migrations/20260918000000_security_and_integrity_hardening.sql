-- Security and integrity hardening (2026-09-28 audit).
-- Every statement is idempotent; safe to re-run.
--
-- 1. profiles INSERT revoked from authenticated.
--    The table-level grant (20260915000000:87) let any user create their own
--    profile row with arbitrary seeds/tier — the column-level UPDATE grants do
--    not constrain INSERT, and the only table bound is `seeds >= 0`. Row
--    creation stays covered by the handle_new_user() trigger (SECURITY
--    DEFINER) and the server's create-if-missing bootstrap (service role).
--    Verified before writing: no client code touches profiles directly.
--
-- 2. on_auth_user_created re-asserted.
--    Migration 12 drops and re-creates this trigger in one file, but the
--    re-create was added by amending the file after it had already been
--    recorded in production — databases that ran the earlier version have no
--    trigger and depend solely on the server bootstrap. Drop+create here
--    converges every environment.
--
-- 3. seed_transactions.source CHECK.
--    The source whitelist lived only inside increment_seeds and the API
--    route. All current writers emit whitelisted values ('spend' from
--    purchase_pro_with_seeds, the four sources via the RPC), so the
--    constraint is safe to enforce now.
--
-- 4. subscriptions.razorpay_payment_id UNIQUE.
--    Webhook replay dedup relied on an advisory lock plus SELECT ... FOR
--    UPDATE alone; a database-level guarantee costs one partial index.
--
-- 5. plants.parent_plant_id ON DELETE SET NULL.
--    The lineage FK defaulted to NO ACTION, so deleting a parent plant with
--    living children raised a foreign-key violation.
--
-- 6. Daily seed-credit cap enforced by the database.
--    increment_seeds accepted unlimited positive deltas of up to ±10,000
--    each; a forged client could mint ~600k seeds/minute and convert them to
--    Pro for free. Legitimate daily earnings peak well under 1,000 (150 in
--    capped rewards, one 800-point discovery, check-ins), so a 2,000/day
--    ceiling cannot reach real players while capping abuse at 2,000/day per
--    account. The check runs only for NEW transactions — after the
--    idempotent replay short-circuit — so replays are never blocked, and it
--    reads the ledger inside the same statement as the pending INSERT, so a
--    rejection rolls the ledger row back atomically.

-- ── 1. Profile rows are created by the trigger / service role, not clients ──
revoke insert on table public.profiles from authenticated;
drop policy if exists "Users can insert own profile" on public.profiles;

-- ── 2. Signup trigger present in every environment ─────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 3. Ledger source integrity ──────────────────────────────────────────────
alter table public.seed_transactions
  drop constraint if exists seed_transactions_source_check;
alter table public.seed_transactions
  add constraint seed_transactions_source_check
  check (source in ('checkin', 'bonus', 'spend', 'reward'));

-- ── 4. One payment id can only ever belong to one subscription row ─────────
create unique index if not exists idx_subscriptions_payment_id
  on public.subscriptions (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- ── 5. Lineage survives parent deletion ─────────────────────────────────────
alter table public.plants
  drop constraint if exists plants_parent_plant_id_fkey;
alter table public.plants
  add constraint plants_parent_plant_id_fkey
  foreign key (parent_plant_id) references public.plants (id)
  on delete set null;

-- ── 6. increment_seeds with a database-enforced daily credit ceiling ───────
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
  next_balance   integer;
  credited_today integer;
  -- Legitimate play peaks under ~1,000/day; see the file header. Keep well
  -- clear of that ceiling so the brake only ever fires on forged traffic.
  daily_credit_cap constant integer := 2000;
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

  -- Replay of an already-applied transaction: return the live balance and
  -- never let the credit cap retro-block a replay.
  if not found then
    select seeds into next_balance
    from public.profiles
    where user_id = p_user_id;
    return next_balance;
  end if;

  -- New positive transaction: this statement's own INSERT is visible to the
  -- sum below, so exceeding the ceiling raises here and rolls the INSERT
  -- back atomically. Spends (negative amounts) are unaffected.
  if p_amount > 0 then
    select coalesce(sum(amount), 0) into credited_today
    from public.seed_transactions
    where user_id = p_user_id
      and amount > 0
      and created_at >= date_trunc('day', now());

    if credited_today > daily_credit_cap then
      raise exception 'daily seed credit limit';
    end if;
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
