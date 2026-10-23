-- Additive migration: add recovery_roadmap JSONB column to plants table.
--
-- Required for treatment roadmap milestone push reminders daemon
-- (runTreatmentRoadmapReminders) to query active recovery timelines.

alter table if exists public.plants
  add column if not exists recovery_roadmap jsonb;
