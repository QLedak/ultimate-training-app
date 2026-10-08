import type { SupabaseClient } from "@supabase/supabase-js";
import { isEquipmentAvailable, type LibraryRow } from "../library/exercise-row";

export { isEquipmentAvailable };

/**
 * Plain equipment pre-filter over the active v2 library (retired rows and
 * legacy v1 rows are never included). The Phase Builder itself no longer sends
 * the whole library to the model — it uses the app-built slot plan
 * (lib/generation/slots) — but this stays as the shared helper for any other
 * caller that wants "everything this athlete can do".
 *
 * Equipment rule (lib/library/exercise-row.ts): each row carries
 * `equipment_groups`, a list of ANY-OF groups; the athlete needs at least one
 * tag from EVERY group. No groups = nothing to declare.
 */
export async function getFilteredExerciseLibrary(supabase: SupabaseClient, athleteEquipment: string[]) {
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("is_active", true)
    .eq("library_version", 2);

  if (error) {
    throw new Error(`Failed to load filtered exercise library: ${error.message}`);
  }
  return ((data ?? []) as LibraryRow[]).filter((row) => isEquipmentAvailable(row, athleteEquipment));
}
