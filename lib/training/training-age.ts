/**
 * Coaching Philosophy §5 / intake-funnel-spec.md Screen 2:
 *   0-1 yr structured training -> Novice
 *   1-3 yrs -> Intermediate (blend, lean Novice unless other signals say otherwise)
 *   3+ yrs -> Advanced
 * Cross-checked against the athlete's self-described lifting experience —
 * a mismatch (e.g., "10 years" + "new to structured lifting") should default
 * conservative rather than blindly trusting the numeric answer.
 */
export function deriveTrainingAge(
  yearsStructuredTraining: number | null | undefined,
  selfDescribe: string | null | undefined
): "novice" | "intermediate" | "advanced" {
  const years = yearsStructuredTraining ?? 0;

  let byYears: "novice" | "intermediate" | "advanced";
  if (years < 1) byYears = "novice";
  else if (years < 3) byYears = "intermediate";
  else byYears = "advanced";

  // Mismatch check: a lot of years but self-described as new to structured
  // lifting -> default conservative (one bucket down from the years-based read).
  if (selfDescribe === "new" && byYears !== "novice") {
    return byYears === "advanced" ? "intermediate" : "novice";
  }

  return byYears;
}
