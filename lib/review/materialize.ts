import { SupabaseClient } from "@supabase/supabase-js";
import { deriveTrainingAge } from "../training/training-age";
import { bucketEquipment } from "../training/equipment";
import { addDays } from "../generation/phase-sequencing";
import { supersedeUnstartedBridgePhases } from "../generation/season-bridge";

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

  if ((draft.input_snapshot as { next_season_id?: string } | null)?.next_season_id) {
    return materializeNextSeason(supabase, draft);
  }

  const { error: deactivateError } = await supabase
    .from("macrocycle_skeletons")
    .update({ is_active: false, status: "superseded" })
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
 * Next-season plan (year-over-year): the approved phases are APPENDED to the
 * athlete's active skeleton after the last block that already started — the
 * running block (often a bridge block) keeps going untouched, unstarted bridge
 * blocks are superseded. The season itself flips planned -> active when its
 * first phase starts (see activatePlannedSeasonIfStarting).
 */
async function materializeNextSeason(supabase: SupabaseClient, draft: Record<string, unknown>) {
  const athleteId = draft.athlete_id as string;
  const snapshot = draft.input_snapshot as { next_season_id: string; first_phase_number: number };

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) throw new Error(skeletonError.message);
  if (!skeleton) throw new Error("The athlete has no active plan to continue from.");

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

  // Stale-draft guard (checked BEFORE changing anything): a bridge block may have started since
  // this draft was generated, in which case its phase numbers/dates no longer line up.
  const { data: existing } = await supabase
    .from("macrocycle_phases")
    .select("phase_number, end_date, status, is_bridge")
    .eq("skeleton_id", skeleton.id)
    .neq("status", "superseded")
    .order("phase_number", { ascending: true });
  const kept = (existing ?? []).filter((p) => !(p.is_bridge && p.status === "upcoming"));
  const lastKept = kept[kept.length - 1];
  if (
    !lastKept ||
    (lastKept.phase_number as number) + 1 !== sortedPhases[0].phase_number ||
    addDays(lastKept.end_date as string, 1) > sortedPhases[0].start_date
  ) {
    throw new Error(
      "This next-season draft is out of date — the athlete's current training blocks changed since it was " +
        "generated. Reject it and use \"Build next season plan\" to generate a fresh one."
    );
  }

  await supersedeUnstartedBridgePhases(supabase, skeleton.id as string);

  const rows = sortedPhases.map((phase) => ({
    skeleton_id: skeleton.id,
    phase_number: phase.phase_number,
    phase_name: phase.phase_name,
    goal: phase.goal,
    start_date: phase.start_date,
    end_date: phase.end_date,
    week_count: phase.week_count,
    weekly_template_label: phase.weekly_template_label,
    deload_test_note: phase.deload_test_note ?? null,
    is_bridge: false,
    status: "upcoming",
  }));
  const { data: phases, error: phasesError } = await supabase.from("macrocycle_phases").insert(rows).select();
  if (phasesError) throw new Error(phasesError.message);

  const { error: seasonError } = await supabase
    .from("seasons")
    .update({ skeleton_id: skeleton.id, first_phase_number: sortedPhases[0].phase_number })
    .eq("id", snapshot.next_season_id);
  if (seasonError) throw new Error(seasonError.message);

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

  if (rows.length === 0) {
    return { sessions: [] };
  }

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
  // date) alone can no longer be trusted to identify "the one row here".
  //
  // The window this call checks against is [earliest, latest] date in the
  // NEW output, not just the exact dates the new output happens to use. A
  // rebuild or new chunk can legitimately drop a date entirely (the old
  // program had a workout there; the new day structure makes it a rest
  // day), and the old session sitting on that date is "stale" exactly like
  // a cross-phase collision is — if this only ever looked at the new
  // output's own dates, that old row would never even be queried, and it
  // would sit there untouched on the athlete's calendar forever. That was
  // the actual bug: a rebuilt program showing an old program's leftover
  // workout on what's now supposed to be a rest day.
  //
  //   - Same date, DIFFERENT phase_id (a coincidental date reuse, or a
  //     phase transition where a test date landed in the new phase's
  //     window): clear that row's session_logs/logged_exercises, then
  //     delete the row — the new row (if any) takes the date with a fresh
  //     id. Unlike the same-phase case below, this is done regardless of
  //     whether it's logged — a different phase owning that date is wrong
  //     data for this phase, not a legitimate logged workout for it.
  //   - Same date, SAME phase_id, present in the new output, NOT logged
  //     (the normal republish case — a rebuild or a later chunk overlapping
  //     a day this phase already generated): UPDATE the existing row's
  //     prescription IN PLACE, preserving its id, so any session_logs
  //     already pointing at it stay attached to a stable id.
  //   - Same date, SAME phase_id, NOT present in the new output (the actual
  //     rest-day bug) — deleted, UNLESS it's already logged (see below).
  //   - Already logged (a session_logs row exists for it), regardless of
  //     whether the new output has a row for that date or not: left
  //     completely untouched — not updated, not deleted, and the new
  //     output's row for that same date (if any) is simply skipped rather
  //     than inserted as a duplicate. This is the "without affecting days
  //     that have already been logged" guarantee the rebuild/chunk buttons
  //     promise; a week-granularity rebuild can legitimately regenerate a
  //     week that has a few already-logged days earlier in it.
  //   - No existing row for a (athlete_id, phase_id, date) combination at
  //     all: plain insert.
  //   - The one case this doesn't fully resolve: an athlete manually
  //     double-booked a SECOND session from the SAME phase onto this exact
  //     date (migration 0011's whole reason for existing). There, more than
  //     one same-phase row matches the date — this updates/deletes the
  //     earliest (lowest id) of them and leaves the others alone rather
  //     than guessing which one the athlete meant to replace. Rare in
  //     practice; flag it for review if it comes up rather than silently
  //     picking for the athlete.
  const newDatesSet = new Set(rows.map((r) => r.date));
  const sortedDates = [...newDatesSet].sort();
  const minDate = sortedDates[0];
  const maxDate = sortedDates[sortedDates.length - 1];

  const { data: existingInWindow, error: existingError } = await supabase
    .from("scheduled_sessions")
    .select("id, date, phase_id")
    .eq("athlete_id", draft.athlete_id)
    .is("purchase_id", null) // never touch one-off purchased program sessions
    .gte("date", minDate)
    .lte("date", maxDate);
  if (existingError) throw new Error(existingError.message);

  const existingIds = (existingInWindow ?? []).map((s) => s.id as string);
  const loggedSessionIds = new Set<string>();
  if (existingIds.length > 0) {
    const { data: logRows, error: logsError } = await supabase
      .from("session_logs")
      .select("session_id")
      .in("session_id", existingIds);
    if (logsError) throw new Error(logsError.message);
    for (const l of logRows ?? []) loggedSessionIds.add(l.session_id as string);
  }

  const staleSessionIds = (existingInWindow ?? [])
    .filter((s) => s.phase_id !== draft.phase_id)
    .map((s) => s.id as string);

  const obsoleteSamePhaseIds = (existingInWindow ?? [])
    .filter(
      (s) =>
        s.phase_id === draft.phase_id &&
        !newDatesSet.has(s.date as string) &&
        !loggedSessionIds.has(s.id as string)
    )
    .map((s) => s.id as string);

  const idsToDelete = [...staleSessionIds, ...obsoleteSamePhaseIds];
  if (idsToDelete.length > 0) {
    const { error: deleteLogsError } = await supabase
      .from("session_logs")
      .delete()
      .in("session_id", idsToDelete);
    if (deleteLogsError) throw new Error(deleteLogsError.message);
    const { error: deleteExercisesError } = await supabase
      .from("logged_exercises")
      .delete()
      .in("session_id", idsToDelete);
    if (deleteExercisesError) throw new Error(deleteExercisesError.message);
    const { error: deleteStaleError } = await supabase
      .from("scheduled_sessions")
      .delete()
      .in("id", idsToDelete);
    if (deleteStaleError) throw new Error(deleteStaleError.message);
  }

  // Same-phase rows that are still present in the new output and not
  // logged, now that cross-phase and obsolete same-phase rows are gone —
  // the ones to UPDATE in place rather than insert fresh. Logged rows are
  // deliberately excluded here even though they share a date with a new
  // row — see the comment above.
  const samePhaseByDate = new Map<string, { id: string }[]>();
  for (const s of existingInWindow ?? []) {
    if (s.phase_id !== draft.phase_id) continue;
    if (loggedSessionIds.has(s.id as string)) continue;
    const list = samePhaseByDate.get(s.date as string) ?? [];
    list.push({ id: s.id as string });
    samePhaseByDate.set(s.date as string, list);
  }

  // Dates already logged (same phase) are skipped entirely — not updated,
  // not inserted as a duplicate.
  const loggedDates = new Set(
    (existingInWindow ?? [])
      .filter((s) => s.phase_id === draft.phase_id && loggedSessionIds.has(s.id as string))
      .map((s) => s.date as string)
  );

  const rowsToInsert: typeof rows = [];
  const sessions: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (loggedDates.has(row.date)) continue;

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
      ? deriveTrainingAge(
          intake.years_structured_training,
          intake.lifting_experience_selfdescribe,
          intake.submitted_at
        )
      : null,
    injury_individualization: [],
    days_per_week: intake?.training_days_per_week ?? null,
    equipment_context: intake ? bucketEquipment(intake.equipment ?? []) : null,
  };
}
