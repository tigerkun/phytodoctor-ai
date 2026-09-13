-- ==============================================================================
-- Migration: 20260909000000_plants_and_storage_rls.sql
-- Description: Create plants table, indexes, Row-Level Security (RLS) policies,
--              Supabase Realtime publication, and plant-photos storage bucket rules.
-- ==============================================================================

-- 1. Create plants table
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null default 'Unnamed Specimen',
  species text not null default 'Botanical Specimen',
  acquired_at timestamptz not null default now(),
  soil_type text default 'well-draining',
  soil_ph numeric(3, 1),
  pot_size text,
  pot_material text default 'terracotta',
  location text default 'Conservatory',
  latitude double precision,
  longitude double precision,
  hardiness_zone text,
  check_in_time text default '08:00',
  baseline_signature jsonb,
  guardian_score integer not null default 50,
  status text not null default 'Stable',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);

-- 2. Performance indexes
create index if not exists idx_plants_user_id on public.plants(user_id);
create index if not exists idx_plants_created_at on public.plants(created_at desc);
create index if not exists idx_plants_user_created on public.plants(user_id, created_at desc);

-- 3. Enable Row-Level Security (RLS)
alter table public.plants enable row level security;

-- 4. Granular table policies (isolated per authenticated user)
drop policy if exists "Users can view their own plants" on public.plants;
create policy "Users can view their own plants"
  on public.plants
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own plants" on public.plants;
create policy "Users can insert their own plants"
  on public.plants
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own plants" on public.plants;
create policy "Users can update their own plants"
  on public.plants
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own plants" on public.plants;
create policy "Users can delete their own plants"
  on public.plants
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 5. Enable Supabase Realtime broadcast for reactive updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plants'
  ) then
    alter publication supabase_realtime add table public.plants;
  end if;
end $$;

-- 6. Storage Bucket Configuration for 'plant-photos'
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do nothing;

-- 7. Storage RLS Policies
-- Path format: `${auth.uid()}/${uuid}.${ext}`

-- Public read access to plant photos
drop policy if exists "Public read access for plant photos" on storage.objects;
create policy "Public read access for plant photos"
  on storage.objects
  for select
  using (bucket_id = 'plant-photos');

-- Authenticated upload only to user's own folder
drop policy if exists "Users can upload their own plant photos" on storage.objects;
create policy "Users can upload their own plant photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update only to user's own photos
drop policy if exists "Users can update their own plant photos" on storage.objects;
create policy "Users can update their own plant photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete only to user's own photos
drop policy if exists "Users can delete their own plant photos" on storage.objects;
create policy "Users can delete their own plant photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
