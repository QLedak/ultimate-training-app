import { SupabaseClient } from "@supabase/supabase-js";
import { runMacrocyclePlanner, MacrocyclePlannerOutput } from "../prompts/macrocycle-planner";

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
  const output = await runMacrocyclePlanner({
    intake,
    isRebuild,
    rebuildReason,
    priorSkeletonPhases,
    trainingStartDate,
  });
  if (!isRebuild) assertPhase1StartsOnTrainingStartDate(output, trainingStartDate);

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

  const output = await runMacrocyclePlanner({
    intake,
    isRebuild: inputSnapshot.is_rebuild,
    rebuildReason: inputSnapshot.rebuild_reason ?? undefined,
    priorSkeletonPhases,
    trainingStartDate: tomorrowDateString(),
    currentDraftOutput: draft.output as MacrocyclePlannerOutput,
    editRequest,
  });

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
