--    Market ledger — cross-device sync of purchased state
--
--    The marketLedger row (punched tickets, claimed seed-refund codes,
--    basket, wishlist) is bought with seeds and used to live only in the
--    browser's IndexedDB: clear site data or switch devices and the purchases
--    were gone. This table is the server-side mirror the client reconciles
--    with — last-writer-wins on the row's own updatedAt, which the client
--    stamps on every write.
--
--    Access model:
--      * The Express routes (/api/market/ledger via the service role) read and
--        write on behalf of the signed-in Keeper; the service role bypasses
--        RLS, so these policies are defence in depth, not the gate.
--      * Players never touch this table directly from the client — there is
--        no anon/authenticated policy needed, and none is granted.
--      * One row per user; the whole ledger travels as JSONB so the client
--        can evolve the shape without a migration for every field.
--
--    Idempotent and safe to replay. Run in the Supabase SQL editor.

create table if not exists public.market_ledger (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.market_ledger enable row level security;

-- No policies granted on purpose: only the service role writes here, and the
-- service role bypasses RLS entirely. Keeping the table closed to clients is
-- the point — purchased state reaches the server only through the validated
-- route, never around it.
