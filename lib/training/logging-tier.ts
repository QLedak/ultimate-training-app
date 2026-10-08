/**
 * Logging tier (1/2/3) per workout-logging-schema-spec.md. v2 library rows
 * carry an explicit `logging_tier` (loaded Technical coordination, Absolute
 * strength and compound Hypertrophy = 1; Injury resilience = 2; everything else
 * = 3). Legacy v1 rows had no such field, so for them the tier is still derived
 * from the row's own tagging as described here:
 *
 *   - Tier 1 (primary/load-bearing, %-based prescriptions): main compound
 *     patterns — squat, hinge, upper push/pull, lunge/single-leg, Olympic
 *     lift variants. This is exactly the set of movements a Phase Builder
 *     %-based prescription is actually built on (Back Squat, Bench Press,
 *     Deadlift, Power Clean, weighted Pull-up progressions, etc.).
 *   - Tier 2 (resilience/standing prehab): anything tagged with one or more
 *     injury_considerations — this is precisely the Exercise Library's own
 *     marker for standing injury-history work.
 *   - Tier 3 (everything else): accessory, conditioning, mobility, warm-up.
 *
 * injury_considerations is checked first: an exercise can be both a compound
 * pattern AND resilience-tagged (e.g. a single-leg RDL for hamstring
 * history), and the lighter Tier-2 logging burden — plus its resilience-
 * progression tracking in the Phase Performance Summary — is what matters
 * for those, not full %-based Tier-1 logging.
 *
 * Note on warmups: a warmup ramp is attached metadata on a main lift's own
 * prescribed-exercise entry (see the `warmup` array in phase-builder.ts's
 * output schema), not a separate exercises[] row with its own exercise_id —
 * so it never flows through this function at all. There is nothing here to
 * special-case for warmups.
 */

// Exported so lib/pps/compile.ts can identify every Tier 1 exercise_id
// logged in a phase (not just the 5 named canonical barbell lifts) when
// building the generic per-exercise progression history below.
export const TIER_1_MOVEMENT_PATTERNS = new Set([
  "Squat",
  "Hinge",
  "Upper Push",
  "Upper Pull",
  "Lunge / Single-Leg",
  "Olympic Lift",
]);

export type LoggingTier = 1 | 2 | 3;

export function deriveLoggingTier(exercise: {
  movement_pattern?: string | null;
  injury_considerations?: string[] | null;
  /** v2 library rows carry their tier explicitly (set by scripts/convert_exercise_library.py). */
  logging_tier?: number | null;
}): LoggingTier {
  if (exercise.logging_tier === 1 || exercise.logging_tier === 2 || exercise.logging_tier === 3) return exercise.logging_tier;
  if (exercise.injury_considerations && exercise.injury_considerations.length > 0) return 2;
  if (exercise.movement_pattern && TIER_1_MOVEMENT_PATTERNS.has(exercise.movement_pattern)) return 1;
  return 3;
}
