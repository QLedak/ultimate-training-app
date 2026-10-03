import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { generateNextPhaseDraft } from "@/lib/generation/phase";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";

/**
 * POST /api/athletes/[id]/generate-next-phase
 *
 * The coach's "Generate next phase" button, and the target of the daily
 * cron's 7-day-lead-time proactive trigger (see
 * lib/generation/phase-transitions.ts) — distinct from the existing
 * "Generate" button on the coach dashboard, which only continues the
 * CURRENT phase's own not-yet-delivered chunk. This builds the NEXT phase
 * in the athlete's skeleton (still "upcoming") from their real logged
 * performance so far in the current phase. The current phase is not
 * touched — its status, schedule, and logs are untouched by this call; see
 * generateNextPhaseDraft's own doc comment for why the active/completed
 * status flip is deliberately left to the daily cron rather than done here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const athleteId = params.id;
  const supabase = getSupabaseAdmin();

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) return dbError("athletes/[id]/generate-next-phase", skeletonError);
  if (!skeleton) {
    return NextResponse.json({ error: "No active season plan found for this athlete yet." }, { status: 404 });
  }

  const { data: activePhase, error: phaseError } = await supabase
    .from("macrocycle_phases")
    .select("id")
    .eq("skeleton_id", skeleton.id)
    .eq("status", "active")
    .maybeSingle();
  if (phaseError) return dbError("athletes/[id]/generate-next-phase", phaseError);
  if (!activePhase) {
    return NextResponse.json({ error: "No active phase found for this athlete right now." }, { status: 404 });
  }

  const limited = await checkAiGenerationLimit(athleteId);
  if (limited) return limited;

  try {
    const draft = await generateNextPhaseDraft(supabase, { athleteId, activePhaseId: activePhase.id });
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate next phase failed";
    const status =
      message.includes("final phase") ? 409 : message.includes("already been generated") ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
