-- Additive migration: allow new kind values in push_alert_log.
--
-- The initial push_alert_log table had an inline check:
-- check (kind in ('watering', 'test')).
-- To support 'watering-action' and milestone reminders 'treatment-d{N}',
-- drop the check constraint if it exists.

alter table if exists public.push_alert_log
  drop constraint if exists push_alert_log_kind_check;
