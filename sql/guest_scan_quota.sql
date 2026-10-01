-- Guest scan quota, shared across every server instance.
--
-- WHY THIS EXISTS
--
-- The guest lane lets a signed-out visitor reach /api/identify, and each of
-- those calls costs a Gemini request. The cap was held in an in-process Map,
-- which is per instance. Confirmed in production: two requests were refused
-- by one instance and a third, immediately after, was granted by a second --
--
--     1: 400 (quota available)
--     2: 400
--     3: 401 "free guest scans are used up for today"
--     4: 400  <- different instance, quota brand new
--     5: 401
--     6: 401
--
-- So the real daily allowance is 2 x number-of-instances, not 2.
--
-- Run this once in the Supabase SQL editor. Until it runs, the server logs a
-- warning and keeps using the in-process Map -- nothing breaks either way.
--
-- The address is never stored raw. The server hashes it with SHA-256 and only
-- the digest reaches this table, so a dump of it cannot identify anyone.

create table if not exists guest_scan_quota (
  bucket     text primary key,          -- action:ip_digest:YYYY-MM-DD
  action     text    not null,
  ip_digest  text    not null,
  day        date    not null,
  used       integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Supports the prune below and any manual inspection by day.
create index if not exists guest_scan_quota_day_idx on guest_scan_quota (day);

-- Count one use against a bucket and report whether it was within the limit.
--
-- Two properties matter, and the in-memory version's tests are the reference:
--   - a denied request must not consume quota, so a client hammering a closed
--     gate sees the same answer every time instead of drifting; and
--   - concurrent callers must not both read "1 used" and both be granted the
--     second slot. That is what the advisory lock is for: without it this is
--     a read-modify-write race and the cap leaks under load.
create or replace function take_guest_scan(
  p_bucket    text,
  p_action    text,
  p_ip_digest text,
  p_day       date,
  p_limit     integer
)
returns table (allowed boolean, used integer, "limit" integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  -- A non-positive limit is how the server probes for this function's
  -- existence. Answer without touching the table so the probe leaves nothing
  -- behind.
  if p_limit <= 0 then
    return query select false, 0, 0;
    return;
  end if;

  -- Serialise everything touching this bucket for the rest of the
  -- transaction. hashtext gives us a 32-bit key; collisions cost a little
  -- extra serialisation, never correctness.
  perform pg_advisory_xact_lock(hashtext(p_bucket));

  select g.used into v_used
    from guest_scan_quota g
   where g.bucket = p_bucket
     for update;

  if v_used is not null and v_used >= p_limit then
    return query select false, v_used, p_limit;
    return;
  end if;

  insert into guest_scan_quota as g (bucket, action, ip_digest, day, used)
  values (p_bucket, p_action, p_ip_digest, p_day, 1)
  on conflict (bucket) do update
    set used = g.used + 1, updated_at = now()
  returning g.used into v_used;

  return query select true, v_used, p_limit;

  -- Opportunistic prune. Two days of history is enough for a UTC day to roll
  -- over, and the guard keeps it off the hot path.
  if random() < 0.01 then
    delete from guest_scan_quota where day < current_date - 2;
  end if;
end;
$$;

-- The function is server-side only. service_role is the only caller: the
-- client bundle must not be able to mint itself guest scans.
revoke all on function take_guest_scan(text, text, text, date, integer) from public, anon, authenticated;
grant execute on function take_guest_scan(text, text, text, date, integer) to service_role;

-- No RLS policy on purpose: only service_role reaches this table, and a
-- permissive policy would hand anonymous callers the scan counter.
alter table guest_scan_quota enable row level security;
