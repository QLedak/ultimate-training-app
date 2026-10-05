/**
 * current_athlete_state tracks 5 loadable canonical maxes (back_squat,
 * bench_press, deadlift, power_clean, pullup — plus vertical_jump, which is
 * test-only) but the Exercise Library has many exercise_ids that count
 * toward each. Neither spec doc enumerates this mapping explicitly, so this
 * is a v1 best-effort mapping from library exercise_id -> canonical lift,
 * covering the barbell/trap-bar variants a Phase Builder call is most
 * likely to prescribe as the actual %-based main lift. Extend this list if
 * you add other exercise_ids you want treated as counting toward a max.
 *
 * Deadlift and power clean were originally one combined "deadlift_or_clean"
 * canonical lift/intake field — split into two per coach feedback, since
 * they're different lifts with different loading and shouldn't share a max.
 */
export const CANONICAL_LIFT_EXERCISE_IDS = {
  back_squat: ["SQ-001"],
  // Barbell only. Dumbbell Bench Press (UP-003) used to be mapped here too,
  // but its logged weight is PER HAND, so an athlete who only logged dumbbell
  // bench would get a barbell bench max a fraction of the real number (and
  // every barbell percentage after that would be far too light). DB bench
  // still gets its own rep-scheme-normalized history via tier1_exercise_history.
  bench_press: ["UP-002"],
  deadlift: ["HG-001", "HG-003"], // Trap Bar Deadlift, Conventional Barbell Deadlift
  power_clean: ["OL-001", "OL-002"], // Power Clean, Hang Power Clean
  pullup: ["UL-003"],
} as const;

export type CanonicalLift = keyof typeof CANONICAL_LIFT_EXERCISE_IDS;

const EXERCISE_TO_LIFT = new Map<string, CanonicalLift>();
for (const [lift, ids] of Object.entries(CANONICAL_LIFT_EXERCISE_IDS)) {
  for (const id of ids) EXERCISE_TO_LIFT.set(id, lift as CanonicalLift);
}

export function canonicalLiftForExercise(exerciseId: string): CanonicalLift | null {
  return EXERCISE_TO_LIFT.get(exerciseId) ?? null;
}

// current_athlete_state column each canonical lift's updated max is written to.
export const CANONICAL_LIFT_STATE_COLUMN: Record<CanonicalLift, string> = {
  back_squat: "back_squat_1rm",
  bench_press: "bench_press_1rm",
  deadlift: "deadlift_1rm",
  power_clean: "power_clean_1rm",
  pullup: "pullup_max_reps",
};
