import { SupabaseClient } from "@supabase/supabase-js";
import { deriveTrainingAge } from "../training/training-age";
import { bucketEquipment } from "../training/equipment";

/**
 * On approval with publish_to_athlete=true for a macrocycle_planner draft:
 * this draft's content BECOMES the athlete's active MacrocycleSkeleton
 * (data-architecture-spec.md — "skeleton and drafts are not two sources of
 * truth"). Any previously active skeleton is deactivated but never deleted.
 */
export async function materializeMacrocycleSkeleton(
  supabase: SupabaseClient,
  draft: Record<string, unknown>
) {
  const athleteId = draft.athlete_id as string;

  const { error: deactivateError } = await supabase
    .from("macrocycle_skeletons")
    .update({ is_active: false })
    .eq("athlete_id", athleteId)
    .eq("is_active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .insert({ athlete_id: athleteId, source_draft_id: draft.id, is_active: true })
    .select()
    .single();
  if (skeletonError) throw new Error(skeletonError.message);

  const output = draft.output as {
    phases: Array<{
      phase_number: number;
      phase_name: string;
      goal: string;
      start_date: string;
      end_date: string;
      week_count: number;
      weekly_template_label: string;
      deload_test_note?: string;
    }>;
  };

  const sortedPhases = [...output.phases].sort((a, b) => a.phase_number - b.phase_number);
  const phaseRows = sortedPhases.map((phase, i) => ({
    skeleton_id: skeleton.id,
    phase_number: phase.phase_number,
    phase_name: phase.phase_name,
    goal: phase.goal,
    start_date: phase.start_date,
    end_date: phase.end_date,
    week_count: phase.week_count,
    weekly_template_label: phase.weekly_template_label,
    deload_test_note: phase.deload_test_note ?? null,
    // First phase in sequence starts active; the rest are upcoming until
    // Phase Builder / phase-transition logic advances them later.
    status: i === 0 ? "active" : "upcoming",
  }));

  const { data: phases, error: phasesError } = await supabase
    .from("macrocycle_phases")
    .insert(phaseRows)
    .select();
  if (phasesError) throw new Error(phasesError.message);

  return { skeleton, phases };
}

/**
 * On approval with publish_to_athlete=true for a phase_builder draft: writes
 * one ScheduledSession per calendar day in the program, with
 * prescribed_exercises copied (snapshotted) from the approved draft — never
 * a live reference back to it, per workout-logging-schema-spec.md.
 */
export async function materializeScheduledSessions(
  supabase: SupabaseClient,
  draft: Record<string, unknown>
) {
  const output = draft.output as {
    weeks: Array<{
      week_number: number;
      week_type: "build" | "deload" | "test";
      days: Array<{
        day_label: string;
        date: string;
        exercises: Array<Record<string, unknown>>;
      }>;
    }>;
  };

  const rows = output.weeks.flatMap((week) =>
    week.days.map((day) => ({
      athlete_id: draft.athlete_id,
      phase_id: draft.phase_id,
      source_draft_id: draft.id,
      date: day.date,
      week_number: week.week_number,
      day_label: day.day_label,
      week_type: week.week_type,
      prescribed_exercises: day.exercises,
    }))
  );

  // upsert on (athlete_id, date): a rebuild that re-publishes overlapping
  // future days should replace them, not conflict — already-logged past days
  // are untouched by this call in practice since Phase Builder only regens
  // forward from "today" (see the (b)/(c) rebuild branches in
  // data-architecture-spec.md).
  //
  // BUT: an upsert-on-date updates the existing scheduled_sessions row IN
  // PLACE (same id), so if that date previously belonged to a DIFFERENT
  // phase (a coincidental date reuse, or a phase transition where a test
  // date happened to land in the new phase's window), any session_logs /
  // logged_exercises still pointing at that row's id would silently survive
  // — the day now shows a brand-new prescription but reads as already
  // logged from the old phase. Clear those out first whenever the phase
  // actually changes for that date.
  const dates = rows.map((r) => r.date);
  const { data: existingForDates, error: existingError } = await supabase
    .from("scheduled_sessions")
    .select("id, date, phase_id")
    .eq("athlete_id", draft.athlete_id)
    .in("date", dates);
  if (existingError) throw new Error(existingError.message);

  const staleSessionIds = (existingForDates ?? [])
    .filter((s) => s.phase_id !== draft.phase_id)
    .map((s) => s.id);
  if (staleSessionIds.length > 0) {
    const { error: deleteLogsError } = await supabase
      .from("session_logs")
      .delete()
      .in("session_id", staleSessionIds);
    if (deleteLogsError) throw new Error(deleteLogsError.message);
    const { error: deleteExercisesError } = await supabase
      .from("logged_exercises")
      .delete()
      .in("session_id", staleSessionIds);
    if (deleteExercisesError) throw new Error(deleteExercisesError.message);
  }

  const { data: sessions, error } = await supabase
    .from("scheduled_sessions")
    .upsert(rows, { onConflict: "athlete_id,date" })
    .select();
  if (error) throw new Error(error.message);

  return { sessions };
}

/**
 * Best-effort situation_tags for a CorpusEntry (review-approval-flow-spec.md
 * + corpus-retrieval-spec.md). phase_builder drafts already computed and
 * stored the exact Situation used at generation time in input_snapshot, so
 * we reuse it verbatim. macrocycle_planner drafts have no single "phase
 * goal", so tags there are necessarily partial — retrieval scoring today
 * only runs against phase_builder entries anyway (lib/corpus/retrieve.ts).
 */
export async function buildCorpusSituationTags(
  supabase: SupabaseClient,
  draft: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (draft.call_type === "phase_builder") {
    const inputSnapshot = draft.input_snapshot as { situation: Record<string, unknown> };
    const situation = inputSnapshot.situation;
    return {
      phase_goal: situation.phaseGoal,
      training_age: situation.trainingAge,
      injury_individualization: situation.injuryLocations ?? [],
      days_per_week: situation.daysPerWeek,
      equipment_context: situation.equipmentContext,
    };
  }

  // macrocycle_planner
  const inputSnapshot = draft.input_snapshot as { intake_id: string };
  const { data: intake } = await supabase
    .from("athlete_intake")
    .select("*")
    .eq("id", inputSnapshot.intake_id)
    .single();

  return {
    phase_goal: null,
    training_age: intake
      ? deriveTrainingAge(intake.years_structured_training, intake.lifting_experience_selfdescribe)
      : null,
    injury_individualization: [],
    days_per_week: intake?.training_days_per_week ?? null,
    equipment_context: intake ? bucketEquipment(intake.equipment ?? []) : null,
  };
}
