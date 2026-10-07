import { SupabaseClient } from "@supabase/supabase-js";
import { runMacrocyclePlanner, MacrocyclePlannerOutput } from "../prompts/macrocycle-planner";
import { addDays, computeMacrocyclePhaseSequence, ComputedPhase } from "./phase-sequencing";
import { suggestSeasonLabel } from "../seasons/calendar";

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
  const inputSnapshot = draft.input_snapshot as {
    is_rebuild: boolean;
    rebuild_reason: string | null;
    next_season_id?: string;
  };
  if (inputSnapshot.next_season_id) return reviseNextSeasonDraft(supabase, draft, editRequest);
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


// ---------------------------------------------------------------------------
// NEXT-SEASON PLANS (year-over-year) — see lib/generation/season-bridge.ts
// ---------------------------------------------------------------------------

export type NextSeasonContext = {
  season_id: string;
  season_label: string;
  first_phase_number: number;
  resume_date: string;
  include_gpp: boolean;
  bridge_gpp_already_done: boolean;
  previous_season_review: Record<string, unknown> | null;
  kept_phases: Array<{ phase_number: number; goal: string; start_date: string; end_date: string; status: string }>;
};

/**
 * Everything the Planner needs for the athlete's NEXT season: the intake with
 * the planned season's calendar (and any days/goals changes the athlete asked
 * for) overlaid, the deterministic phase boundaries, and the context block.
 *
 * The new phases are appended to the athlete's active skeleton AFTER the last
 * block that has started (or is a non-bridge, still-upcoming block). Unstarted
 * bridge blocks are the ones being replaced. GPP is included only if no bridge
 * GPP block has already run since the last season ended.
 */
export async function buildNextSeasonInputs(supabase: SupabaseClient, params: { athleteId: string; seasonId: string }) {
  const { athleteId, seasonId } = params;
  const { intake } = await buildMacrocycleContext(supabase, { athleteId });

  const { data: season, error: seasonError } = await supabase.from("seasons").select("*").eq("id", seasonId).single();
  if (seasonError || !season) throw new Error("Season not found.");
  if (season.athlete_id !== athleteId) throw new Error("Season belongs to a different athlete.");
  if (!season.season_start || !season.season_end) throw new Error("This season has no dates yet.");

  const changes = (season.intake_changes as { training_days_per_week?: number; goals?: string } | null) ?? {};
  const overlaidIntake: Record<string, unknown> = {
    ...intake,
    season_start: season.season_start,
    season_end: season.season_end,
    recurring_commitments: season.recurring_commitments,
    tournament_weekends: season.tournament_weekends,
    season_calendar_confirmed: season.calendar_confirmed,
    ...(changes.training_days_per_week != null ? { training_days_per_week: changes.training_days_per_week } : {}),
    ...(changes.goals != null ? { goals: changes.goals } : {}),
  };

  const { data: skeleton } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (!skeleton) throw new Error("No active plan to continue from — build a season plan the normal way first.");

  const { data: allPhases } = await supabase
    .from("macrocycle_phases")
    .select("phase_number, goal, start_date, end_date, status, is_bridge")
    .eq("skeleton_id", skeleton.id)
    .neq("status", "superseded")
    .order("phase_number", { ascending: true });
  const kept = (allPhases ?? []).filter((p) => !(p.is_bridge && p.status === "upcoming"));
  if (kept.length === 0) throw new Error("No existing phases to continue from.");
  const lastKept = kept[kept.length - 1];

  const tomorrow = tomorrowDateString();
  const afterLast = addDays(lastKept.end_date as string, 1);
  const resumeDate = afterLast > tomorrow ? afterLast : tomorrow;
  const bridgeGppDone = kept.some((p) => p.is_bridge && p.goal === "gpp_reacclimation");
  const includeGpp = !bridgeGppDone;

  const priorityTournament = ((season.tournament_weekends as TournamentWeekend[] | null) ?? []).find(
    (t) => t.is_priority && t.start_date
  );
  const { phases, flags } = computeMacrocyclePhaseSequence({
    resumeDate,
    seasonStart: season.season_start as string,
    seasonEnd: season.season_end as string,
    priorityTournamentDate: priorityTournament?.start_date ?? null,
    includeGpp,
  });
  if (phases.length === 0) {
    throw new Error(
      "Nothing left to plan: the current training blocks already run past this season's start/end dates. " +
        "Check the dates, or wait until the current block finishes."
    );
  }
  const firstPhaseNumber = (lastKept.phase_number as number) + 1;
  const computedPhases = phases.map((p, i) => ({ phase_number: firstPhaseNumber + i, ...p }));

  const { data: review } = await supabase
    .from("season_reviews")
    .select("summary")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ctx: NextSeasonContext = {
    season_id: seasonId,
    season_label: (season.label as string) || suggestSeasonLabel(season.season_start as string),
    first_phase_number: firstPhaseNumber,
    resume_date: resumeDate,
    include_gpp: includeGpp,
    bridge_gpp_already_done: bridgeGppDone,
    previous_season_review: (review?.summary as Record<string, unknown>) ?? null,
    kept_phases: kept.map((p) => ({
      phase_number: p.phase_number as number,
      goal: p.goal as string,
      start_date: p.start_date as string,
      end_date: p.end_date as string,
      status: p.status as string,
    })),
  };

  return { intake: overlaidIntake, intakeId: intake.id as string, computedPhases, computedPhaseFlags: flags, ctx };
}

