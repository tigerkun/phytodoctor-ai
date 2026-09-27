-- Pin search_path on touch_updated_at trigger function.
-- The function only calls now(), so the practical risk is nil, but
-- a mutable search_path on any SECURITY DEFINER function is a known
-- privilege-escalation vector in Postgres. Close it.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
