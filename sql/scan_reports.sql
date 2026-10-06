-- scan_reports: the backend's system of record for finished scan analyses.
--
-- /api/identify persists every shaped report here (service-role, fire-and-
-- forget): the account that ran it, or a hashed IP for guests, the subject
-- kind, the triage route, and the full versioned report JSON. The photo is
-- never uploaded or stored — this table holds the finished text report only.
--
-- Additive migration, applied by hand (see AGENTS.md). Until it exists the
-- server logs one warning, disables persistence for the process lifetime,
-- and /healthz lists the table under schema.missingOptionalTables.

create table if not exists public.scan_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_ip_hash text,
  kind text not null,
  route text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists scan_reports_user_created_idx
  on public.scan_reports (user_id, created_at desc);

-- The retention prune filters on created_at alone; a composite index led by
-- user_id cannot serve that range scan.
create index if not exists scan_reports_created_at_idx
  on public.scan_reports (created_at desc);

-- RLS on before the revokes: even if a grant is ever re-added, no policy
-- exists, so direct client access stays denied. The Express server reads and
-- writes through supabaseAdmin, which bypasses RLS.
alter table public.scan_reports enable row level security;

-- Service-role only, like guest_scan_quota and market_ledger: the anon and
-- authenticated roles have no direct access — the Express server reads and
-- writes through supabaseAdmin.
revoke all on public.scan_reports from anon, authenticated;
