import { SupabaseClient } from "@supabase/supabase-js";

type ActiveInjury = {
  location: string;
  character?: string;
  since?: string;
  note?: string;
  // Set when the athlete reports the area is no longer bothering them while a
  // phase is active: the area stays on the isometric stage until that phase
  // finishes, then moves to heavy slow resistance in the NEXT phase.
  pending_resolution?: { resolved_at: string; after_phase_id: string };
  // Last time the athlete answered "is this still bothering you?" (drives the Home check-in prompt).
  last_check_in?: string;
};
type ResilienceRegion = { location: string; current_stage: string };

// A cleared injury always restarts at the FIRST step of its region's heavy slow
// resistance (HSR) chain — the same stage vocabulary the Phase Builder reads the
// Coaching Philosophy's phase-by-phase resilience table with, where the first
// ("gpp_reacclimation") column is the start of the chain — regardless of which
// phase the athlete happens to be in when they move over (coach decision,
// 2026-10-06). From there the standing progression advances it phase to phase.
export const FIRST_HSR_STAGE = "gpp_reacclimation";

type InjuryState = {
  current_active_injuries: ActiveInjury[];
  standing_resilience_regions: ResilienceRegion[];
};

/**
 * Pure function: applies every pending (deferred) injury resolution that is due
 * for the phase being built. An injury marked resolved during phase P stays
 * active (isometric stage) for the rest of P; any phase other than P — i.e. the
 * next one — sees it as moved into standing resilience work at the first HSR
 * step. Used both when building a phase context in memory and when persisting at
 * the phase boundary.
 */
export function applyPendingResolutionsForPhase(state: InjuryState, targetPhaseId: string): InjuryState {
  let active = state.current_active_injuries ?? [];
  let regions = state.standing_resilience_regions ?? [];
  for (const inj of active) {
    if (!inj.pending_resolution || inj.pending_resolution.after_phase_id === targetPhaseId) continue;
    regions = regions.some((r) => r.location === inj.location)
      ? regions.map((r) => (r.location === inj.location ? { ...r, current_stage: FIRST_HSR_STAGE } : r))
      : [...regions, { location: inj.location, current_stage: FIRST_HSR_STAGE }];
    active = active.filter((i) => i.location !== inj.location);
  }
  return { current_active_injuries: active, standing_resilience_regions: regions };
}

/**
 * Persists any deferred resolutions once the phase they were waiting on has
 * finished and `newActivePhaseId` is the athlete's new current phase. Called at
 * the phase transition (lib/pps/compile.ts normal transition).
 */
export async function finalizePendingInjuryResolutions(
  supabase: SupabaseClient,
  params: { athleteId: string; newActivePhaseId: string }
) {
  const { athleteId, newActivePhaseId } = params;
  const { data: state } = await supabase
    .from("current_athlete_state")
    .select("current_active_injuries, standing_resilience_regions")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (!state) return;
  const before = (state.current_active_injuries as ActiveInjury[]) ?? [];
  if (!before.some((i) => i.pending_resolution)) return;
  const next = applyPendingResolutionsForPhase(
    {
      current_active_injuries: before,
      standing_resilience_regions: (state.standing_resilience_regions as ResilienceRegion[]) ?? [],
    },
    newActivePhaseId
  );
  await supabase
    .from("current_athlete_state")
    .update(next)
    .eq("athlete_id", athleteId);
}

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
    /** The athlete's active phase right now, if any (a resolution is deferred until it finishes). */
    currentPhaseId?: string | null;
  }
) {
  const { athleteId, location, status, note, currentPhaseId } = params;

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
    if (currentPhaseId) {
      // Finish out the current phase as planned; the move to heavy slow
      // resistance happens when the next phase is built (see
      // applyPendingResolutionsForPhase). No mid-phase change to approved sessions.
      newActiveInjuries = activeInjuries.map((inj, i) =>
        i === idx
          ? {
              ...inj,
              note: note ?? inj.note,
              last_check_in: new Date().toISOString(),
              pending_resolution: { resolved_at: new Date().toISOString(), after_phase_id: currentPhaseId },
            }
          : inj
      );
    } else {
      // No active phase to finish: nothing to wait for, move over right away.
      newActiveInjuries = activeInjuries.filter((_, i) => i !== idx);
      newResilienceRegions = newResilienceRegions.some((r) => r.location === location)
        ? newResilienceRegions.map((r) => (r.location === location ? { ...r, current_stage: FIRST_HSR_STAGE } : r))
        : [...newResilienceRegions, { location, current_stage: FIRST_HSR_STAGE }];
    }
  } else {
    // Still bothering them: also cancels any earlier "it's better" report that
    // was waiting for the phase to finish.
    newActiveInjuries = activeInjuries.map((inj, i) => {
      if (i !== idx) return inj;
      const { pending_resolution: _cleared, ...rest } = inj;
      void _cleared;
      return { ...rest, note: note ?? inj.note, last_check_in: new Date().toISOString() };
    });
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
