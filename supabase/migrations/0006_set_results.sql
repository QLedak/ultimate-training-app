-- Adds per-set detail storage to logged_exercises, for the guided
-- step-by-step workout flow. The existing flat columns (weight_used,
-- reps_completed, sets_completed, rir) remain the source of truth for
-- every existing consumer (Phase Performance Summary compile, the review
-- screens, etc.) — they're still populated on every write, just now
-- computed FROM set_results when the guided flow is what submitted them,
-- same as before when the old single-entry form is what submitted them.
--
-- set_results is nullable and additive: rows written by the existing
-- manual logging form (no per-set breakdown) simply leave it null, and
-- every existing read path that doesn't know about it is unaffected.
--
-- Shape (not DB-enforced, documented here): an array of
--   { set_number: number, weight_used: number | null,
--     reps_completed: number | null, rir: number | null }

alter table logged_exercises
  add column if not exists set_results jsonb;
