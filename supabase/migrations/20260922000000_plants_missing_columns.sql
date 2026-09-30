-- The original plants_and_storage_rls migration declares nine columns in its
-- CREATE TABLE, but the table in production was created without them and no
-- later migration added them. Every client write goes through plantToPostgres()
-- and formatPlantForPostgres(), both of which emit all nine, so saving a
-- specimen failed with:
--
--   Could not find the 'acquired_at' column of 'plants' in the schema cache
--
-- which is a hard failure — creating a plant was impossible for every user.
-- All nine are additive and nullable (or defaulted), so no backfill is needed
-- and existing rows are unaffected.
alter table public.plants add column if not exists acquired_at timestamptz not null default now();
alter table public.plants add column if not exists soil_ph numeric(3, 1);
alter table public.plants add column if not exists pot_material text default 'terracotta';
alter table public.plants add column if not exists latitude double precision;
alter table public.plants add column if not exists longitude double precision;
alter table public.plants add column if not exists hardiness_zone text;
alter table public.plants add column if not exists check_in_time text default '08:00';
alter table public.plants add column if not exists baseline_signature jsonb;
alter table public.plants add column if not exists is_demo boolean not null default false;

-- Guard: every column the client writes must exist, or the insert path breaks
-- again the next time a migration is applied out of band.
do $$
declare
  v_missing text;
begin
  select string_agg(expected.name, ', ')
    into v_missing
  from unnest(array[
      'acquired_at', 'soil_ph', 'pot_material', 'latitude', 'longitude',
      'hardiness_zone', 'check_in_time', 'baseline_signature', 'is_demo'
    ]) as expected(name)
   where not exists (
     select 1
       from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = 'plants'
        and col.column_name = expected.name
   );

  if v_missing is not null then
    raise exception 'plants is still missing columns the client writes: %', v_missing;
  end if;
end $$;
