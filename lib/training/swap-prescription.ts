/**
 * When an athlete swaps an exercise for an alternative, the prescribed sets/reps
 * should fit the NEW exercise. A 3x20s/side plank swapped for a Copenhagen dip
 * needs reps, not seconds; a squat swapped for a split squat needs "/side".
 *
 * Sets are always kept. What changes is the work per set, and only when the
 * alternative is measured differently (reps vs seconds vs distance) or is
 * single-sided when the original wasn't (or the reverse). Pure and unit tested.
 */

export type Measure = "reps" | "seconds" | "distance";

/** Equipment tags that mean the athlete adds load (so a weight can be entered). */
const LOAD_EQUIPMENT = new Set([
  "dumbbells", "barbell_rack", "kettlebell", "cable_machine", "weight_plates", "trap_bar", "landmine", "sled",
]);

export function usesWeight(row: { equipment_needed?: unknown; equipment_all?: unknown; exercise_name?: string | null; logging_tier?: number | null }): boolean {
  if (row.logging_tier === 1) return true;
  const tags = [row.equipment_needed, row.equipment_all].flatMap((v) => (Array.isArray(v) ? (v as string[]) : []));
  if (tags.some((t) => LOAD_EQUIPMENT.has(t))) return true;
  return /\b(weighted|vest|loaded)\b/i.test(row.exercise_name ?? "");
}

/** How a library exercise is measured, from its name and category. */
export function exerciseMeasure(row: { exercise_name?: string | null; category?: string | null }): Measure {
  const name = row.exercise_name ?? "";
  // Isometrics and holds are timed. "Hang" alone is not (hang cleans are rep-based).
  if (/\b(hold|plank|wall sit|isometric|squeeze|dead hang)\b/i.test(name)) return "seconds";
  if (/\b\d+(?:-\d+)?\s*(?:yd|yds|yard|yards|m)\b/i.test(name)) return "distance";
  if (/\b(sprint|carry|bound|skip|shuttle)\b/i.test(name) && row.category !== "Plyometrics") return "distance";
  return "reps";
}

export function isUnilateral(row: { exercise_name?: string | null; laterality?: string | null }): boolean {
  if (row.laterality === "unilateral") return true;
  return /\b(single[- ](leg|arm)|one[- ](leg|arm)|split squat|lunge|step[- ]up|kickstand|rear-foot|alternating|suitcase)\b/i.test(row.exercise_name ?? "");
}

/** Measure of an existing prescription string such as "3x20s/side" or "4x10 yd". */
export function targetMeasure(target: string | null | undefined): Measure {
  const t = target ?? "";
  if (/\d+\s*[x×]\s*\d+(?:\s*-\s*\d+)?\s*(?:sec|second|s\b|min|minute)/i.test(t)) return "seconds";
  if (/\d+\s*(?:yd|yds|yard|yards|m|meters?)\b/i.test(t)) return "distance";
  return "reps";
}

const DEFAULT_REPS: Record<string, number> = {
  "Absolute strength": 5,
  "Hypertrophy": 10,
  "Injury resilience": 8,
  "Core": 10,
  "Plyometrics": 4,
  "Technical coordination": 3,
  "Reflexive strength": 6,
};

function setsOf(target: string): number | null {
  const m = target.match(/(\d+)\s*[x×]/i);
  return m ? parseInt(m[1], 10) : null;
}

export type AltInfo = { exercise_name: string; category?: string | null; laterality?: string | null };

/**
 * The prescription for the alternative. Returns the original text untouched when
 * nothing about the work changes, so a like-for-like swap keeps its coach notes.
 */
export function adaptPrescription(
  originalTarget: string | null | undefined,
  originalRow: { exercise_name?: string | null; laterality?: string | null },
  alt: AltInfo
): string | null {
  if (!originalTarget) return originalTarget ?? null;
  const sets = setsOf(originalTarget);
  if (sets == null) return originalTarget;

  const fromMeasure = targetMeasure(originalTarget);
  const toMeasure = exerciseMeasure(alt);
  const fromSide = isUnilateral(originalRow);
  const toSide = isUnilateral(alt);

  if (fromMeasure === toMeasure && fromSide === toSide) return originalTarget;

  const side = toSide ? "/side" : "";
  if (fromMeasure === toMeasure) {
    // Same kind of work; only the one-sided-ness differs. Keep the numbers, fix the suffix.
    const stripped = originalTarget.replace(/\s*\/\s*side\b/i, "");
    return toSide ? `${stripped.trimEnd()}/side` : stripped;
  }

  if (toMeasure === "seconds") return `${sets}x20s${side}`;
  if (toMeasure === "distance") {
    const fromName = alt.exercise_name.match(/(\d+)(?:-(\d+))?\s*(yd|yds|yard|yards|m)\b/i);
    const unit = fromName ? (fromName[3].toLowerCase().startsWith("y") ? "yd" : "m") : "yd";
    const dist = fromMeasure === "distance" ? originalTarget.match(/(\d+)\s*(?:yd|yds|yard|yards|m)\b/i)?.[1] : fromName?.[1];
    return `${sets}x${dist ?? "10"} ${unit}`;
  }
  // reps
  const reps = DEFAULT_REPS[alt.category ?? ""] ?? 8;
  return `${sets}x${reps}${side}`;
}
