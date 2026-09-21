import { SupabaseClient } from "@supabase/supabase-js";
import { runPhaseBuilder, PhaseBuilderInput, PhaseBuilderOutput } from "../prompts/phase-builder";
import { Situation } from "../corpus/retrieve";
import { deriveTrainingAge } from "../training/training-age";
import { bucketEquipment } from "../training/equipment";

// A phase longer than this many weeks is generated across multiple calls
// instead of one — testing showed even 32,000 output tokens wasn't reliably
// enough for a full 8-week phase's worth of detailed exercises in one shot.
const SPLIT_THRESHOLD_WEEKS = 5;

function weekRanges(totalWeeks: number, startWeek = 1): Array<{ start: number; end: number }> {
  const remainingWeeks = totalWeeks - startWeek + 1;
  if (remainingWeeks <= SPLIT_THRESHOLD_WEEKS) return [{ start: startWeek, end: totalWeeks }];
  const firstHalfEnd = startWeek + Math.ceil(remainingWeeks / 2) - 1;
  return [
    { start: startWeek, end: firstHalfEnd },
    { start: firstHalfEnd + 1, end: totalWeeks },
  ];
}

type BaseInput = Omit<
  PhaseBuilderInput,
  "weekRange" | "priorWeeksContext" | "currentDraftOutput" | "editRequest"
>;

/**
 * Generates a phase's full output, splitting into multiple runPhaseBuilder
 * calls when the phase is long enough that one call risks truncation
 * (SPLIT_THRESHOLD_WEEKS above), and merging the results back into a single
 * PhaseBuilderOutput — so everything downstream (draft storage, the review
 * screen, materialization into scheduled_sessions) stays unaware a split
 * ever happened.
 *
 * Pass `edit` to regenerate an edited version (the "chat edit" path):  each
 * call gets the coach's edit request plus only the slice of the CURRENT
 * draft that falls in its own week range.
 *
 * Pass `startWeek` (> 1) for a phase-scoped rebuild (data-architecture-spec.md
 * step 7(b)): only weeks from `startWeek` through the phase's end get
 * (re)generated, using the phase's real absolute week numbers, so
 * materializeScheduledSessions's upsert-by-date only ever touches those
 * future days — earlier weeks' ScheduledSession rows (and any logs already
 * against them) are never included in the output and so are left alone.
 */
async function buildFullPhaseOutput(
  supabase: SupabaseClient,
  baseInput: BaseInput,
  edit?: { currentDraftOutput: PhaseBuilderOutput; editRequest: string },
  startWeek = 1
): Promise<PhaseBuilderOutput> {
  const totalWeeks = baseInput.phase.week_count as number;
  const ranges = weekRanges(totalWeeks, startWeek);

  if (ranges.length === 1 && startWeek === 1) {
    return runPhaseBuilder(supabase, {
      ...baseInput,
      ...(edit ? { currentDraftOutput: edit.currentDraftOutput, editRequest: edit.editRequest } : {}),
    });
  }

  const merged: PhaseBuilderOutput = { weeks: [], coach_review_flags: [] };
  let rationaleSoFar: string | undefined;

  for (const range of ranges) {
    const weekRange = { start: range.start, end: range.end, totalWeeks };

    const editForThisCall = edit
      ? {
          currentDraftOutput: {
            ...edit.currentDraftOutput,
            weeks: edit.currentDraftOutput.weeks.filter(
              (w) => w.week_number >= range.start && w.week_number <= range.end
            ),
          },
          editRequest: edit.editRequest,
        }
      : undefined;

    const priorWeeksContext =
      merged.weeks.length > 0
        ? { rationaleSoFar, lastWeek: merged.weeks[merged.weeks.length - 1] }
        : undefined;

    const result = await runPhaseBuilder(supabase, {
      ...baseInput,
      weekRange,
      priorWeeksContext,
      ...(editForThisCall ?? {}),
    });

    merged.weeks.push(...result.weeks);
    merged.coach_review_flags = [...(merged.coach_review_flags ?? []), ...(result.coach_review_flags ?? [])];
    // The FIRST call in this sequence carries the rationale/athlete_intro —
    // true whether that's week 1 of a fresh phase or the first regenerated
    // week of a mid-phase rebuild (range.start > 1).
    if (range === ranges[0]) {
      merged.rationale = result.rationale;
      merged.athlete_intro = result.athlete_intro;
      rationaleSoFar = result.rationale;
    }
  }

  merged.weeks.sort((a, b) => a.week_number - b.week_number);
  return merged;
}

