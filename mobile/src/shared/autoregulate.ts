/**
 * Set-to-set weight autoregulation for the guided workout flow: suggests a
 * weight for the athlete's NEXT set based on the perceived-effort rating
 * (see lib/training/perceived-effort.ts) they just gave the set before it.
 *
 * The rating is read directly as an EffortLevel rather than as a numeric RIR
 * — per testing feedback, the adjustment is a flat, coarse step keyed to the
 * rating itself, not a scaled distance from some numeric target:
 *   - "moderate" or "hard" (the two middle, on-plan ratings): keep the same
 *     weight — this is exactly where the set was supposed to land, so the
 *     next set repeats it. (This also fixes a real bug: "hard" used to map
 *     to the same numeric RIR as the old target, which produced a `null`
 *     suggestion that looked, to the athlete, like nothing had happened —
 *     it's now an explicit "keep the weight" suggestion instead.)
 *   - "very_easy" or "easy": the set had too much left in the tank — bump
 *     the next set up by WEIGHT_STEP_LB.
 *   - "very_hard" or "did_not_complete": the set was at or past the ceiling
 *     — drop the next set by WEIGHT_STEP_LB.
 *
 * This is intentionally a same-exercise, same-workout micro-adjustment, not a
 * rewrite of the day's prescribed load — the caller always treats the result
 * as a pre-fill the athlete can overwrite, never a locked value.
 */

import { EffortLevel } from "./perceived-effort";

/** Flat weight change, in pounds, applied for an easier/harder-than-target set. */
const WEIGHT_STEP_LB = 5;

export type WeightSuggestion = {
  weight: number;
  /** Signed pounds actually applied, e.g. 5 = +5 lb, -10 = -10 lb, 0 = kept the same. */
  deltaLb: number;
};

/**
 * Returns a suggested weight for the next set, or null when there's nothing
 * to suggest (missing/invalid prior weight or effort rating). A "keep the
 * same weight" result (moderate/hard) is returned as a real WeightSuggestion
 * with deltaLb: 0 — not null — so the UI can still show the athlete that the
 * weight was deliberately confirmed, not just left untouched.
 */
export function suggestNextWeight(priorWeight: number, effort: EffortLevel | "" | null | undefined): WeightSuggestion | null {
  if (!priorWeight || priorWeight <= 0 || !effort) return null;

  let deltaLb: number;
  switch (effort) {
    case "moderate":
    case "hard":
      deltaLb = 0;
      break;
    case "very_easy":
    case "easy":
      deltaLb = WEIGHT_STEP_LB;
      break;
    case "very_hard":
    case "did_not_complete":
      deltaLb = -WEIGHT_STEP_LB;
      break;
    default:
      return null;
  }

  const weight = Math.max(WEIGHT_STEP_LB, priorWeight + deltaLb);
  return { weight, deltaLb };
}
