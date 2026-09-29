import { SupabaseClient } from "@supabase/supabase-js";
import { compilePhasePerformanceSummary } from "../pps/compile";
import { generateMacrocycleDraft } from "./macrocycle";
import { generatePhaseRebuildDraft } from "./phase";

/**
 * Approving an athlete's days/week change request (app/api/coach/days-change-requests/[id]/approve)
 * is the ONE place that actually moves the athlete to their new training
 * frequency, mid-phase if needed. It does everything by hand that the coach
 * would otherwise have to piece together themselves:
 *
 *  1. Updates current_athlete_state.training_days_per_week — this is what
 *     Phase Builder reads (lib/generation/phase.ts's buildPhaseContext), so
 *     from this moment on any new phase-builder call uses the new number.
 *  2. Updates the athlete's latest athlete_intake row the same way — this is
 *     what the Macrocycle Planner reads (lib/generation/macrocycle.ts's
 *     buildMacrocycleContext), and it's also the record system-prompt-v3.md
 *     means by "a real intake change" that's allowed to move the day count.
 *  3. Re-fires the Macrocycle Planner (isRebuild: true) so future phases'
 *     templates reflect the new day count — a new pending_review draft, not
 *     an auto-publish, same as every other AI output in this app.
 *  4. If the athlete has an active phase that's already been approved and
 *     delivered, re-fires Phase Builder for it too (generatePhaseRebuildDraft)
 *     — this is the actual "mid-phase" part: only the not-yet-logged
 *     remaining weeks of the CURRENT phase are regenerated, at the new day
 *     count, as a new version of that phase's draft lineage. Already-logged
 *     history is untouched, exactly like any other phase-scoped rebuild.
 *
 * Both AI drafts land in the coach's normal /review queue — approving the
 * REQUEST queues the regeneration, it doesn't skip review of what comes out
 * of it.
 *
 * IMPORTANT: the request is only marked "approved" once the (required)
 * Macrocycle Planner regeneration actually succeeds. If the AI call fails
 * for any reason (rate limit, an expired/out-of-credit API key, a network
 * blip), current_athlete_state and athlete_intake are rolled back to the
 * athlete's day count from before this call, and the request is left
 * "pending" — so the coach can just fix whatever broke (e.g. add Anthropic
 * Console credits) and click Approve again, rather than the request getting
 * stuck "approved" with a day count that was never actually regenerated for.
 */
