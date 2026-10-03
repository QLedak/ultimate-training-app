import { SupabaseClient } from "@supabase/supabase-js";
import { compilePhasePerformanceSummary } from "../pps/compile";
import { generatePhaseDraft, generateNextPhaseDraft, lastGeneratedWeek } from "./phase";
import { checkAiGenerationLimit } from "../api/ai-generation-limit";

// How many days of lead time to keep in front of an athlete at all times.
// Chosen to comfortably cover a coach not checking the review queue every
// single day, without generating so early that "current athlete state"
// (used as an input to the next chunk) is stale relative to what's actually
// been logged.
const LEAD_DAYS = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const ms = new Date(toISO + "T00:00:00Z").getTime() - new Date(fromISO + "T00:00:00Z").getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

type ActionLog = { athleteId: string; phaseId: string; action: string; detail?: string };

/**
 * Closes the gap called out in data-architecture-spec.md Step 6/7(a) (phase
 * transition and the next Phase Builder call should both fire automatically)
 * that was never actually wired up -- see app/api/phases/[id]/compile-summary/route.ts's
 * own comment admitting as much, and app/coach/page.tsx's "Generate phase
 * draft" button being the only trigger that existed before this.
 *
 * Meant to run once a day (see app/api/cron/phase-transitions/route.ts +
 * vercel.json). For every athlete's active phase:
 *   0. If this phase is still running but ends within LEAD_DAYS, and the
 *      NEXT phase in the skeleton doesn't have a draft or generated weeks
 *      yet, proactively fire "Generate Next Phase" (generateNextPhaseDraft)
 *      for it -- this is the coach-side "Generate next phase" button's own
 *      trigger, run automatically ahead of the boundary instead of waiting
 *      for a coach to notice. The current phase itself is untouched.
 *   1. If the current phase is actually finished (past its end date) --
 *      compile its PhasePerformanceSummary and flip phase status (active ->
 *      completed, next phase -> active), same as the manual compile-summary
 *      endpoint already did, just triggered automatically instead of never.
 *      By the time this fires, step 0 has usually already generated (and
 *      hopefully the coach has already approved) the next phase's sessions
 *      on a prior day's run, so there's no gap at the boundary.
 *   2. Whichever phase ends up active (the one just flipped to, or the one
 *      that already was), if it's running low on generated/scheduled weeks
 *      (within LEAD_DAYS of running out) and isn't already fully generated
 *      or already has a pending review draft, fire Phase Builder for the
 *      next chunk -- so a draft is sitting in the coach's review queue with
 *      lead time, instead of the athlete hitting a dead end and the coach
 *      finding out after the fact. This is for a phase that's chunked across
 *      multiple Phase Builder calls within itself (DELIVERY_CHUNK_WEEKS);
 *      step 0 is for the boundary BETWEEN two phases.
 *
 * Approval is still manual (coach review stays in place for now) -- this
 * only automates the TRIGGER to generate, not the publish step.
 */
