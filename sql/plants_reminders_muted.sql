-- Additive migration: add reminders_muted column to plants table.
--
-- Required for the per-plant reminder mute (Plant Profile Drawer toggle) to
-- reach the server's watering push daemon (runWateringReminders), which
-- skips plants with reminders_muted = true. Until applied, the daemon
-- detects the missing column and falls back to the pre-migration query,
-- treating every plant as unmuted.

alter table if exists public.plants
  add column if not exists reminders_muted boolean;
