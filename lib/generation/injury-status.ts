import { SupabaseClient } from "@supabase/supabase-js";

type ActiveInjury = { location: string; character?: string; since?: string; note?: string };
type ResilienceRegion = { location: string; current_stage: string };

// Maps the phase the athlete is in right now onto the matching column of the
// coaching-philosophy phase-by-phase resilience progression table (Section 5)
// — the same vocabulary the Phase Builder prompt already reads that table
// with, so "current_stage: hypertrophy" means exactly what it means for every
// other standing resilience region, no separate stage-name table needed here.
// injury_return and testing_block aren't columns in that table — both start
// an injury conservatively/hold rather than guessing a stage.
const PHASE_GOAL_TO_STAGE: Record<string, string> = {
  gpp_reacclimation: "gpp_reacclimation",
  hypertrophy: "hypertrophy",
  max_strength: "max_strength",
  power_conversion: "power_conversion",
  peak_taper: "peak_taper",
  injury_return: "gpp_reacclimation",
  testing_block: "gpp_reacclimation",
};

/**
 * Applies an athlete's own injury check-in (POST /api/athletes/[id]/injury-status)
 * to current_athlete_state — the piece that was entirely missing before: per
 * lib/pps/compile.ts's own comment, current_active_injuries was seeded once at
 * intake and never touched again, so an athlete with active tendonitis could
 * get stuck on the isometric-first progression indefinitely even once it
 * actually resolved.
 *
 * - "resolved": moves the location OUT of current_active_injuries (which
 *   drives the isometric-first progression — Coaching Philosophy's reactive-
 *   pain rule) and INTO standing_resilience_regions (which drives the
 *   phase-by-phase resilience progression for a HISTORICAL area). The new
 *   region starts at the stage matching the athlete's current phase, so it
 *   picks up the standing progression's normal per-phase advance/hold logic
 *   from here rather than resetting all the way to intake's "not_yet_started".
 * - "still_active": leaves current_active_injuries alone (the isometric-first
 *   progression keeps running for that pattern), just records the athlete's
 *   own note for the coach/next generation to see.
 *
 * This never touches macrocycle_phases, program_drafts, or anything else —
 * it's purely the current_athlete_state mutation. The caller (the API route)
 * is responsible for deciding whether an active phase needs a rebuild to
 * reflect the change, same separation used by every other generation
 * orchestration in this app.
 */
export async function applyInjuryStatusUpdate(
  supabase: SupabaseClient,
  params: {
    athleteId: string;
    location: string;
    status: "resolved" | "still_active";
    note?: string;
    currentPhaseGoal?: string | null;
  }
) {
  const { athleteId, location, status, note, currentPhaseGoal } = params;

  const { data: state, error: stateError } = await supabase
    .from("current_athlete_state")
    .select("current_active_injuries, standing_resilience_regions")
    .eq("athlete_id", athleteId)
    .single();
  if (stateError || !state) {
    throw new Error(`No current_athlete_state row for this athlete${stateError ? `: ${stateError.message}` : ""}`);
  }

  const activeInjuries = (state.current_active_injuries as ActiveInjury[]) ?? [];
  const idx = activeInjuries.findIndex((i) => i.location === location);
  if (idx === -1) {
    throw new Error(`No active injury reported for "${location}" — nothing to update.`);
  }

  let newActiveInjuries = activeInjuries;
  let newResilienceRegions = (state.standing_resilience_regions as ResilienceRegion[]) ?? [];

  if (status === "resolved") {
    newActiveInjuries = activeInjuries.filter((_, i) => i !== idx);

    const stage = PHASE_GOAL_TO_STAGE[currentPhaseGoal ?? ""] ?? "gpp_reacclimation";
    const existingRegionIdx = newResilienceRegions.findIndex((r) => r.location === location);
    if (existingRegionIdx === -1) {
      newResilienceRegions = [...newResilienceRegions, { location, current_stage: stage }];
    } else {
      newResilienceRegions = newResilienceRegions.map((r, i) =>
        i === existingRegionIdx ? { ...r, current_stage: stage } : r
      );
    }
  } else {
    newActiveInjuries = activeInjuries.map((inj, i) => (i === idx ? { ...inj, note: note ?? inj.note } : inj));
  }

  const { error: updateError } = await supabase
    .from("current_athlete_state")
    .update({
      current_active_injuries: newActiveInjuries,
      standing_resilience_regions: newResilienceRegions,
    })
    .eq("athlete_id", athleteId);
  if (updateError) throw new Error(`Failed to update current_athlete_state: ${updateError.message}`);

  return {
    current_active_injuries: newActiveInjuries,
    standing_resilience_regions: newResilienceRegions,
  };
}

/**
 * The other half of "an injury's status can change mid-phase" — an athlete
 * picking up a NEW injury (one that wasn't part of intake at all, or a past
 * injury flaring back up) mid-season, with no way to tell the app about it
 * until now. Adds the location to current_active_injuries (triggering the
 * isometric-first progression on it starting next generation, same as if it
 * had been reported at intake), and — per the Coaching Philosophy's own rule
 * that a reactivated historical area supersedes standing dosing — removes it
 * from standing_resilience_regions if it was there, so the two lists never
 * both claim the same location at once with conflicting instructions.
 */
export async function reportNewInjury(
  supabase: SupabaseClient,
  params: { athleteId: string; location: string; character?: string; note?: string }
) {
  const { athleteId, location, character, note } = params;

  const { data: state, error: stateError } = await supabase
    .from("current_athlete_state")
    .select("current_active_injuries, standing_resilience_regions")
    .eq("athlete_id", athleteId)
    .single();
  if (stateError || !state) {
    throw new Error(`No current_athlete_state row for this athlete${stateError ? `: ${stateError.message}` : ""}`);
  }

  const activeInjuries = (state.current_active_injuries as ActiveInjury[]) ?? [];
  if (activeInjuries.some((i) => i.location === location)) {
    throw new Error(`"${location}" is already reported as an active injury — use the check-in instead.`);
  }

  const newActiveInjuries: ActiveInjury[] = [
    ...activeInjuries,
    { location, character, since: new Date().toISOString(), note },
  ];

  const resilienceRegions = (state.standing_resilience_regions as ResilienceRegion[]) ?? [];
  const newResilienceRegions = resilienceRegions.filter((r) => r.location !== location);

  const { error: updateError } = await supabase
    .from("current_athlete_state")
    .update({
      current_active_injuries: newActiveInjuries,
      standing_resilience_regions: newResilienceRegions,
    })
    .eq("athlete_id", athleteId);
  if (updateError) throw new Error(`Failed to update current_athlete_state: ${updateError.message}`);

  return {
    current_active_injuries: newActiveInjuries,
    standing_resilience_regions: newResilienceRegions,
  };
}
