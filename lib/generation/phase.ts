import { SupabaseClient } from "@supabase/supabase-js";
import { runPhaseBuilder, PhaseBuilderInput, PhaseBuilderOutput, PhaseWeek } from "../prompts/phase-builder";
import { Situation } from "../corpus/retrieve";
import { deriveTrainingAge } from "../training/training-age";
import { bucketEquipment } from "../training/equipment";
import { compilePhasePerformanceSummary } from "../pps/compile";

// A phase longer than this many weeks is generated across multiple calls
// instead of one — testing showed even 32,000 output tokens wasn't reliably
// enough for a full 8-week phase's worth of detailed exercises in one shot.
const SPLIT_THRESHOLD_WEEKS = 5;

// Business rule, not a training-methodology one (see DELIVERY_CHUNK_WEEKS
// below the imports for the full rationale): caps how many weeks a SINGLE
// call to runPhaseBuilder is asked to produce in one shot. Kept distinct
// from DELIVERY_CHUNK_WEEKS — one is "how much the model writes per API
// call" (a token-budget concern), the other is "how much the athlete gets
// per Phase Builder generation" (a product/billing concern) — they happen
// to both be small numbers but for unrelated reasons.
function weekRanges(startWeek: number, endWeek: number): Array<{ start: number; end: number }> {
  const remainingWeeks = endWeek - startWeek + 1;
  if (remainingWeeks <= SPLIT_THRESHOLD_WEEKS) return [{ start: startWeek, end: endWeek }];

  // Split into as many EVEN, bounded chunks as needed to keep every one at
  // or under SPLIT_THRESHOLD_WEEKS -- this used to bisect exactly once
  // regardless of how long the range was, so a 12-week range (a full rebuild
  // of a long phase, which isn't capped by DELIVERY_CHUNK_WEEKS the way
  // normal chunk generation is) produced two 6-week halves, each already
  // over the threshold that prompted splitting in the first place. A
  // chat-edit on that same draft re-requests that same oversized range and
  // is what actually tipped a call over its token budget. This divides the
  // range into enough equal pieces that every piece is safely within
  // SPLIT_THRESHOLD_WEEKS, regardless of total length.
  const numChunks = Math.ceil(remainingWeeks / SPLIT_THRESHOLD_WEEKS);
  const chunkSize = Math.ceil(remainingWeeks / numChunks);
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = startWeek;
  while (cursor <= endWeek) {
    const end = Math.min(cursor + chunkSize - 1, endWeek);
    ranges.push({ start: cursor, end });
    cursor = end + 1;
  }
  return ranges;
}

/**
 * A model call can return valid-looking JSON (non-empty "weeks", passes the
 * truncation check in runPhaseBuilder) while still silently skipping or
 * duplicating a week it was asked for — this happened in practice (a phase's
 * week 1 came back missing, with the model's own rationale explaining it had
 * decided to "generate it separately"). That's not an edge case to tolerate:
 * a coach reviewing a draft has no reason to expect a gap, and a missed week
 * reaching an athlete's actual schedule is exactly what chunked delivery
 * must never produce. So every call's output is checked against the EXACT
 * set of week numbers it was asked for, and any mismatch fails loudly here
 * — before the draft is ever saved — rather than shipping a partial phase
 * with a footnote buried in the rationale.
 */
