export type TrainingAge = "novice" | "intermediate" | "advanced";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function bucketFor(years: number): TrainingAge {
  if (years < 1) return "novice";
  if (years < 3) return "intermediate";
  return "advanced";
}

/**
 * Coaching Philosophy §5 / intake-funnel-spec.md Screen 2:
 *   0-1 yr structured training -> Novice
 *   1-3 yrs -> Intermediate (blend, lean Novice unless other signals say otherwise)
 *   3+ yrs -> Advanced
 * Cross-checked against the athlete's self-described lifting experience —
 * a mismatch (e.g., "10 years" + "new to structured lifting") should default
 * conservative rather than blindly trusting the numeric answer.
 *
 * ELAPSED TIME: the intake answer is a snapshot from `intakeSubmittedAt`. Time
 * spent training in the app counts as structured training, so the effective
 * years are (years at intake + years since intake) and the bucket moves up on
 * its own as the athlete keeps training (a novice crosses into intermediate a
 * year after intake, and so on). The conservative "self-described new" cap only
 * holds for the first year — after that the athlete has a year of real training
 * and the stale self-description stops holding them back.
 */
export function deriveTrainingAge(
  yearsStructuredTraining: number | null | undefined,
  selfDescribe: string | null | undefined,
  intakeSubmittedAt?: string | Date | null,
  now: Date = new Date()
): TrainingAge {
  const yearsAtIntake = yearsStructuredTraining ?? 0;

  let elapsedYears = 0;
  if (intakeSubmittedAt) {
    const submitted = new Date(intakeSubmittedAt).getTime();
    if (!Number.isNaN(submitted)) elapsedYears = Math.max(0, (now.getTime() - submitted) / YEAR_MS);
  }

  const byYears = bucketFor(yearsAtIntake + elapsedYears);

  // Mismatch check: a lot of years but self-described as new to structured
  // lifting -> default conservative (one bucket down from the years-based read).
  if (selfDescribe === "new" && elapsedYears < 1 && byYears !== "novice") {
    return byYears === "advanced" ? "intermediate" : "novice";
  }

  return byYears;
}
