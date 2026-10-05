import type { SupabaseClient } from "@supabase/supabase-js";

type EquipmentRow = {
  equipment_needed?: string[] | null;
  equipment_all?: string[] | null;
};

/**
 * Whether an athlete's equipment covers an exercise.
 *
 * equipment_needed is an ANY-OF list: bodyweight_only in it means the
 * exercise is always doable, otherwise the athlete needs at least one listed
 * tag ("Dumbbell or Kettlebell"). equipment_all is an ALL-OF list the athlete
 * must ALSO have no matter which option they use — e.g. Dumbbell Bench Press
 * is any-of [dumbbells] AND all-of [bench]. Previously both ideas were
 * flattened into one any-of list, so a box-only athlete was offered Power
 * Clean and a barbell-only athlete was offered every dumbbell-and-bench lift.
 */
export function isEquipmentAvailable(row: EquipmentRow, athleteEquipment: string[]): boolean {
  const have = new Set(athleteEquipment);
  const allOf = row.equipment_all ?? [];
  if (!allOf.every((tag) => have.has(tag))) return false;

  const anyOf = row.equipment_needed ?? [];
  if (anyOf.length === 0) return true;
  return anyOf.includes("bodyweight_only") || anyOf.some((tag) => have.has(tag));
}

/**
 * Server-side equipment pre-filter (Coaching Philosophy §5, "Equipment-driven
 * exercise selection"): never hand the model the full library and trust it
 * to filter — filter it here and pass only what's usable. Retired exercises
 * (is_active = false) are never included.
 *
 * The library is a few hundred small rows, so it's fetched whole and
 * filtered in code: the any-of + all-of rule isn't expressible as a single
 * PostgREST filter, and doing it here keeps one definition (above) that can
 * be unit-tested.
 */
export async function getFilteredExerciseLibrary(
  supabase: SupabaseClient,
  athleteEquipment: string[]
) {
  const { data, error } = await supabase.from("exercise_library").select("*").eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load filtered exercise library: ${error.message}`);
  }

  return (data ?? []).filter((row) => isEquipmentAvailable(row, athleteEquipment));
}
