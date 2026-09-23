/**
 * Set-to-set weight autoregulation for the guided workout flow: suggests a
 * weight for the athlete's NEXT set based on the perceived-effort rating
 * (see lib/training/perceived-effort.ts) they just gave the set before it.
 *
 * There's no prescribed per-set target RIR anywhere in the schema today —
 * prescribed_target is %1RM/rep-range text (see workout-logging-schema-spec.md),
 * with RIR captured only after the fact. TARGET_RIR below is a working
 * default, not a per-program value: it reuses the same RIR >= 2 threshold
 * system-prompt-v3.md already treats as "on plan" for phase-to-phase load
 * decisions, so a set landing at 2 RIR is left alone here too, and sets that
 * come in easier or harder nudge the very next set up or down.
 *
 * The adjustment is a flat weight step, not a percentage: every RIR point
 * away from target moves the suggestion by WEIGHT_STEP_LB, in either
 * direction, for every exercise that uses a weight metric. That's simpler to
 * reason about mid-set than a %-of-current-load calculation, and it's a
 * request the coach can tune in one place. Bodyweight/no-load exercises are
 * out of scope for the caller to decide (tier 3), not this function.
 *
 * This is intentionally a same-exercise, same-workout micro-adjustment, not a
 * rewrite of the day's prescribed load — the caller always treats the result
 * as a pre-fill the athlete can overwrite, never a locked value.
 */

export const TARGET_RIR = 2;

/** Flat weight change, in pounds, per RIR point away from target. */
const WEIGHT_STEP_LB = 5;

export type WeightSuggestion = {
  weight: number;
  /** Signed pounds actually applied, e.g. 5 = +5 lb, -10 = -10 lb. */
  deltaLb: number;
};

/**
 * Returns a suggested weight for the next set, or null when no change is
 * warranted (RIR at target, or missing/invalid inputs).
 */
export function suggestNextWeight(priorWeight: number, actualRir: number): WeightSuggestion | null {
  if (!priorWeight || priorWeight <= 0 || !Number.isFinite(actualRir)) return null;

  const stepsFromTarget = actualRir - TARGET_RIR;
  if (stepsFromTarget === 0) return null;

  const deltaLb = stepsFromTarget * WEIGHT_STEP_LB;
  const weight = Math.max(WEIGHT_STEP_LB, priorWeight + deltaLb);

  return { weight, deltaLb };
}
