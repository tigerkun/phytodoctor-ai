--    Seed earning ceiling — ONE-EDIT, ONE-PASTE
--
--    Decision needed from the owner: what should the server-side DAILY CREDIT
--    ceiling be? Edit the value below, paste the whole file into the Supabase
--    SQL editor, Run. Idempotent; safe to replay with a different number later.
--
--    ── The numbers that frame the decision ──────────────────────────────────
--    Advertised to players (RuleBook):          150/day for ACTIVE tasks only
--    (logins, diagnoses, posts). Check-ins, discovery bonuses and streaks are
--    SEPARATE sources and do not count against that 150.
--    Current server ceiling:                    2000/day, all sources summed.
--    Pro costs:                                 1000 seeds (Rs 99/month).
--
--    Direct minting was closed (economy_service_role_only.sql): increment_seeds
--    is service-role only now. The remaining exposure is /api/economy/seed-sync,
--    which still trusts the client's delta — a determined user can mint up to
--    the daily ceiling through it, once per day, and that is enough for two
--    Pro purchases.
--
--    ── Choosing the value ────────────────────────────────────────────────────
--    * 150  — matches the advertisement but WILL block honest players: a
--             check-in (~25) plus a discovery bonus (~50-100) plus tasks
--             (150) legitimately sums past it. Do not pick this for the
--             ALL-SOURCES ceiling.
--    * ~400 — covers honest play with headroom (tasks 150 + check-ins +
--             a discovery + streak rewards) while making a stolen Pro cost
--             2-3 days instead of one.
--    * 1000 — the softest change that still caps a cheater at ONE Pro per day
--             instead of two.
--    The max all-time legitimate credit on record is 583/day (one user, one
--    day) — whatever you pick should sit above that number.
--
--    The client-side 150/day active-task cap (rewardService) is unchanged by
--    this file and stays the gameplay rule; this ceiling is the anti-forgery
--    brake behind it.

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
  -- ⬇ Set to 400 on the owner's go-ahead: honest play (tasks 150 + check-ins +
  --    discovery + streaks) fits with headroom, while a stolen Pro now costs
  --    2-3 days instead of one. Max legitimate day on record was 583.
  daily_credit_cap constant integer := 400;
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

revoke all on function public.increment_seeds(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid) to service_role;
