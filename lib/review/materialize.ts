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

  // A rebuild/new chunk that re-publishes overlapping future days should
  // replace them, not conflict — already-logged past days are untouched by
  // this call in practice since Phase Builder only regens forward from
  // "today" (see the (b)/(c) rebuild branches in data-architecture-spec.md).
  //
  // This used to be a single `.upsert(rows, { onConflict: "athlete_id,date" })`,
  // relying on the original `unique(athlete_id, date)` constraint from
  // 0001_init.sql. Migration 0011_allow_multiple_sessions_per_day.sql
  // dropped that constraint (so athletes can manually double-book a day),
  // which left that onConflict target pointing at a constraint that no
  // longer exists — Postgres/PostgREST errors on every call with "no unique
  // or exclusion constraint matching the ON CONFLICT specification." This
  // replaces the single upsert with an explicit, phase-aware
  // update-or-insert so republishing still works now that (athlete_id,
  // date) alone can no longer be trusted to identify "the one row here":
  //
  //   - Same date, DIFFERENT phase_id (a coincidental date reuse, or a
  //     phase transition where a test date landed in the new phase's
  //     window): clear that row's session_logs/logged_exercises, then
  //     delete the row — the new row takes the date with a fresh id,
  //     exactly like the old "stale session" handling below.
  //   - Same date, SAME phase_id (the normal republish case — a rebuild or
  //     a later chunk overlapping a day this phase already generated):
  //     UPDATE the existing row's prescription IN PLACE, preserving its id,
  //     so any session_logs already pointing at it over a now-stale
  //     prescription stay attached to a stable id — they weren't destroyed
  //     by migration 0011 and shouldn't be destroyed by this fix either.
  //   - No existing row for a (athlete_id, phase_id, date) combination at
  //     all: plain insert.
  //   - The one case this doesn't fully resolve: an athlete manually
  //     double-booked a SECOND session from the SAME phase onto this exact
  //     date (migration 0011's whole reason for existing). There, more than
  //     one same-phase row matches the date — this updates the earliest
  //     (lowest id) of them and leaves the others alone rather than
  //     guessing which one the athlete meant to replace. Rare in practice;
  //     flag it for review if it comes up rather than silently picking for
  //     the athlete.
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
    const { error: deleteStaleError } = await supabase
      .from("scheduled_sessions")
      .delete()
      .in("id", staleSessionIds);
    if (deleteStaleError) throw new Error(deleteStaleError.message);
  }

  // Same-phase rows on these dates, now that cross-phase stale rows are
  // gone — the ones to UPDATE in place rather than insert fresh.
  const samePhaseByDate = new Map<string, { id: string }[]>();
  for (const s of existingForDates ?? []) {
    if (s.phase_id !== draft.phase_id) continue;
    const list = samePhaseByDate.get(s.date as string) ?? [];
    list.push({ id: s.id as string });
    samePhaseByDate.set(s.date as string, list);
  }

  const rowsToInsert: typeof rows = [];
  const sessions: Record<string, unknown>[] = [];
  for (const row of rows) {
    const existing = samePhaseByDate.get(row.date);
    if (existing && existing.length > 0) {
      const targetId = existing.sort((a, b) => (a.id < b.id ? -1 : 1))[0].id;
      const { data: updated, error: updateError } = await supabase
        .from("scheduled_sessions")
        .update(row)
        .eq("id", targetId)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      sessions.push(updated);
    } else {
      rowsToInsert.push(row);
    }
  }

  if (rowsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("scheduled_sessions")
      .insert(rowsToInsert)
      .select();
    if (insertError) throw new Error(insertError.message);
    sessions.push(...(inserted ?? []));
  }

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