export async function runDailyPhaseTransitionCheck(supabase: SupabaseClient): Promise<ActionLog[]> {
  const today = todayISO();
  const actions: ActionLog[] = [];

  const { data: activePhases, error } = await supabase
    .from("macrocycle_phases")
    .select("id, phase_number, week_count, end_date, skeleton_id, macrocycle_skeletons!inner(athlete_id, is_active)")
    .eq("status", "active")
    .eq("macrocycle_skeletons.is_active", true);
  if (error) throw new Error(error.message);

  for (const phase of activePhases ?? []) {
    const athleteId = (phase.macrocycle_skeletons as unknown as { athlete_id: string }).athlete_id;
    let currentPhaseId = phase.id as string;
    let currentWeekCount = phase.week_count as number;
    let currentEndDate = phase.end_date as string;

    try {
      // ---- Step 0: proactive "Generate Next Phase", LEAD_DAYS before this
      // phase actually ends. Distinct from Step 2 below (which continues
      // the CURRENT phase's own chunked delivery) -- this fires
      // generateNextPhaseDraft for the NEXT phase in the skeleton while the
      // current one is still running and untouched, so a coach on their
      // normal review cadence finds the next phase's draft waiting well
      // before the boundary. Step 1 below only reacts AFTER end_date has
      // already passed, which on its own would mean the draft doesn't even
      // exist until the day the athlete needs it -- this closes that gap.
      // Approval is still manual, same as every other generation trigger
      // here: this only creates the draft, never publishes it.
      if (currentEndDate && currentEndDate >= today && daysBetween(today, currentEndDate) <= LEAD_DAYS) {
        const { data: nextPhaseRow } = await supabase
          .from("macrocycle_phases")
          .select("id")
          .eq("skeleton_id", phase.skeleton_id as string)
          .eq("phase_number", (phase.phase_number as number) + 1)
          .maybeSingle();

        if (nextPhaseRow) {
          const nextAlreadyGenerated = (await lastGeneratedWeek(supabase, nextPhaseRow.id as string)) > 0;
          const { data: nextPending } = await supabase
            .from("program_drafts")
            .select("id")
            .eq("phase_id", nextPhaseRow.id)
            .eq("call_type", "phase_builder")
            .eq("status", "pending_review")
            .limit(1);

          if (!nextAlreadyGenerated && !(nextPending && nextPending.length > 0)) {
            if (await checkAiGenerationLimit(athleteId)) {
              actions.push({
                athleteId,
                phaseId: currentPhaseId,
                action: "skipped_rate_limited",
                detail: "next-phase generation skipped: athlete's daily AI generation limit already reached today",
              });
            } else {
              const draft = await generateNextPhaseDraft(supabase, {
                athleteId,
                activePhaseId: currentPhaseId,
              });
              actions.push({
                athleteId,
                phaseId: currentPhaseId,
                action: "generated_next_phase_proactively",
                detail: `draft ${draft.id} for phase ${nextPhaseRow.id}, current phase ends ${currentEndDate}`,
              });
            }
          }
        }
      }

      // ---- Step 1: has this phase actually run its course? ----
      if (currentEndDate && currentEndDate < today) {
        const { nextPhase } = await compilePhasePerformanceSummary(supabase, {
          phaseId: currentPhaseId,
          reason: "normal_transition",
        });
        actions.push({
          athleteId,
          phaseId: currentPhaseId,
          action: "phase_completed",
          detail: nextPhase ? `advanced to phase ${nextPhase.phase_number}` : "season complete, no next phase",
        });

        if (!nextPhase) continue; // season's over -- nothing left to generate

        currentPhaseId = nextPhase.id as string;
        currentWeekCount = nextPhase.week_count as number;
        currentEndDate = nextPhase.end_date as string;
      }

      // ---- Step 2: does the now-active phase need its next chunk generated? ----
      const generatedThrough = await lastGeneratedWeek(supabase, currentPhaseId);
      const fullyGenerated = generatedThrough >= currentWeekCount;
      if (fullyGenerated) continue;

      const { data: pending } = await supabase
        .from("program_drafts")
        .select("id")
        .eq("phase_id", currentPhaseId)
        .eq("call_type", "phase_builder")
        .eq("status", "pending_review")
        .limit(1);
      if (pending && pending.length > 0) continue; // already waiting on the coach

      const { data: lastSession } = await supabase
        .from("scheduled_sessions")
        .select("date")
        .eq("phase_id", currentPhaseId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const runwayDays = lastSession ? daysBetween(today, lastSession.date as string) : -1;
      const needsNextChunk = !lastSession || runwayDays <= LEAD_DAYS;

      if (needsNextChunk) {
        if (await checkAiGenerationLimit(athleteId)) {
          actions.push({
            athleteId,
            phaseId: currentPhaseId,
            action: "skipped_rate_limited",
            detail: "athlete's daily AI generation limit already reached today",
          });
          continue;
        }
        const draft = await generatePhaseDraft(supabase, { athleteId, phaseId: currentPhaseId });
        actions.push({
          athleteId,
          phaseId: currentPhaseId,
          action: "generated_next_chunk",
          detail: `draft ${draft.id}, runway was ${lastSession ? `${runwayDays}d` : "none scheduled yet"}`,
        });
      }
    } catch (err) {
      actions.push({
        athleteId,
        phaseId: currentPhaseId,
        action: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return actions;
}
