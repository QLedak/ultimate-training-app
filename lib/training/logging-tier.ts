/**
 * Derives the workout-logging-schema-spec.md logging tier (1/2/3) for an
 * exercise from the Exercise Library's own tagging, since the library has no
 * single explicit "tier" field of its own:
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
 */

const TIER_1_MOVEMENT_PATTERNS = new Set([
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
}): LoggingTier {
  if (exercise.injury_considerations && exercise.injury_considerations.length > 0) return 2;
  if (exercise.movement_pattern && TIER_1_MOVEMENT_PATTERNS.has(exercise.movement_pattern)) return 1;
  return 3;
}
