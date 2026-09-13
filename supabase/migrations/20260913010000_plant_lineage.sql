alter table public.plants add column if not exists parent_plant_id uuid references public.plants(id);
alter table public.plants add column if not exists propagation_method text
  check (propagation_method in ('cutting', 'division', 'seed', 'offset'));
alter table public.plants add column if not exists generation integer not null default 1
  check (generation > 0);
create index if not exists idx_plants_parent on public.plants(parent_plant_id);
