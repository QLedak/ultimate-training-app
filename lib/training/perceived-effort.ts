/**
 * The guided workout flow's set-difficulty input: a sliding scale from "very
 * easy" to "did not complete," replacing a raw numeric RIR (reps in reserve)
 * entry. The idea (and the six-step shape below) is modeled on the athlete
 * asking "how did that set feel?" rather than doing reps-left-in-the-tank
 * arithmetic mid-set — the same felt-effort question, asked in the format
 * athletes actually answer accurately.
 *
 * Every downstream consumer (autoregulation, est_1rm, phase-progression
 * rules in system-prompt-v3.md, performance classification) still runs on
 * the numeric `rir` field the schema already has, so each step just carries
 * an RIR-equivalent value — nothing else in the app needs to know the input
 * changed from a dropdown to a slider.
 */

export type EffortLevel = "very_easy" | "easy" | "moderate" | "hard" | "very_hard" | "did_not_complete";

export const EFFORT_SCALE: { value: EffortLevel; label: string; shortLabel: string; rir: number }[] = [
  { value: "very_easy", label: "Very easy — a lot left in the tank", shortLabel: "Very easy", rir: 5 },
  { value: "easy", label: "Easy — could've done several more", shortLabel: "Easy", rir: 4 },
  { value: "moderate", label: "Moderate — a couple more possible", shortLabel: "Moderate", rir: 3 },
  { value: "hard", label: "Hard — maybe one more", shortLabel: "Hard", rir: 2 },
  { value: "very_hard", label: "Very hard — that was my max", shortLabel: "Very hard", rir: 1 },
  { value: "did_not_complete", label: "Did not complete the set", shortLabel: "Did not complete", rir: 0 },
];

/** Effort-scale value -> the RIR-equivalent stored in `rir` everywhere else. */
export function effortToRir(effort: EffortLevel | "" | null | undefined): number | null {
  if (!effort) return null;
  const found = EFFORT_SCALE.find((e) => e.value === effort);
  return found ? found.rir : null;
}

/**
 * A stored/prior numeric RIR -> the nearest effort-scale step, for
 * re-hydrating the slider (resuming a session, or showing a prior guided
 * result). Snaps to the closest step rather than requiring an exact match,
 * since older rows may carry an RIR that doesn't land exactly on 0-5.
 */
export function rirToEffort(rir: number | null | undefined): EffortLevel | "" {
  if (rir == null) return "";
  let closest = EFFORT_SCALE[0];
  let bestDiff = Infinity;
  for (const e of EFFORT_SCALE) {
    const diff = Math.abs(e.rir - rir);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = e;
    }
  }
  return closest.value;
}
