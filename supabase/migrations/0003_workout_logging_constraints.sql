-- Supports the athlete-facing workout logging UI (workout-logging-schema-spec.md).
--
-- logged_exercises had no uniqueness constraint on (session_id, exercise_id)
-- even though the spec defines it as "one row per prescribed exercise per
-- session" — without this, re-opening and re-saving a session's log would
-- pile up duplicate rows instead of updating in place. Adding it lets the
-- logging API safely upsert on (session_id, exercise_id).
--
-- Run this in the Supabase SQL editor after 0001_init.sql and
-- 0002_split_deadlift_power_clean.sql.

alter table logged_exercises
  add constraint logged_exercises_session_exercise_unique unique (session_id, exercise_id);