/**
 * Shared context-fetching for the Phase Builder call — used by a fresh
 * generation (v1) and by regenerating an edited version of an existing draft
 * (review-approval-flow-spec.md "chat edit" path), so both build on exactly
 * the same inputs.
 */
async function buildPhaseContext(supabase: SupabaseClient, params: { athleteId: string; phaseId: string }) {
  const { athleteId, phaseId } = params;

  const [
    { data: phase, error: phaseError },
    { data: intake, error: intakeError },
    { data: currentState, error: stateError },
  ] = await Promise.all([
    supabase.from("macrocycle_phases").select("*").eq("id", phaseId).single(),
    supabase
      .from("athlete_intake")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("current_athlete_state").select("*").eq("athlete_id", athleteId).single(),
  ]);

  // Surface the actual Postgres/PostgREST error rather than guessing "not
  // found" for every failure mode — a permissions or query error looks
  // identical to "no row" if you only check for null data.
  if (phaseError || !phase) {
    throw new Error(`Phase not found${phaseError ? `: ${phaseError.message}` : ""}`);
  }
  if (intakeError) {
    throw new Error(`Failed to load athlete intake: ${intakeError.message}`);
  }
  if (stateError || !currentState) {
    throw new Error(
      `No current_athlete_state row — has intake been submitted?${stateError ? ` (${stateError.message})` : ""}`
    );
  }

  const { data: latestSummary } = await supabase
    .from("phase_performance_summaries")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const equipment = (currentState.equipment as string[]) ?? [];
  const injuryLocations = ((currentState.standing_resilience_regions as { location: string }[]) ?? []).map(
    (r) => r.location
  );

  const situation: Situation = {
    phaseGoal: phase.goal,
    trainingAge: deriveTrainingAge(intake?.years_structured_training, intake?.lifting_experience_selfdescribe),
    injuryLocations,
    daysPerWeek: currentState.training_days_per_week,
    equipmentContext: bucketEquipment(equipment),
  };

  return { phase, intake: intake ?? {}, currentState, latestSummary: latestSummary ?? null, situation };
}

/** POST /api/phase-builder and the "reject & regenerate" path both call this for a fresh v1. */
export async function generatePhaseDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; phaseId: string }
) {
  const { athleteId, phaseId } = params;
  const { phase, intake, currentState, latestSummary, situation } = await buildPhaseContext(supabase, {
    athleteId,
    phaseId,
  });

  const output = await buildFullPhaseOutput(supabase, {
    phase,
    athleteIntake: intake,
    currentAthleteState: currentState,
    phasePerformanceSummary: latestSummary,
    situation,
  });

  const { data: draft, error: draftError } = await supabase
    .from("program_drafts")
    .insert({
      athlete_id: athleteId,
      call_type: "phase_builder",
      phase_id: phaseId,
      version: 1,
      status: "pending_review",
      input_snapshot: {
        phase_id: phaseId,
        phase_performance_summary_id: latestSummary?.id ?? null,
        situation,
      },
      output,
    })
    .select()
    .single();

  if (draftError) throw new Error(draftError.message);
  return draft;
}

