import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side equipment pre-filter (Coaching Philosophy §5, "Equipment-driven
 * exercise selection"): never hand the model the full library and trust it
 * to filter — filter it here and pass only what's usable.
 *
 * An exercise is included if:
 *   - its equipment_needed includes "bodyweight_only" (always available), OR
 *   - it shares at least one equipment tag with what the athlete has.
 */
export async function getFilteredExerciseLibrary(
  supabase: SupabaseClient,
  athleteEquipment: string[]
) {
  // equipment_needed is jsonb (a JSON array), not a native Postgres array —
  // the "cs" (contains) filter needs a JSON-encoded value here, e.g.
  // ["bodyweight_only"], not the Postgres array literal {bodyweight_only}.
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*")
    .or(
      [
        `equipment_needed.cs.["bodyweight_only"]`,
        ...athleteEquipment.map((tag) => `equipment_needed.cs.["${tag}"]`),
      ].join(",")
    );

  if (error) {
    throw new Error(`Failed to load filtered exercise library: ${error.message}`);
  }

  return data ?? [];
}
