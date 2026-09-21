-- Splits the combined "deadlift or power clean" max-lift field into two
-- separate lifts, per coach feedback on the intake form: they're different
-- lifts with different loading and should never have been one input.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) against
-- your existing project, after 0001_init.sql.

-- ============================================================
-- athlete_intake: deadlift_or_clean_weight/reps -> two pairs of columns
-- ============================================================

alter table athlete_intake
  add column deadlift_weight numeric,
  add column deadlift_reps integer,
  add column power_clean_weight numeric,
  add column power_clean_reps integer;

-- Best-effort carry-forward for any rows already submitted under the old
-- combined field: there's no way to know which lift the athlete meant, so
-- this assumes deadlift (the more common of the two to test) and leaves it
-- flagged via a NULL power_clean side. Safe to skip/adjust if you have no
-- real submissions yet.
update athlete_intake
set deadlift_weight = deadlift_or_clean_weight,
    deadlift_reps = deadlift_or_clean_reps
where deadlift_or_clean_weight is not null;

alter table athlete_intake
  drop column deadlift_or_clean_weight,
  drop column deadlift_or_clean_reps;

-- ============================================================
-- current_athlete_state: deadlift_or_clean_1rm -> two columns
-- ============================================================

alter table current_athlete_state
  add column deadlift_1rm numeric,
  add column power_clean_1rm numeric;

update current_athlete_state
set deadlift_1rm = deadlift_or_clean_1rm
where deadlift_or_clean_1rm is not null;

alter table current_athlete_state
  drop column deadlift_or_clean_1rm;
