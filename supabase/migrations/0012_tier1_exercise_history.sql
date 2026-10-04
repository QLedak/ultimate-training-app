-- Weight-estimation audit (see lib/pps/compile.ts): phase_performance_summaries
-- only ever tracked a rep-scheme-normalized 1RM for the 5 named canonical
-- barbell lifts (updated_maxes/performance_vs_prescription, keyed by lift
-- name). Every OTHER Tier 1 exercise (incline DB press, RDL, Bulgarian split
-- squat, etc.) had no equivalent — the Phase Builder had nothing but a raw
-- logged weight to go on for those, which is exactly how a flat weight could
-- get carried forward across a changed rep scheme (e.g. a 4x10 @135 squat
-- variant's weight reappearing unchanged for a 5x5 the next phase). This adds
-- a generic, per-exercise_id history (Epley-estimated 1RM + last clean set)
-- covering every Tier 1 lift actually logged in the phase, not just the 5
-- canonical ones.
alter table phase_performance_summaries
  add column tier1_exercise_history jsonb not null default '{}';