export async function approveDaysChangeRequest(
  supabase: SupabaseClient,
  params: { requestId: string; coachId: string; coachNote?: string }
) {
  const { requestId, coachId, coachNote } = params;

  const { data: request, error: requestError } = await supabase
    .from("athlete_days_change_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (requestError || !request) {
    throw new Error(`Request not found${requestError ? `: ${requestError.message}` : ""}`);
  }
  if (request.status !== "pending") {
    throw new Error(`This request has already been ${request.status}.`);
  }

  const athleteId = request.athlete_id as string;
  const previousDays = request.current_days_per_week as number;
  const newDays = request.requested_days_per_week as number;

  // ---- 1 & 2: move the athlete's actual day count ----
  // (Needed before the AI calls below — both read the current, live value.)
  const { error: stateError } = await supabase
    .from("current_athlete_state")
    .update({ training_days_per_week: newDays })
    .eq("athlete_id", athleteId);
  if (stateError) throw new Error(`Failed to update current_athlete_state: ${stateError.message}`);

  const { data: latestIntake, error: intakeError } = await supabase
    .from("athlete_intake")
    .select("id")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intakeError) throw new Error(`Failed to load intake: ${intakeError.message}`);
  if (latestIntake) {
    const { error: updateIntakeError } = await supabase
      .from("athlete_intake")
      .update({ training_days_per_week: newDays })
      .eq("id", latestIntake.id);
    if (updateIntakeError) throw new Error(`Failed to update intake: ${updateIntakeError.message}`);
  }

  // If anything below throws before the request is marked resolved, undo
  // the day-count change above and leave the request pending for a retry.
  async function rollbackDayCount() {
    await supabase.from("current_athlete_state").update({ training_days_per_week: previousDays }).eq("athlete_id", athleteId);
    if (latestIntake) {
      await supabase.from("athlete_intake").update({ training_days_per_week: previousDays }).eq("id", latestIntake.id);
    }
  }

  const reasonDetail = `Athlete requested a change from ${previousDays} to ${newDays} days/week${
    request.note ? ` — athlete's note: "${request.note}"` : ""
  }.`;

  const result: {
    macrocycleDraft: Record<string, unknown> | null;
    phaseDraft: Record<string, unknown> | null;
    note: string | null;
  } = { macrocycleDraft: null, phaseDraft: null, note: null };

  // ---- 3 & 4: only if the athlete actually has an active plan to move ----
  const { data: skeleton } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();

  let activePhase: { id: string } | null = null;
  if (skeleton) {
    const { data } = await supabase
      .from("macrocycle_phases")
      .select("id")
      .eq("skeleton_id", skeleton.id)
      .eq("status", "active")
      .maybeSingle();
    activePhase = data ?? null;
  }

  if (skeleton) {
    try {
      // Flag the interruption on the active phase (if any) before
      // regenerating — same PhasePerformanceSummary compile every other
      // rebuild path does.
      if (activePhase) {
        await compilePhasePerformanceSummary(supabase, {
          phaseId: activePhase.id,
          reason: "rebuild_skeleton_scoped",
          reasonDetail,
        });
      }

      result.macrocycleDraft = await generateMacrocycleDraft(supabase, {
        athleteId,
        isRebuild: true,
        rebuildReason: reasonDetail,
      });
    } catch (err) {
      await rollbackDayCount();
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = raw.includes("credit balance")
        ? "Your Anthropic Console API account is out of credits — add credits at console.anthropic.com (Plans & Billing), then click Approve again. Nothing was changed."
        : `Failed to regenerate the season plan, so nothing was changed: ${raw}`;
      throw new Error(friendly);
    }
  }

  // ---- Only now mark the request resolved — the required regeneration (if
  // there was an active plan to regenerate) has actually succeeded. ----
  const { error: resolveError } = await supabase
    .from("athlete_days_change_requests")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: coachId,
      coach_note: coachNote ?? null,
    })
    .eq("id", requestId);
  if (resolveError) throw new Error(`Failed to resolve request: ${resolveError.message}`);

  if (!skeleton) {
    result.note = "No active season plan yet — the new day count is saved and will apply once one is generated.";
    return result;
  }

  if (activePhase) {
    try {
      result.phaseDraft = await generatePhaseRebuildDraft(supabase, {
        athleteId,
        phaseId: activePhase.id,
        reason: "rebuild_skeleton_scoped",
        reasonDetail,
      });
    } catch (err) {
      // The macrocycle draft above already succeeded and the request is
      // already resolved at this point — a phase-rebuild failure here is a
      // partial result, not a reason to unwind everything. Most commonly:
      // nothing approved/delivered yet for this phase (e.g. the coach
      // hasn't approved its first phase_builder draft), so there's nothing
      // to rebuild mid-phase yet — but a rate limit or billing error can
      // land here too, so the note says which.
      const raw = err instanceof Error ? err.message : String(err);
      result.note = raw.includes("No approved phase_builder draft found")
        ? "Updated the season plan, but this phase hasn't been delivered to the athlete yet, so there was " +
          "nothing to rebuild mid-phase — the new day count will apply once you approve its first draft."
        : `Updated the season plan, but the mid-phase rebuild failed and needs a retry: ${raw}`;
      console.error("[days-change] phase rebuild skipped:", raw);
    }
  } else {
    result.note = "Updated the season plan — no phase is currently active to rebuild mid-phase.";
  }

  return result;
}
