-- ==============================================================================
-- Migration: 20260921000000_push_reminder_state.sql
-- Description: State needed to actually send push notifications.
--
--              push_subscriptions could store an endpoint but nothing ever
--              sent to it, and there was no way to tell a first reminder from
--              a repeat. last_sent_at lets the watering-reminder job throttle
--              itself per subscription so a plant that stays due does not
--              generate a notification on every scheduler tick.
--
--              The reminder payload also needs somewhere to record which
--              plants a user has already been told about, so a single push can
--              summarise everything that is due.
-- ==============================================================================

alter table public.push_subscriptions
  add column if not exists last_sent_at timestamptz;

create table if not exists public.push_alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete cascade,
  kind text not null default 'watering' check (kind in ('watering', 'test')),
  sent_at timestamptz not null default now()
);

-- One reminder per plant per day. The sender upserts on this key, so a retry
-- after a crash cannot produce a second notification for the same plant.
create index if not exists idx_push_alert_log_user_day
  on public.push_alert_log (user_id, plant_id, sent_at desc);

alter table public.push_alert_log enable row level security;

-- No policies: the table is written and read only by the server using the
-- service-role client, which bypasses RLS. Clients have no business reading
-- another user's delivery log.
revoke all on table public.push_alert_log from anon, authenticated;
