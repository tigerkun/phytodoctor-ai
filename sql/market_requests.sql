--    Player product requests — the market's "ask the bazaar" board
--
--    Players ask for real-world plant/garden products they want stocked in the
--    Garden Market; the owner refreshes the stalls daily and stocks what is
--    asked for. Idempotent and safe to replay. Run in the Supabase SQL editor.
--
--    Access model:
--      * INSERT — authenticated, own rows only (auth.uid() = user_id).
--      * SELECT — any signed-in Keeper, so the board is community-visible and
--        request counts feel shared.
--      * No UPDATE/DELETE for players — requests are a wishlist, not a feed.
--      * The service role (server route) writes nothing here; the client
--        inserts directly under RLS.
--
--    Spam control is enforced in the Express route (/api/market/request via a
--    count query), not here — RLS stays policy-simple.

create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_name text not null check (char_length(btrim(product_name)) between 3 and 120),
  category text not null default 'other'
    check (category in ('pots', 'care', 'tools', 'seeds', 'home', 'books', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now()
);

alter table public.product_requests enable row level security;

drop policy if exists "product_requests_read_authenticated" on public.product_requests;
create policy "product_requests_read_authenticated"
  on public.product_requests for select
  to authenticated
  using (true);

drop policy if exists "product_requests_insert_own" on public.product_requests;
create policy "product_requests_insert_own"
  on public.product_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Newest first on the board; the route also filters a per-user daily window.
create index if not exists idx_product_requests_created
  on public.product_requests (created_at desc);
create index if not exists idx_product_requests_user
  on public.product_requests (user_id, created_at desc);

-- The board is player content: revoke the direct anon path explicitly, the
-- same posture as the rest of the economy tables.
revoke all on public.product_requests from anon;