/**
 * Athlete-initiated rebuild, phase-scoped (data-architecture-spec.md step
 * 7(b)): re-fires Phase Builder for the SAME phase that's currently active
 * and already approved/published, reading the just-compiled
 * interruption-flagged PhasePerformanceSummary (compilePhasePerformanceSummary
 * must be called with a rebuild reason BEFORE this). Only weeks from today's
 * week forward are regenerated — "new ScheduledSession rows replace only the
 * not-yet-logged future days of that phase; already-logged history is
 * untouched" — and the new draft becomes the next VERSION of the phase's
 * existing approved lineage (edit_source: "rebuild"), not a fresh lineage,
 * matching "New ProgramDraft version, same review/approval mechanics."
 */
export async function generatePhaseRebuildDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; phaseId: string; reason: string; reasonDetail?: string }
) {
  const { athleteId, phaseId } = params;
  const { phase, intake, currentState, latestSummary, situation } = await buildPhaseContext(supabase, {
    athleteId,
    phaseId,
  });

  const { data: approvedDraft, error: approvedDraftError } = await supabase
    .from("program_drafts")
    .select("*")
    .eq("phase_id", phaseId)
    .eq("call_type", "phase_builder")
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (approvedDraftError) throw new Error(approvedDraftError.message);
  if (!approvedDraft) {
    throw new Error("No approved phase_builder draft found for this phase — nothing to rebuild from.");
  }

  // Find the earliest week that still has an unlogged (or future) day —
  // everything before that week is left completely alone.
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: sessionsSoFar, error: sessionsError } = await supabase
    .from("scheduled_sessions")
    .select("week_number, date")
    .eq("phase_id", phaseId)
    .order("week_number", { ascending: false });
  if (sessionsError) throw new Error(sessionsError.message);

  const lastPastOrTodayWeek = (sessionsSoFar ?? []).find((s) => s.date <= todayStr)?.week_number;
  const startWeek = lastPastOrTodayWeek ?? 1;

  const output = await buildFullPhaseOutput(
    supabase,
    {
      phase,
      athleteIntake: intake,
      currentAthleteState: currentState,
      phasePerformanceSummary: latestSummary,
      situation,
    },
    undefined,
    startWeek
  );

  const { data: newDraft, error: draftError } = await supabase
    .from("program_drafts")
    .insert({
      lineage_id: approvedDraft.lineage_id,
      athlete_id: athleteId,
      call_type: "phase_builder",
      phase_id: phaseId,
      version: (approvedDraft.version as number) + 1,
      parent_version: approvedDraft.version,
      status: "pending_review",
      input_snapshot: {
        phase_id: phaseId,
        phase_performance_summary_id: latestSummary?.id ?? null,
        situation,
        rebuild_start_week: startWeek,
      },
      output,
      edit_source: "rebuild",
      edit_request: { reason: params.reason, reason_detail: params.reasonDetail ?? null },
    })
    .select()
    .single();

  if (draftError) throw new Error(draftError.message);
  return newDraft;
}

/** The "chat edit" path in review-approval-flow-spec.md — regenerates a full new version of an existing draft lineage. */
export async function revisePhaseBuilderDraft(
  supabase: SupabaseClient,
  draft: Record<string, unknown>,
  editRequest: string
) {
  const { phase, intake, currentState, latestSummary, situation } = await buildPhaseContext(supabase, {
    athleteId: draft.athlete_id as string,
    phaseId: draft.phase_id as string,
  });

  const output = await buildFullPhaseOutput(
    supabase,
    {
      phase,
      athleteIntake: intake,
      currentAthleteState: currentState,
      phasePerformanceSummary: latestSummary,
      situation,
    },
    { currentDraftOutput: draft.output as PhaseBuilderOutput, editRequest }
  );

  const { data: newDraft, error: draftError } = await supabase
    .from("program_drafts")
    .insert({
      lineage_id: draft.lineage_id,
      athlete_id: draft.athlete_id,
      call_type: "phase_builder",
      phase_id: draft.phase_id,
      version: (draft.version as number) + 1,
      parent_version: draft.version,
      status: "pending_review",
      input_snapshot: draft.input_snapshot,
      output,
      edit_source: "chat",
      edit_request: editRequest,
    })
    .select()
    .single();

  if (draftError) throw new Error(draftError.message);
  return newDraft;
}
