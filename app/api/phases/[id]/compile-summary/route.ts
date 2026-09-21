import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { compilePhasePerformanceSummary } from "@/lib/pps/compile";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";

/**
 * POST /api/phases/[id]/compile-summary
 * Body: { reason?: "normal_transition" | "rebuild_phase_scoped" | "rebuild_skeleton_scoped", reasonDetail?: string }
 *
 * Compiles the Phase Performance Summary for this phase from its logged
 * sessions (workout-logging-schema-spec.md), folds updated maxes into
 * current_athlete_state, and — on a normal transition — marks this phase
 * completed and the next phase in the skeleton active
 * (data-architecture-spec.md Step 6/7a).
 *
 * There's no scheduler wired up yet (per the README's "what's next" list),
 * so for now this fires manually: call it once you're done logging a
 * phase's workouts and ready to move to the next one.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const body = await req.json().catch(() => ({}));

  const supabase = getSupabaseAdmin();

  try {
    const result = await compilePhasePerformanceSummary(supabase, {
      phaseId: params.id,
      reason: body.reason,
      reasonDetail: body.reasonDetail,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compile failed";
    const status = message === "Phase not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
