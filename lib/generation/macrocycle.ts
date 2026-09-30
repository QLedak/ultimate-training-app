import { SupabaseClient } from "@supabase/supabase-js";
import { runMacrocyclePlanner, MacrocyclePlannerOutput } from "../prompts/macrocycle-planner";
import { addDays, computeMacrocyclePhaseSequence, ComputedPhase } from "./phase-sequencing";

/**
 * Tomorrow's date (server UTC), as YYYY-MM-DD — training always starts the
 * day after the athlete signs up, full stop, independent of whatever
 * season_start/season_end they entered on intake (that's their COMPETITIVE
 * season — games/tournaments — not a training start date; the periodization
 * builds TOWARD that date, or a flagged priority tournament, as a peak
 * target, per the prompt section this feeds). Passed to the Macrocycle
 * Planner as `trainingStartDate` and used as Phase 1's exact start_date.
 */
function tomorrowDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type TournamentWeekend = { start_date?: string; end_date?: string; is_priority?: boolean };

/**
 * Builds the deterministic 4-week-block phase skeleton (lib/generation/
 * phase-sequencing.ts) for whatever portion of the season still needs
 * planning, and assigns phase_number continuing on from any preserved
 * prior phases. Returns undefined when season_start isn't available/
 * confirmed yet — the prompt falls back to its old provisional-skeleton
 * guidance in that case, same as before this feature existed.
 */
function buildComputedPhaseSkeleton(params: {
  intake: Record<string, unknown>;
  isRebuild?: boolean;
  priorSkeletonPhases: Record<string, unknown>[];
  trainingStartDate: string;
}): { computedPhases: Array<{ phase_number: number } & ComputedPhase>; computedPhaseFlags: string[] } | undefined {
  const { intake, isRebuild, priorSkeletonPhases, trainingStartDate } = params;

  const seasonStart = intake.season_start as string | null | undefined;
  const seasonEnd = intake.season_end as string | null | undefined;
  if (!seasonStart || !seasonEnd) return undefined;

  const priorityTournament = ((intake.tournament_weekends as TournamentWeekend[] | null) ?? []).find(
    (t) => t.is_priority && t.start_date
  );

  let resumeDate = trainingStartDate;
  let includeGpp = !isRebuild;
  let lastPhaseNumber = 0;

  if (isRebuild && priorSkeletonPhases.length > 0) {
    const latest = [...priorSkeletonPhases].sort(
      (a, b) => (b.phase_number as number) - (a.phase_number as number)
    )[0];
    resumeDate = addDays(latest.end_date as string, 1);
    lastPhaseNumber = latest.phase_number as number;
    includeGpp = false;
  }

  const { phases, flags } = computeMacrocyclePhaseSequence({
    resumeDate,
    seasonStart,
    seasonEnd,
    priorityTournamentDate: priorityTournament?.start_date ?? null,
    includeGpp,
  });

  return {
    computedPhases: phases.map((p, i) => ({ phase_number: lastPhaseNumber + i + 1, ...p })),
    computedPhaseFlags: flags,
  };
}

/**
 * Same "fail loudly rather than ship it" posture as the Phase Builder's
 * assertCompleteWeeks (lib/generation/phase.ts) — the prompt instruction
 * above makes this unlikely, but an exact start date the model can silently
 * ignore isn't really exact. Only checked for a fresh (non-rebuild)
 * skeleton: that's the "new athlete intake" case this exists for — a
 * rebuild isn't replanning Phase 1's start at all.
 */
function assertPhase1StartsOnTrainingStartDate(output: MacrocyclePlannerOutput, trainingStartDate: string) {
  const phase1 = [...output.phases].sort((a, b) => a.phase_number - b.phase_number)[0];
  if (phase1 && phase1.start_date !== trainingStartDate) {
    throw new Error(
      `Macrocycle Planner scheduled Phase 1 to start ${phase1.start_date} instead of ${trainingStartDate} ` +
        "(the day after signup — training start, not the athlete's competitive season start). Nothing was " +
        "saved — try generating this skeleton again."
    );
  }
}

/**
 * Only enforced for a fresh (non-rebuild) skeleton, same carve-out as
 * assertPhase1StartsOnTrainingStartDate — a rebuild is explicitly allowed
 * to deviate from the computed default (e.g. an injury_return/testing_block
 * phase the rebuild reason calls for), so it's guidance there, not a gate.
 */
function assertPhasesMatchComputedSkeleton(
  output: MacrocyclePlannerOutput,
  computedPhases: Array<{ phase_number: number } & ComputedPhase>
) {
  const byNumber = new Map(output.phases.map((p) => [p.phase_number, p]));
  for (const expected of computedPhases) {
    const actual = byNumber.get(expected.phase_number);
    if (
      !actual ||
      actual.goal !== expected.goal ||
      actual.start_date !== expected.start_date ||
      actual.end_date !== expected.end_date ||
      actual.week_count !== expected.week_count
    ) {
      throw new Error(
        `Macrocycle Planner did not use the app's computed phase boundaries for phase ${expected.phase_number} ` +
          `(expected goal=${expected.goal}, ${expected.start_date} -> ${expected.end_date}, ` +
          `${expected.week_count}wk). Nothing was saved — try generating this skeleton again.`
      );
    }
  }
}