function assertCompleteWeeks(weeks: PhaseWeek[], expectedStart: number, expectedEnd: number) {
  const expected = new Set<number>();
  for (let w = expectedStart; w <= expectedEnd; w++) expected.add(w);

  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const week of weeks) {
    if (seen.has(week.week_number)) duplicates.push(week.week_number);
    seen.add(week.week_number);
  }

  const missing = [...expected].filter((w) => !seen.has(w)).sort((a, b) => a - b);
  const unexpected = [...seen].filter((w) => !expected.has(w)).sort((a, b) => a - b);

  if (missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing week${missing.length === 1 ? "" : "s"} ${missing.join(", ")}`);
    if (unexpected.length > 0)
      parts.push(`unexpected week${unexpected.length === 1 ? "" : "s"} ${unexpected.join(", ")} outside the requested range`);
    if (duplicates.length > 0) parts.push(`duplicate week${duplicates.length === 1 ? "" : "s"} ${duplicates.join(", ")}`);
    throw new Error(
      `Phase Builder response for weeks ${expectedStart}-${expectedEnd} was incomplete: ${parts.join("; ")}. ` +
        "Nothing was saved — try generating this chunk again."
    );
  }
}

/**
 * Workouts are delivered to the athlete at most this many weeks at a time,
 * regardless of how many weeks the phase itself spans in the Macrocycle
 * Skeleton. This is a delivery/billing decision, not a coaching one — a
 * phase's actual length, goal, deload/test placement, and progression are
 * still whatever the Macrocycle Planner laid out; a phase longer than this
 * just has its remaining weeks generated as a separate, later chunk (its own
 * program_draft, reviewed and approved the same way) instead of the whole
 * phase landing on the athlete the moment the first chunk is approved. The
 * eventual monthly subscription is meant to bill on exactly this cadence.
 */
const DELIVERY_CHUNK_WEEKS = 4;

type BaseInput = Omit<
  PhaseBuilderInput,
  "weekRange" | "priorWeeksContext" | "currentDraftOutput" | "editRequest"
>;

type SeedContext = { rationaleSoFar?: string; lastWeek: PhaseWeek };

/**
 * Generates a phase's output for the week range [startWeek, endWeek] —
 * which may be the whole phase (short phase, or an old-style call) or a
 * single delivery chunk of it — splitting into multiple runPhaseBuilder
 * calls when that range alone is long enough to risk truncation
 * (SPLIT_THRESHOLD_WEEKS above), and merging the results back into a single
 * PhaseBuilderOutput — so everything downstream (draft storage, the review
 * screen, materialization into scheduled_sessions) stays unaware a split
 * (or a chunk boundary) ever happened.
 *
 * `totalWeeks` (the phase's real, full length) is always passed to the
 * model as context even when startWeek/endWeek cover only part of it, so
 * deload/test placement and overall progression stay correct across chunk
 * boundaries — only how much gets WRITTEN in this call is bounded.
 *
 * `seedContext`, when given, carries the last already-approved chunk's final
 * week (and its rationale) into this call's very first runPhaseBuilder
 * request — the same mechanism used internally to stitch together a
 * multi-call split, reused here to stitch together separate delivery
 * chunks generated potentially days apart, so a later chunk continues load
 * progression naturally and doesn't re-introduce the phase from scratch.
 *
 * Pass `edit` to regenerate an edited version (the "chat edit" path): the
 * call gets the coach's edit request plus only the slice of the CURRENT
 * draft that falls in its own week range.
 */
async function buildFullPhaseOutput(
  supabase: SupabaseClient,
  baseInput: BaseInput,
  edit?: { currentDraftOutput: PhaseBuilderOutput; editRequest: string },
  startWeek = 1,
  endWeek?: number,
  seedContext?: SeedContext
): Promise<PhaseBuilderOutput> {
  const totalWeeks = baseInput.phase.week_count as number;
  const genEnd = endWeek ?? totalWeeks;
  const ranges = weekRanges(startWeek, genEnd);

  if (ranges.length === 1 && !seedContext) {
    // Always hand the model an explicit "# WEEK RANGE FOR THIS CALL" block
    // (built from weekRange below) even when this single call happens to
    // cover the whole phase from week 1 — leaving weekRange unset here used
    // to skip that instruction entirely and rely on the model noticing
    // phase.week_count buried in the raw phase JSON, which is exactly what
    // let a rebuild's phase-performance-summary framing ("interrupted
    // mid-way") talk the model into writing only one week instead of the
    // full requested range. Being explicit costs nothing on a from-scratch
    // full-phase call and closes that gap on every other call shape.
    const weekRange = { start: startWeek, end: genEnd, totalWeeks };
    // Slice the current draft down to this call's range before handing it
    // back for editing — same reasoning as the multi-range loop below: this
    // path now also covers a single mid-phase chunk's edit (e.g. revising
    // only weeks 5-8 of an 8-week phase), not just a from-scratch full-phase
    // call, so it can no longer assume the whole currentDraftOutput belongs
    // to this call's range.
    const editForThisCall = edit
      ? {
          currentDraftOutput: {
            ...edit.currentDraftOutput,
            weeks: edit.currentDraftOutput.weeks.filter(
              (w) => w.week_number >= startWeek && w.week_number <= genEnd
            ),
          },
          editRequest: edit.editRequest,
        }
      : undefined;
    const result = await runPhaseBuilder(supabase, {
      ...baseInput,
      weekRange,
      ...(editForThisCall ?? {}),
    });
    assertCompleteWeeks(result.weeks, startWeek, genEnd);
    return result;
  }

  const merged: PhaseBuilderOutput = { weeks: [], coach_review_flags: [] };
  let rationaleSoFar: string | undefined = seedContext?.rationaleSoFar;

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
        : seedContext;

    const result = await runPhaseBuilder(supabase, {
      ...baseInput,
      weekRange,
      priorWeeksContext,
      ...(editForThisCall ?? {}),
    });

    assertCompleteWeeks(result.weeks, range.start, range.end);

    merged.weeks.push(...result.weeks);
    merged.coach_review_flags = [...(merged.coach_review_flags ?? []), ...(result.coach_review_flags ?? [])];
    // The FIRST call in this sequence carries the rationale/athlete_intro —
    // true whether that's week 1 of a fresh phase, the first regenerated
    // week of a mid-phase rebuild, or (per the prompt's own instruction to
    // skip repeating it when priorWeeksContext/seedContext is present) left
    // blank for a later delivery chunk, in which case fall back to the
    // seed's rationale so the draft/review screen never shows nothing.
    if (range === ranges[0]) {
      merged.rationale = result.rationale || seedContext?.rationaleSoFar;
      merged.athlete_intro = result.athlete_intro;
      rationaleSoFar = result.rationale || rationaleSoFar;
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

/**
 * How far into this phase has actually been delivered to the athlete —
 * ground truth is scheduled_sessions (only an APPROVED, publish_to_athlete
 * draft writes those), not draft status, so a rejected or approved-but-not-
 * published chunk never counts as "already generated." Returns 0 if nothing
 * of this phase has been scheduled yet.
 */
export async function lastGeneratedWeek(supabase: SupabaseClient, phaseId: string): Promise<number> {
  const { data, error } = await supabase
    .from("scheduled_sessions")
    .select("week_number")
    .eq("phase_id", phaseId)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.week_number ?? 0;
}

/**
 * Continuity context for a delivery chunk that isn't the phase's first:
 * pulls the most recently APPROVED phase_builder draft for this phase and
 * hands its rationale + final week forward as this call's seed, the same
 * shape buildFullPhaseOutput already uses to stitch together a multi-call
 * split. Returns undefined for the phase's first-ever chunk, or if nothing
 * approved is found (shouldn't happen in practice, but generation should
 * still proceed — just without a continuity note — rather than fail).
 */
async function findChunkContinuity(supabase: SupabaseClient, phaseId: string): Promise<SeedContext | undefined> {
  const { data: approved, error } = await supabase
    .from("program_drafts")
    .select("output")
    .eq("phase_id", phaseId)
    .eq("call_type", "phase_builder")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !approved) return undefined;

  const output = approved.output as PhaseBuilderOutput;
  if (!output?.weeks || output.weeks.length === 0) return undefined;

  const lastWeek = [...output.weeks].sort((a, b) => b.week_number - a.week_number)[0];
  return { rationaleSoFar: output.rationale, lastWeek };
}

/**
 * POST /api/phase-builder and the "reject & regenerate" path both call this.
 * Generates the NEXT not-yet-delivered chunk of this phase — up to
 * DELIVERY_CHUNK_WEEKS weeks, starting right after whatever's already been
 * approved and published for it (lastGeneratedWeek above). For a phase
 * that fits within one chunk, this is exactly the whole phase, same as
 * before chunking existed. Throws if the phase has already been fully
 * generated.
 */
export async function generatePhaseDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; phaseId: string }
) {
  const { athleteId, phaseId } = params;
  const { phase, intake, currentState, latestSummary, situation } = await buildPhaseContext(supabase, {
    athleteId,
    phaseId,
  });

  const totalWeeks = phase.week_count as number;
  const startWeek = (await lastGeneratedWeek(supabase, phaseId)) + 1;
  if (startWeek > totalWeeks) {
    throw new Error(
      `This phase's full ${totalWeeks} week${totalWeeks === 1 ? "" : "s"} have already been generated — nothing left to build.`
    );
  }
  const endWeek = Math.min(startWeek + DELIVERY_CHUNK_WEEKS - 1, totalWeeks);
  const seedContext = startWeek > 1 ? await findChunkContinuity(supabase, phaseId) : undefined;

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
    startWeek,
    endWeek,
    seedContext
  );

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
        chunk_start_week: startWeek,
        chunk_end_week: endWeek,
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
 *
 * Unlike a fresh generatePhaseDraft chunk, a rebuild is not capped at
 * DELIVERY_CHUNK_WEEKS — it's responding to something already scheduled
 * changing underneath the athlete (injury, missed week), not a new delivery
 * cycle, so it regenerates everything from startWeek through the phase's
 * true end, same as before chunked delivery existed.
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
  const totalWeeks = phase.week_count as number;

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
        chunk_start_week: startWeek,
        chunk_end_week: totalWeeks,
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