/** Planner draft for a planned season; goes to the coach review queue like any other. */
export async function generateNextSeasonDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; seasonId: string }
) {
  const { athleteId, seasonId } = params;
  const inputs = await buildNextSeasonInputs(supabase, { athleteId, seasonId });
  const output = await runMacrocyclePlanner({
    intake: inputs.intake,
    trainingStartDate: inputs.ctx.resume_date,
    computedPhases: inputs.computedPhases,
    computedPhaseFlags: inputs.computedPhaseFlags,
    nextSeason: inputs.ctx,
  });
  assertPhasesMatchComputedSkeleton(output, inputs.computedPhases);

  const { data: draft, error } = await supabase
    .from("program_drafts")
    .insert({
      athlete_id: athleteId,
      call_type: "macrocycle_planner",
      version: 1,
      status: "pending_review",
      input_snapshot: {
        intake_id: inputs.intakeId,
        is_rebuild: false,
        rebuild_reason: null,
        next_season_id: seasonId,
        first_phase_number: inputs.ctx.first_phase_number,
        resume_date: inputs.ctx.resume_date,
      },
      output,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return draft;
}

/** Chat-edit path for a next-season draft (phase boundaries stay fixed, same as a fresh plan). */
export async function reviseNextSeasonDraft(
  supabase: SupabaseClient,
  draft: Record<string, unknown>,
  editRequest: string
) {
  const snapshot = draft.input_snapshot as { next_season_id: string };
  const inputs = await buildNextSeasonInputs(supabase, {
    athleteId: draft.athlete_id as string,
    seasonId: snapshot.next_season_id,
  });
  const output = await runMacrocyclePlanner({
    intake: inputs.intake,
    trainingStartDate: inputs.ctx.resume_date,
    computedPhases: inputs.computedPhases,
    computedPhaseFlags: inputs.computedPhaseFlags,
    nextSeason: inputs.ctx,
    currentDraftOutput: draft.output as MacrocyclePlannerOutput,
    editRequest,
  });
  assertPhasesMatchComputedSkeleton(output, inputs.computedPhases);

  const { data: newDraft, error } = await supabase
    .from("program_drafts")
    .insert({
      lineage_id: draft.lineage_id,
      athlete_id: draft.athlete_id,
      call_type: "macrocycle_planner",
      version: (draft.version as number) + 1,
      parent_version: draft.version,
      status: "pending_review",
      input_snapshot: { ...(draft.input_snapshot as object), first_phase_number: inputs.ctx.first_phase_number, resume_date: inputs.ctx.resume_date },
      output,
      edit_source: "chat",
      edit_request: editRequest,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return newDraft;
}