/**
 * Shared context-fetching for the Macrocycle Planner call — used by a fresh
 * generation (v1) and by regenerating an edited version of an existing draft
 * (review-approval-flow-spec.md "chat edit" path), so both build on exactly
 * the same inputs.
 */
async function buildMacrocycleContext(
  supabase: SupabaseClient,
  params: { athleteId: string; isRebuild?: boolean }
) {
  const { athleteId, isRebuild } = params;

  const { data: intake, error: intakeError } = await supabase
    .from("athlete_intake")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();

  if (intakeError || !intake) {
    throw new Error("No intake found for this athlete. Complete intake first.");
  }

  let priorSkeletonPhases: Record<string, unknown>[] = [];
  if (isRebuild) {
    const { data: activeSkeleton } = await supabase
      .from("macrocycle_skeletons")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("is_active", true)
      .single();

    if (activeSkeleton) {
      const { data: phases } = await supabase
        .from("macrocycle_phases")
        .select("*")
        .eq("skeleton_id", activeSkeleton.id)
        .in("status", ["completed", "active"]);
      priorSkeletonPhases = phases ?? [];
    }
  }

  return { intake, priorSkeletonPhases };
}

/** POST /api/macrocycle-planner and the "reject & regenerate" path both call this for a fresh v1. */
export async function generateMacrocycleDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; isRebuild?: boolean; rebuildReason?: string }
) {
  const { athleteId, isRebuild, rebuildReason } = params;
  const { intake, priorSkeletonPhases } = await buildMacrocycleContext(supabase, { athleteId, isRebuild });

  const trainingStartDate = tomorrowDateString();
  const skeleton = buildComputedPhaseSkeleton({ intake, isRebuild, priorSkeletonPhases, trainingStartDate });
  const output = await runMacrocyclePlanner({
    intake,
    isRebuild,
    rebuildReason,
    priorSkeletonPhases,
    trainingStartDate,
    computedPhases: skeleton?.computedPhases,
    computedPhaseFlags: skeleton?.computedPhaseFlags,
  });
  if (!isRebuild) {
    assertPhase1StartsOnTrainingStartDate(output, trainingStartDate);
    if (skeleton) assertPhasesMatchComputedSkeleton(output, skeleton.computedPhases);
  }

  const { data: draft, error: draftError } = await supabase
    .from("program_drafts")
    .insert({
      athlete_id: athleteId,
      call_type: "macrocycle_planner",
      version: 1,
      status: "pending_review",
      input_snapshot: {
        intake_id: intake.id,
        is_rebuild: !!isRebuild,
        rebuild_reason: rebuildReason ?? null,
      },
      output,
    })
    .select()
    .single();

  if (draftError) throw new Error(draftError.message);
  return draft;
}

/** The "chat edit" path in review-approval-flow-spec.md — regenerates a full new version of an existing draft lineage. */
export async function reviseMacrocyclePlannerDraft(
  supabase: SupabaseClient,
  draft: Record<string, unknown>,
  editRequest: string
) {
  const inputSnapshot = draft.input_snapshot as { is_rebuild: boolean; rebuild_reason: string | null };
  const { intake, priorSkeletonPhases } = await buildMacrocycleContext(supabase, {
    athleteId: draft.athlete_id as string,
    isRebuild: inputSnapshot.is_rebuild,
  });

  const trainingStartDate = tomorrowDateString();
  const skeleton = buildComputedPhaseSkeleton({
    intake,
    isRebuild: inputSnapshot.is_rebuild,
    priorSkeletonPhases,
    trainingStartDate,
  });
  const output = await runMacrocyclePlanner({
    intake,
    isRebuild: inputSnapshot.is_rebuild,
    rebuildReason: inputSnapshot.rebuild_reason ?? undefined,
    priorSkeletonPhases,
    trainingStartDate,
    computedPhases: skeleton?.computedPhases,
    computedPhaseFlags: skeleton?.computedPhaseFlags,
    currentDraftOutput: draft.output as MacrocyclePlannerOutput,
    editRequest,
  });
  // A chat edit to a fresh (non-rebuild) draft still must not touch phase
  // boundaries — same guardrail as the initial v1 generation.
  if (!inputSnapshot.is_rebuild && skeleton) assertPhasesMatchComputedSkeleton(output, skeleton.computedPhases);

  const { data: newDraft, error: draftError } = await supabase
    .from("program_drafts")
    .insert({
      lineage_id: draft.lineage_id,
      athlete_id: draft.athlete_id,
      call_type: "macrocycle_planner",
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
