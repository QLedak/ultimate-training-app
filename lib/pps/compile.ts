import { SupabaseClient } from "@supabase/supabase-js";
import { epley1RM } from "../training/epley";
import {
  CANONICAL_LIFT_EXERCISE_IDS,
  CANONICAL_LIFT_STATE_COLUMN,
  CanonicalLift,
} from "../training/canonical-lifts";
import { classifyPerformance } from "./parse-prescription";

const PAIN_KEYWORDS = ["pain", "hurt", "sore", "tweak", "injur", "sharp"];

type Reason = "normal_transition" | "rebuild_phase_scoped" | "rebuild_skeleton_scoped";

/**
 * Compiles a Phase Performance Summary for one phase (workout-logging-schema-spec.md
 * "How this feeds the Phase Performance Summary" + system-prompt-v3.md's PPS spec
 * table) and folds the result into current_athlete_state — per
 * data-architecture-spec.md, this is mostly deterministic aggregation, not an
 * AI call.
 *
 * On a normal transition, also flips this phase to "completed" and the next
 * phase in the skeleton to "active" (Step 7a in data-architecture-spec.md).
 * Rebuild-triggered compiles leave phase statuses alone — that's a coach/app
 * decision outside this function's scope.
 */
export async function compilePhasePerformanceSummary(
  supabase: SupabaseClient,
  params: { phaseId: string; reason?: Reason; reasonDetail?: string }
) {
  const { phaseId } = params;
  const reason = params.reason ?? "normal_transition";

  const { data: phase, error: phaseError } = await supabase
    .from("macrocycle_phases")
    .select("*, macrocycle_skeletons(athlete_id)")
    .eq("id", phaseId)
    .single();
  if (phaseError || !phase) throw new Error("Phase not found");

  const athleteId = (phase.macrocycle_skeletons as { athlete_id: string }).athlete_id;

  const { data: sessions, error: sessionsError } = await supabase
    .from("scheduled_sessions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("date", { ascending: true });
  if (sessionsError) throw new Error(sessionsError.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));

  const [{ data: logs, error: logsError }, { data: loggedExercises, error: exercisesError }, { data: testingResults, error: testingError }, { data: currentState, error: stateError }, { data: intake }, { data: exerciseLibrary }, { data: nextPhase }, { data: latestBodyweight }] =
    await Promise.all([
      sessionIds.length
        ? supabase.from("session_logs").select("*").in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      sessionIds.length
        ? supabase.from("logged_exercises").select("*").in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("testing_day_results").select("*").eq("phase_id", phaseId),
      supabase.from("current_athlete_state").select("*").eq("athlete_id", athleteId).single(),
      supabase
        .from("athlete_intake")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("exercise_library").select("exercise_id, injury_considerations"),
      supabase
        .from("macrocycle_phases")
        .select("*")
        .eq("skeleton_id", phase.skeleton_id)
        .eq("phase_number", phase.phase_number + 1)
        .maybeSingle(),
      supabase
        .from("bodyweight_entries")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (logsError) throw new Error(logsError.message);
  if (exercisesError) throw new Error(exercisesError.message);
  if (testingError) throw new Error(testingError.message);
  if (stateError || !currentState) throw new Error("No current_athlete_state row for this athlete");

  // ---- Adherence ----
  const logBySessionId = new Map((logs ?? []).map((l) => [l.session_id, l]));
  let completed = 0;
  let partial = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};
  for (const session of sessions ?? []) {
    const log = logBySessionId.get(session.id);
    if (!log) {
      skipped++;
      skipReasons["not_logged"] = (skipReasons["not_logged"] ?? 0) + 1;
      continue;
    }
    if (log.status === "completed") completed++;
    else if (log.status === "partially_completed") partial++;
    else skipped++;
    if (log.skip_reason) skipReasons[log.skip_reason] = (skipReasons[log.skip_reason] ?? 0) + 1;
  }
  const adherence = { total: (sessions ?? []).length, completed, partial, skipped, skip_reasons: skipReasons };

  // ---- Performance vs. prescription + updated maxes (Tier 1 canonical lifts) ----
  const weekNumbers = Array.from(new Set((sessions ?? []).map((s) => s.week_number))).sort((a, b) => a - b);
  const finalTwoWeeks = new Set(weekNumbers.slice(-2));

  const performanceVsPrescription: Record<string, unknown> = {};
  const updatedMaxes: Record<string, { value: number; source: "testing_day" | "epley_estimate" }> = {};
  let anyFromTestingDay = false;
  let anyFromEstimate = false;

  for (const lift of Object.keys(CANONICAL_LIFT_EXERCISE_IDS) as CanonicalLift[]) {
    const exerciseIds = new Set<string>(CANONICAL_LIFT_EXERCISE_IDS[lift]);
    const entriesForLift = (loggedExercises ?? [])
      .filter((e) => exerciseIds.has(e.exercise_id))
      .map((e) => ({ ...e, session: sessionById.get(e.session_id) }))
      .filter((e) => e.session)
      .sort(
        (a, b) => new Date(a.session!.date).getTime() - new Date(b.session!.date).getTime()
      );

    if (entriesForLift.length === 0) continue;

    const finalWeekEntries = entriesForLift.filter((e) => finalTwoWeeks.has(e.session!.week_number));
    const counts = { hit: 0, exceeded: 0, missed: 0 };
    for (const e of finalWeekEntries) {
      const cls = classifyPerformance({
        prescribedTarget: e.prescribed_target,
        repsCompleted: e.reps_completed,
        setsCompleted: e.sets_completed,
        rir: e.rir,
      });
      if (cls === "hit" || cls === "exceeded" || cls === "missed") counts[cls]++;
    }

    let status: "majority_missed" | "majority_rir_high" | "normal" | "no_signal" = "no_signal";
    const decided = counts.hit + counts.exceeded + counts.missed;
    if (decided > 0) {
      if (counts.missed > decided / 2) status = "majority_missed";
      else {
        const highRirCount = finalWeekEntries.filter(
          (e) => e.rir != null && e.rir >= 3 && classifyPerformance({
            prescribedTarget: e.prescribed_target,
            repsCompleted: e.reps_completed,
            setsCompleted: e.sets_completed,
            rir: e.rir,
          }) !== "missed"
        ).length;
        status = highRirCount > decided / 2 ? "majority_rir_high" : "normal";
      }
    }

    // Last actually-completed clean set (hit or exceeded), most recent first —
    // the anchor point the missed-load reduction rule reads, never a missed target.
    const lastClean = [...entriesForLift]
      .reverse()
      .find(
        (e) =>
          classifyPerformance({
            prescribedTarget: e.prescribed_target,
            repsCompleted: e.reps_completed,
            setsCompleted: e.sets_completed,
            rir: e.rir,
          }) !== "missed" && e.weight_used != null
      );

    performanceVsPrescription[lift] = {
      status,
      counts,
      last_clean_set: lastClean
        ? {
            exercise_id: lastClean.exercise_id,
            weight_used: lastClean.weight_used,
            reps_completed: lastClean.reps_completed,
            date: lastClean.session!.date,
          }
        : null,
    };

    // Updated max: testing day (true max preferred) beats a high-confidence
    // (RIR 0-2) Epley estimate from this phase's logged sets.
    const testResult = (testingResults ?? [])
      .filter((t) => exerciseIds.has(t.exercise_id))
      .sort((a, b) => (b.is_true_max ? 1 : 0) - (a.is_true_max ? 1 : 0))[0];

    if (lift === "pullup") {
      const testedReps = testResult?.result_reps ?? null;
      const bestLoggedReps = entriesForLift
        .filter((e) => e.rir != null && e.rir <= 2 && e.reps_completed != null)
        .reduce((max, e) => Math.max(max, e.reps_completed as number), 0);
      if (testedReps != null) {
        updatedMaxes[lift] = { value: testedReps, source: "testing_day" };
        anyFromTestingDay = true;
      } else if (bestLoggedReps > 0) {
        updatedMaxes[lift] = { value: bestLoggedReps, source: "epley_estimate" };
        anyFromEstimate = true;
      }
    } else {
      if (testResult?.result_weight != null) {
        updatedMaxes[lift] = { value: testResult.result_weight, source: "testing_day" };
        anyFromTestingDay = true;
      } else {
        const highConfidenceEstimates = entriesForLift
          .filter((e) => e.rir != null && e.rir <= 2 && e.weight_used != null && e.reps_completed != null)
          .map((e) => epley1RM(e.weight_used as number, e.reps_completed as number));
        if (highConfidenceEstimates.length > 0) {
          updatedMaxes[lift] = { value: Math.max(...highConfidenceEstimates), source: "epley_estimate" };
          anyFromEstimate = true;
        }
      }
    }
  }

  // ---- Flags ----
  const flags: string[] = [];
  for (const log of logs ?? []) {
    if (log.skip_reason === "pain_injury") {
      const session = sessionById.get(log.session_id);
      flags.push(
        `Session on ${session?.date ?? "unknown date"} (${session?.day_label ?? "?"}) was skipped/modified for pain or injury.` +
          (log.skip_reason_other_text ? ` Detail: ${log.skip_reason_other_text}` : "")
      );
    }
    if (log.overall_notes && PAIN_KEYWORDS.some((kw) => log.overall_notes.toLowerCase().includes(kw))) {
      flags.push(`Session note flagged for possible pain/injury language: "${log.overall_notes}"`);
    }
  }
  for (const e of loggedExercises ?? []) {
    if (e.substituted_exercise_id) {
      flags.push(
        `Substituted ${e.exercise_id} -> ${e.substituted_exercise_id}` +
          (e.substitution_reason ? `: ${e.substitution_reason}` : "")
      );
    }
    if (e.notes && PAIN_KEYWORDS.some((kw) => e.notes.toLowerCase().includes(kw))) {
      flags.push(`Exercise note on ${e.exercise_id} flagged for possible pain/injury language: "${e.notes}"`);
    }
  }

  // ---- Resilience-work progression state ----
  const injuryConsiderationsByExercise = new Map<string, string[]>(
    (exerciseLibrary ?? []).map((row) => [row.exercise_id, (row.injury_considerations as string[]) ?? []])
  );
  const standingRegions = (currentState.standing_resilience_regions as { location: string; current_stage: string }[]) ?? [];
  const resilienceProgressionState: Record<string, unknown> = {};
  for (const region of standingRegions) {
    const entries = (loggedExercises ?? []).filter((e) =>
      (injuryConsiderationsByExercise.get(e.exercise_id) ?? []).includes(region.location)
    );
    if (entries.length === 0) {
      resilienceProgressionState[region.location] = {
        current_stage: region.current_stage,
        sessions_logged: 0,
        recommended_action: "hold",
        note: "No standing resilience work for this region was logged this phase — flag for coach review.",
      };
      continue;
    }
    const failedCount = entries.filter((e) => e.rir === 0).length;
    const rirValues = entries.filter((e) => e.rir != null).map((e) => e.rir as number);
    const avgRir = rirValues.length ? rirValues.reduce((a, b) => a + b, 0) / rirValues.length : null;
    const recommendedAction = failedCount === 0 && (avgRir == null || avgRir >= 2) ? "advance" : "hold";
    resilienceProgressionState[region.location] = {
      current_stage: region.current_stage,
      sessions_logged: entries.length,
      avg_rir: avgRir,
      failed_count: failedCount,
      recommended_action: recommendedAction,
    };
  }

  // ---- Upcoming schedule (for the NEXT phase's window, if one exists) ----
  let upcomingSchedule: unknown[] = [];
  if (nextPhase && intake) {
    const inWindow = (start: string, end: string) => start <= nextPhase.end_date && end >= nextPhase.start_date;
    const tournaments = ((intake.tournament_weekends as { start_date: string; end_date: string; label?: string }[]) ?? []).filter(
      (t) => inWindow(t.start_date, t.end_date)
    );
    upcomingSchedule = tournaments;
  }

  // ---- Write the summary ----
  const { data: summary, error: summaryError } = await supabase
    .from("phase_performance_summaries")
    .insert({
      athlete_id: athleteId,
      phase_id: phaseId,
      adherence,
      updated_maxes: updatedMaxes,
      performance_vs_prescription: performanceVsPrescription,
      flags,
      resilience_progression_state: resilienceProgressionState,
      reason,
      reason_detail: params.reasonDetail ?? null,
      upcoming_schedule: upcomingSchedule,
    })
    .select()
    .single();
  if (summaryError) throw new Error(summaryError.message);

  // ---- Fold updated maxes + bodyweight into current_athlete_state ----
  // Standing resilience regions and current_active_injuries are NOT auto-mutated
  // here: whether to advance a region's stage is the Phase Builder's judgment
  // call (it reads resilience_progression_state above to decide), and we don't
  // have location-tagged data on generic session skips to safely infer new
  // active-injury flags — that stays a coach-reviewed, manual update for now.
  const stateUpdate: Record<string, unknown> = {};
  for (const [lift, result] of Object.entries(updatedMaxes)) {
    stateUpdate[CANONICAL_LIFT_STATE_COLUMN[lift as CanonicalLift]] = result.value;
  }
  if (Object.keys(stateUpdate).length > 0) {
    stateUpdate.maxes_source = anyFromTestingDay ? "testing_day" : anyFromEstimate ? "epley_estimate" : currentState.maxes_source;
  }
  if (latestBodyweight?.bodyweight_lb != null) {
    stateUpdate.bodyweight_lb = latestBodyweight.bodyweight_lb;
  }
  if (Object.keys(stateUpdate).length > 0) {
    const { error: updateStateError } = await supabase
      .from("current_athlete_state")
      .update(stateUpdate)
      .eq("athlete_id", athleteId);
    if (updateStateError) throw new Error(updateStateError.message);
  }

  // ---- Advance phase status (normal transition only) ----
  // A rebuild (phase- or skeleton-scoped) compiles a PhasePerformanceSummary
  // for a phase that was INTERRUPTED, not finished — data-architecture-spec.md
  // step 7(b)/(c) has Phase Builder re-fire "for the same, interrupted phase."
  // Marking it completed here would be wrong: it's still the athlete's
  // active phase, just about to get a new draft version.
  if (reason === "normal_transition") {
    const { error: completeError } = await supabase
      .from("macrocycle_phases")
      .update({ status: "completed" })
      .eq("id", phaseId);
    if (completeError) throw new Error(completeError.message);

    if (nextPhase) {
      const { error: activateError } = await supabase
        .from("macrocycle_phases")
        .update({ status: "active" })
        .eq("id", nextPhase.id);
      if (activateError) throw new Error(activateError.message);
    }
  }

  return { summary, nextPhase: nextPhase ?? null };
}