/**
 * The "chat edit" path in review-approval-flow-spec.md — regenerates a full
 * new version of an existing draft lineage, over the SAME week range that
 * draft already covers (its chunk_start_week/chunk_end_week — pre-chunking
 * drafts had none, so this falls back to the whole phase, matching the
 * original behavior for those).
 */
export async function revisePhaseBuilderDraft(
  supabase: SupabaseClient,
  draft: Record<string, unknown>,
  editRequest: string
) {
  const { phase, intake, currentState, latestSummary, situation } = await buildPhaseContext(supabase, {
    athleteId: draft.athlete_id as string,
    phaseId: draft.phase_id as string,
  });

  const snapshot = (draft.input_snapshot ?? {}) as { chunk_start_week?: number; chunk_end_week?: number };
  const startWeek = snapshot.chunk_start_week ?? 1;
  const endWeek = snapshot.chunk_end_week ?? (phase.week_count as number);

  const output = await buildFullPhaseOutput(
    supabase,
    {
      phase,
      athleteIntake: intake,
      currentAthleteState: currentState,
      phasePerformanceSummary: latestSummary,
      situation,
    },
    { currentDraftOutput: draft.output as PhaseBuilderOutput, editRequest },
    startWeek,
    endWeek
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

/**
 * Coach-triggered "Generate Next Phase" button — distinct from both the
 * daily cron's in-phase chunk generation (generatePhaseDraft, called with
 * the SAME phase that's already active) and a rebuild of the current phase
 * (generatePhaseRebuildDraft, also the same phase). This one builds the
 * NEXT phase in the skeleton — still sitting at status "upcoming" — while
 * the current phase keeps running completely untouched: its status, its
 * already-scheduled/logged days, none of it is touched by this call.
 *
 * Before firing Phase Builder for the next phase, this compiles a fresh
 * Phase Performance Summary from the CURRENT phase's logged-so-far data
 * (reason: "rebuild_phase_scoped" — the phase_performance_summaries table's
 * reason enum has no more precise label for "mid-phase, not actually a
 * rebuild," but this reason is what matters functionally: per
 * compilePhasePerformanceSummary's own doc comment, it does NOT flip any
 * phase's status, only "normal_transition" does). That's what lets the next
 * phase's prescriptions reflect the athlete's real, current weights/sets/
 * reps rather than stale data left over from the phase before this one.
 *
 * The actual active -> completed / upcoming -> active status flip between
 * the current and next phase is deliberately left to the existing daily
 * cron (lib/generation/phase-transitions.ts), which already flips it the
 * moment the current phase's end_date passes. Calling this early (the
 * 7-day-lead-time trigger in runDailyPhaseTransitionCheck is meant to call
 * this, not generatePhaseDraft, once wired up) just means that by the time
 * the cron does the flip, the next phase's sessions are already generated
 * and (ideally) already approved — no gap at the boundary, no need for this
 * function to pre-empt the cron's own status bookkeeping.
 */
export async function generateNextPhaseDraft(
  supabase: SupabaseClient,
  params: { athleteId: string; activePhaseId: string }
) {
  const { athleteId, activePhaseId } = params;

  const { data: activePhase, error: activePhaseError } = await supabase
    .from("macrocycle_phases")
    .select("id, phase_number, skeleton_id")
    .eq("id", activePhaseId)
    .single();
  if (activePhaseError || !activePhase) throw new Error("Active phase not found");

  const { data: nextPhase, error: nextPhaseError } = await supabase
    .from("macrocycle_phases")
    .select("id")
    .eq("skeleton_id", activePhase.skeleton_id as string)
    .eq("phase_number", (activePhase.phase_number as number) + 1)
    .maybeSingle();
  if (nextPhaseError) throw new Error(nextPhaseError.message);
  if (!nextPhase) {
    throw new Error("No next phase in this athlete's season plan — this is the final phase of their skeleton.");
  }

  await compilePhasePerformanceSummary(supabase, {
    phaseId: activePhaseId,
    reason: "rebuild_phase_scoped",
    reasonDetail: "Coach-triggered: generating next phase ahead of this phase ending.",
  });

  return generatePhaseDraft(supabase, { athleteId, phaseId: nextPhase.id as string });
}
