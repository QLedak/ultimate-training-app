/**
 * prescribed_target is intentionally free text (e.g. "4x8 @ 70%", "3x5-8",
 * "5x3-5, add light weight") per workout-logging-schema-spec.md — there's no
 * structured sets/reps field to compare against directly. This is a
 * best-effort parse of the common "SxR" / "SxR1-R2" shape good enough to
 * classify a logged set as hit/exceeded/missed; anything it can't parse
 * comes back "unknown" rather than guessing.
 */
export type ParsedTarget = { sets: number | null; minReps: number | null; maxReps: number | null };

export function parsePrescribedTarget(target: string): ParsedTarget {
  const match = target.match(/(\d+)\s*x\s*(\d+)(?:-(\d+))?/i);
  if (!match) return { sets: null, minReps: null, maxReps: null };
  const sets = parseInt(match[1], 10);
  const minReps = parseInt(match[2], 10);
  const maxReps = match[3] ? parseInt(match[3], 10) : minReps;
  return { sets, minReps, maxReps };
}

/**
 * Best-effort extraction of a numeric weight suggestion from prescribed_target
 * free text (e.g. "5x5 @ 245", "4x8 @ 70%", "3x10, bodyweight"), used only to
 * pre-fill (never lock) the logging screen's weight field — the athlete can
 * always edit it. Prefers a number right after "@" (this coach's programs
 * write the actual target load there, not just a percentage); falls back to
 * any standalone 2-3 digit number elsewhere in the string once the leading
 * "SxR" sets/reps notation is stripped out, so "5x5" alone isn't misread as
 * a weight of 5. Returns null (no suggestion, field stays blank) for
 * percentage-only or bodyweight-only prescriptions.
 */
export function parsePrescribedWeightHint(target: string): number | null {
  const atMatch = target.match(/@\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs)?(?!\s*%)/i);
  if (atMatch) return parseFloat(atMatch[1]);
  const withoutSetsReps = target.replace(/\d+\s*x\s*\d+(?:-\d+)?/gi, "");
  const numMatch = withoutSetsReps.match(/\b(\d{2,3}(?:\.\d+)?)\b(?!\s*%)/);
  return numMatch ? parseFloat(numMatch[1]) : null;
}

/**
 * Best-effort extraction of a rest duration (in seconds) from the free-text
 * `rest` field (e.g. "90s", "2 min", "60-90 sec", "2-3 min between sets"),
 * used to seed the guided workout's rest timer with a sensible default. On a
 * range ("60-90 sec"), takes the upper end (erring toward more rest, not
 * less). Returns null when nothing parses — the timer UI falls back to a
 * manual preset in that case rather than guessing.
 */
export function parseRestSeconds(rest: string | null | undefined): number | null {
  if (!rest) return null;
  const range = rest.match(/(\d+)\s*-\s*(\d+)\s*(sec|second|s\b|min|minute|m\b)/i);
  if (range) {
    const value = parseInt(range[2], 10);
    const unit = range[3].toLowerCase();
    return unit.startsWith("m") ? value * 60 : value;
  }
  const single = rest.match(/(\d+)\s*(sec|second|s\b|min|minute|m\b)/i);
  if (single) {
    const value = parseInt(single[1], 10);
    const unit = single[2].toLowerCase();
    return unit.startsWith("m") ? value * 60 : value;
  }
  return null;
}

export type PerformanceClass = "hit" | "exceeded" | "missed" | "unknown";

export function classifyPerformance(params: {
  prescribedTarget: string;
  repsCompleted: number | null;
  setsCompleted: number | null; // null means "assume full prescribed sets" per the spec
  rir: number | null;
}): PerformanceClass {
  const { repsCompleted, setsCompleted, rir } = params;
  if (repsCompleted == null) return "unknown";

  const { sets, minReps, maxReps } = parsePrescribedTarget(params.prescribedTarget);
  if (minReps == null) return "unknown";

  const setsOk = setsCompleted == null || sets == null || setsCompleted >= sets;
  if (!setsOk || repsCompleted < minReps) return "missed";

  const topOfRange = maxReps ?? minReps;
  if (repsCompleted >= topOfRange && rir != null && rir >= 3) return "exceeded";

  return "hit";
}
