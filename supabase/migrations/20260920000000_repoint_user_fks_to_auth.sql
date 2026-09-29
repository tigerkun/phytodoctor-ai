-- ==============================================================================
-- Migration: 20260920000000_repoint_user_fks_to_auth.sql
-- Description: Close the last legacy `public.users` drift. The RLS policies on
--              every table already bind to auth.uid(), and profiles /
--              seed_transactions / push_subscriptions already reference
--              auth.users(id), but plants, diagnoses, checkins and
--              journal_entries still had their user_id foreign key pointing at
--              the abandoned public.users table.
--
--              Nothing ever wrote to public.users (handle_new_user() only
--              inserts into public.profiles) and the table is empty, so every
--              insert against those four tables failed with:
--                ERROR 23503: insert or update on table "plants" violates
--                foreign key constraint "plants_user_id_fkey"
--                DETAIL: Key (user_id)=(...) is not present in table "users".
--              That is the app's core capture path — saving a plant, a
--              diagnosis, a check-in or a journal entry all failed in
--              production for every signed-in user.
--
--              This repoints the four constraints at auth.users(id), matching
--              the original table definitions and the rest of the schema.
--              All four tables are empty, so there is no data to remap and no
--              orphaned rows to reconcile.
-- ==============================================================================

-- 1. plants
alter table public.plants
  drop constraint if exists plants_user_id_fkey;
alter table public.plants
  add constraint plants_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 2. diagnoses
alter table public.diagnoses
  drop constraint if exists diagnoses_user_id_fkey;
alter table public.diagnoses
  add constraint diagnoses_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 3. checkins
alter table public.checkins
  drop constraint if exists checkins_user_id_fkey;
alter table public.checkins
  add constraint checkins_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 4. journal_entries
alter table public.journal_entries
  drop constraint if exists journal_entries_user_id_fkey;
alter table public.journal_entries
  add constraint journal_entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 5. The legacy tables these constraints were the last thing pointing at.
--    public.users duplicates profiles (tier, seeds, total_xp, streaks) and is
--    a standing invitation to reintroduce this same drift; public.seeds_ledger
--    duplicates seed_transactions. Neither appears in any migration or in the
--    application code, and both are empty, so they are dropped rather than left
--    behind as a second source of truth. Guarded so this stays idempotent.
drop table if exists public.seeds_ledger;
drop table if exists public.users;

-- 6. Prove the repair: every user_id in public now resolves against auth.users.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%I.%I -> %s', src.relname, att.attname, tgt_ns.nspname || '.' || tgt.relname), ', ')
    into v_bad
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_namespace src_ns on src_ns.oid = src.relnamespace
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace tgt_ns on tgt_ns.oid = tgt.relnamespace
  join unnest(con.conkey) k(attnum) on true
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
  where con.contype = 'f'
    and src_ns.nspname = 'public'
    and att.attname = 'user_id'
    and tgt_ns.nspname <> 'auth';
  if v_bad is not null then
    raise exception 'user_id still references a non-auth table: %', v_bad;
  end if;
end $$;
