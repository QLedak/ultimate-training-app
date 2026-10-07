import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { applyInjuryStatusUpdate, reportNewInjury } from "@/lib/generation/injury-status";
import { compilePhasePerformanceSummary } from "@/lib/pps/compile";
import { generatePhaseRebuildDraft } from "@/lib/generation/phase";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";

const ACTIONS = ["check_in", "report_new"] as const;
type Action = (typeof ACTIONS)[number];
const STATUSES = ["resolved", "still_active"] as const;
type Status = (typeof STATUSES)[number];

type InjuryState = { current_active_injuries: unknown; standing_resilience_regions: unknown };

/**
 * GET/POST /api/athletes/[id]/injury-status
 *
 * Two things an athlete previously had no way to tell the app, mid-season:
 *
 * - `action: "check_in"` (default) — an already-active injury (reported at
 *   intake, or via a prior "report_new" here) has either resolved or is
 *   still bothering them. See lib/generation/injury-status.ts for what each
 *   does to current_athlete_state.
 * - `action: "report_new"` — a brand new injury (or a past one flaring back
 *   up) that wasn't part of intake and isn't already active. Starts the
 *   isometric-first progression for it starting next generation.
 *
 * Both are modeled after the existing "injury_pain" rebuild path in
 * request-rebuild (an athlete self-reporting their own body status is
 * exactly the kind of thing this app already auto-triggers a rebuild for,
 * no coach approval gate — that's reserved for structural changes like
 * days/week). The rebuild is best-effort either way: the underlying state
 * change always saves, a rebuild failure just means it takes effect at the
 * next normal phase transition instead of immediately.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  const { data: state, error } = await supabase
    .from("current_athlete_state")
    .select("current_active_injuries, standing_resilience_regions")
    .eq("athlete_id", params.id)
    .maybeSingle();
  if (error) return dbError("athletes/[id]/injury-status", error);
  if (!state) {
    return NextResponse.json({ error: "Complete intake first." }, { status: 404 });
  }

  return NextResponse.json({
    current_active_injuries: state.current_active_injuries ?? [],
    standing_resilience_regions: state.standing_resilience_regions ?? [],
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const body = await req.json();
  const {
    action = "check_in",
    location,
    status,
    character,
    note,
  } = body as { action?: Action; location?: string; status?: Status; character?: string; note?: string };

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  }
  if (!location || typeof location !== "string") {
    return NextResponse.json({ error: "location is required." }, { status: 400 });
  }
  if (action === "check_in" && (!status || !STATUSES.includes(status))) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: skeleton } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();

  let activePhase: { id: string; goal: string } | null = null;
  if (skeleton) {
    const { data } = await supabase
      .from("macrocycle_phases")
      .select("id, goal")
      .eq("skeleton_id", skeleton.id)
      .eq("status", "active")
      .maybeSingle();
    activePhase = (data as { id: string; goal: string } | null) ?? null;
  }

  let injuryState: InjuryState;
  let reasonDetail: string;
  let successMessage: string;
  try {
    if (action === "report_new") {
      injuryState = await reportNewInjury(supabase, { athleteId, location, character, note });
      reasonDetail = `Athlete reported a new injury: ${location}${character ? ` (${character})` : ""}${
        note ? ` — note: "${note}"` : ""
      }.`;
      successMessage = `Logged your ${location} issue — your program will start the return-from-injury protocol for it.`;
    } else {
      injuryState = await applyInjuryStatusUpdate(supabase, {
        athleteId,
        location,
        status: status as Status,
        note,
        currentPhaseId: activePhase?.id ?? null,
      });
      reasonDetail = `Athlete reported their ${location} issue is ${
        status === "resolved" ? "resolved" : "still bothering them"
      }${note ? ` — note: "${note}"` : ""}.`;
      successMessage =
        status === "resolved"
          ? activePhase
            ? `Great — glad your ${location} is feeling better. We'll finish this phase as planned, then move you into strengthening work for it in your next phase.`
            : `Marked your ${location} issue as resolved — it moves onto standing strengthening work instead of the return-from-injury progression.`
          : `Got it — your ${location} issue is still noted as active, and your program will keep progressing it through the return protocol.`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update injury status";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result: {
    injury_status: InjuryState;
    phaseDraft: Record<string, unknown> | null;
    message: string;
  } = { injury_status: injuryState, phaseDraft: null, message: successMessage };

  if (!activePhase) {
    return NextResponse.json(result);
  }

  // A resolved check-in never rebuilds the current phase: it finishes as
  // planned and the area moves to heavy slow resistance in the NEXT phase
  // (lib/generation/injury-status.ts, applyPendingResolutionsForPhase).
  if (action === "check_in" && status === "resolved") {
    return NextResponse.json(result);
  }

  try {
    await compilePhasePerformanceSummary(supabase, {
      phaseId: activePhase.id,
      reason: "rebuild_phase_scoped",
      reasonDetail,
    });

    const limited = await checkAiGenerationLimit(athleteId);
    if (limited) {
      result.message += " Your coach will need to trigger the update manually — today's AI generation limit is reached.";
      return NextResponse.json(result);
    }

    result.phaseDraft = await generatePhaseRebuildDraft(supabase, {
      athleteId,
      phaseId: activePhase.id,
      reason: "rebuild_phase_scoped",
      reasonDetail,
    });
    result.message += " Your coach has an updated plan to review — you'll see the change once it's approved.";
  } catch (err) {
    // The state change above already saved. A rebuild failure here (nothing
    // delivered yet for this phase, a rate limit, a billing hiccup) just
    // means the new status takes effect at the next normal phase transition
    // instead of immediately — not a reason to lose the report/check-in itself.
    const raw = err instanceof Error ? err.message : String(err);
    result.message += raw.includes("No approved phase_builder draft found")
      ? " This phase hasn't been delivered to you yet, so the change will apply once your coach approves its first draft."
      : ` (Couldn't rebuild your current phase right now, so this will apply at your next phase instead: ${raw})`;
    console.error("[injury-status] phase rebuild skipped:", raw);
  }

  return NextResponse.json(result);
}
