-- Reconcile deployments where the legacy public tables predate the game economy.
-- This is additive: legacy data is preserved and no automatic user/balance mapping
-- is attempted without a verified auth.users relationship.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  seeds integer not null default 500 check (seeds >= 0),
  tier text not null default 'free' check (tier in ('free', 'pro')),
  pro_expires_at timestamptz,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  total_xp integer not null default 0,
  collection_size integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on table public.profiles from authenticated;
grant update (display_name, current_streak, longest_streak,
              total_xp, collection_size, updated_at)
  on table public.profiles to authenticated;

create table if not exists public.seed_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_seed_tx_user
  on public.seed_transactions(user_id, created_at desc);

alter table public.seed_transactions enable row level security;
revoke all on table public.seed_transactions from anon;

drop policy if exists "Users can view own seed transactions" on public.seed_transactions;
create policy "Users can view own seed transactions"
  on public.seed_transactions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own seed transactions" on public.seed_transactions;
revoke insert, update, delete on table public.seed_transactions from authenticated;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'pro' check (tier in ('free', 'pro')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  razorpay_subscription_id text,
  razorpay_payment_id text
);

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anon;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.subscriptions from authenticated;
grant select on table public.profiles, public.seed_transactions, public.subscriptions
  to authenticated;
grant insert on table public.profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
  values (p_transaction_id, p_user_id, p_amount, left(coalesce(p_description, ''), 200))
  on conflict (id) do nothing;

  if not found then
    select seeds into next_balance from public.profiles where user_id = p_user_id;
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
grant execute on function public.increment_seeds(uuid, integer, text, text, uuid)
  to authenticated, service_role;

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

  select * into v_profile from public.profiles
   where user_id = p_user_id for update;
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
  return json_build_object(
    'seeds', v_new_seeds,
    'tier', 'pro',
    'pro_expires_at', v_expires
  );
end;
$$;

revoke all on function public.purchase_pro_with_seeds(uuid, integer) from public, anon;
grant execute on function public.purchase_pro_with_seeds(uuid, integer)
  to authenticated, service_role;
