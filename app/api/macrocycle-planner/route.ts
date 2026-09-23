import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { generateMacrocycleDraft } from "@/lib/generation/macrocycle";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";

/**
 * POST /api/macrocycle-planner
 * Body: { athleteId: string, isRebuild?: boolean, rebuildReason?: string }
 *
 * Fires CALL 1. Reads the athlete's intake, runs the Planner, and writes a
 * new program_drafts row (status: pending_review) for the coach to review at
 * /review — per review-approval-flow-spec.md, this never auto-publishes.
 */
export async function POST(req: NextRequest) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { athleteId, isRebuild, rebuildReason } = await req.json();

  if (!athleteId) {
    return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
  }

  const limited = checkAiGenerationLimit(athleteId);
  if (limited) return limited;

  const supabase = getSupabaseAdmin();

  try {
    const draft = await generateMacrocycleDraft(supabase, { athleteId, isRebuild, rebuildReason });
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Macrocycle Planner call failed" },
      { status: 502 }
    );
  }
}
