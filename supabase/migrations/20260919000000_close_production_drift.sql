--    Production drift closure — 2026-09-29
--
--    An audit of the live phytoguard project found it had been brought up to
--    20260918000000 (security_and_integrity_hardening) but NOT to completion.
--    Migrations here have been applied by hand through the dashboard SQL
--    editor, not by the Supabase migration runner — there is no
--    supabase_migrations.schema_migrations table in this project at all, so
--    nothing recorded which ones had landed. Two pieces were missing:
--
--      1. public.grant_pro_from_payment — the entire Pro fast-pass grant path.
--         server.ts calls it from the Razorpay webhook. Without it, a real
--         payment would be captured by Razorpay and then fail to grant Pro,
--         with a 500 the user never sees and no retry (Razorpay gives up).
--         Its absence was silent: no health check covers it, because
--         /healthz only reports whether the Razorpay env vars are set.
--
--      2. public.touch_updated_at without a pinned search_path. Pure hardening
--         — the function only calls now() — but a mutable search_path on any
--         function is a known privilege-escalation vector, so close it.
--
--    Both statements are idempotent, so this file is safe to replay.
--
--    Verify with:
--      select proname from pg_proc
--       join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
--       where nspname = 'public' and proname = 'grant_pro_from_payment';

-- ── 1. Payment grant (service_role only) ───────────────────────────────────
create or replace function public.grant_pro_from_payment(
  p_user_id uuid,
  p_payment_id text,
  p_amount integer,
  p_currency text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
  v_existing uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_payment_id is null or length(trim(p_payment_id)) = 0
     or p_amount <> 9900 or p_currency <> 'INR' then
    raise exception 'invalid payment';
  end if;

  -- Serialize duplicate deliveries across all app instances.
  perform pg_advisory_xact_lock(hashtextextended(p_payment_id, 0));
  select user_id into v_existing
    from public.subscriptions
   where razorpay_payment_id = p_payment_id
   for update;
  if v_existing is not null then
    return json_build_object('duplicate', true);
  end if;

  v_expires := now() + interval '31 days';
  update public.profiles
     set tier = 'pro', pro_expires_at = v_expires
   where user_id = p_user_id;
  if not found then raise exception 'profile not found'; end if;

  insert into public.subscriptions (
    user_id, tier, started_at, expires_at, cancel_at_period_end, razorpay_payment_id
  ) values (
    p_user_id, 'pro', now(), v_expires, false, p_payment_id
  )
  on conflict (user_id) do update
    set tier = 'pro', started_at = now(), expires_at = v_expires,
        cancel_at_period_end = false, razorpay_payment_id = excluded.razorpay_payment_id;

  return json_build_object('duplicate', false, 'expires_at', v_expires);
end;
$$;

revoke all on function public.grant_pro_from_payment(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.grant_pro_from_payment(uuid, text, integer, text)
  to service_role;

-- ── 2. Pinned search_path on the updated_at trigger function ───────────────
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
