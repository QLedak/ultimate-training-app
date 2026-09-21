/**
 * Epley formula — used consistently everywhere a 1RM needs estimating from a
 * multi-rep set: intake (weight x reps), the Phase Performance Summary
 * compile, and logged_exercises.est_1rm. Never duplicate this formula
 * elsewhere; import it.
 */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}
