import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { compilePhasePerformanceSummary } from "@/lib/pps/compile";
import { generatePhaseRebuildDraft } from "@/lib/generation/phase";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";

/**
 * POST /api/athletes/[id]/rebuild-current-phase
 * Body: { detail?: string }
 *
 * The coach-side counterpart to /api/athletes/[id]/request-rebuild, which is
 * locked to the athlete's own session. This is for the coach's own
 * "Rebuild current phase" button — pushed after a content/rules update
 * (new exercises, a corrected day-structure-templates.md) rather than
 * anything the athlete reported. Reuses the exact same safe mechanism:
 * generatePhaseRebuildDraft only regenerates the not-yet-logged remainder of
 * the athlete's CURRENT phase — already-logged days are left alone, per
 * that function's own guarantee — and produces a new draft VERSION of the
 * phase's existing approved lineage for the coach to review at /review,
 * same as any other generation. Nothing is written to scheduled_sessions
 * until that draft is approved.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const athleteId = params.id;
  const body = await req.json().catch(() => ({}));
  const { detail } = body as { detail?: string };

  const supabase = getSupabaseAdmin();

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) return dbError("athletes/[id]/rebuild-current-phase", skeletonError);
  if (!skeleton) {
    return NextResponse.json({ error: "No active season plan found for this athlete yet." }, { status: 404 });
  }

  const { data: activePhase, error: phaseError } = await supabase
    .from("macrocycle_phases")
    .select("id")
    .eq("skeleton_id", skeleton.id)
    .eq("status", "active")
    .maybeSingle();
  if (phaseError) return dbError("athletes/[id]/rebuild-current-phase", phaseError);
  if (!activePhase) {
    return NextResponse.json({ error: "No active phase found for this athlete right now." }, { status: 404 });
  }

  try {
    const summary = await compilePhasePerformanceSummary(supabase, {
      phaseId: activePhase.id,
      reason: "rebuild_phase_scoped",
      reasonDetail: detail ?? "Coach-triggered rebuild (program rules/content updated).",
    });

    const limited = await checkAiGenerationLimit(athleteId);
    if (limited) return limited;

    const draft = await generatePhaseRebuildDraft(supabase, {
      athleteId,
      phaseId: activePhase.id,
      reason: "rebuild_phase_scoped",
      reasonDetail: detail ?? "Coach-triggered rebuild (program rules/content updated).",
    });

    return NextResponse.json({ summary: summary.summary, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rebuild failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
