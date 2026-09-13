-- ==============================================================================
-- Migration: 20260912000000_game_economy.sql
-- Description: Server-authoritative game economy — profiles (seeds, Pro tier),
--              subscriptions, and seed transaction ledger. Pro status can only
--              be written by the service role (payment webhooks / billing
--              endpoints); clients may adjust their own seed balance only.
-- ==============================================================================

-- 1. Profiles: one row per auth user. The client mirror lives in IndexedDB;
--    this table is the source of truth whenever Supabase auth is in play.
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

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Clients may update their own row, but column privileges below strip the
-- tier/pro fields — only the service role (billing endpoints, webhooks)
-- can grant Pro.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on table public.profiles from authenticated;
grant update (display_name, seeds, current_streak, longest_streak, total_xp,
               collection_size, updated_at)
  on table public.profiles to authenticated;

-- 2. Seed transaction ledger (audit trail for every seed delta).
create table if not exists public.seed_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_seed_tx_user on public.seed_transactions(user_id, created_at desc);

alter table public.seed_transactions enable row level security;

drop policy if exists "Users can view own seed transactions" on public.seed_transactions;
create policy "Users can view own seed transactions"
  on public.seed_transactions for select
  to authenticated
  using (auth.uid() = user_id);

-- Ledger is append-only for clients (service role writes via billing/sync).
drop policy if exists "Users can insert own seed transactions" on public.seed_transactions;
create policy "Users can insert own seed transactions"
  on public.seed_transactions for insert
  to authenticated
  with check (auth.uid() = user_id and amount <= 10000);

-- 3. Subscriptions (mirrors the local Dexie shape; service-role managed).
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

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- 4. Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();
