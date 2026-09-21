import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { generatePhaseDraft } from "@/lib/generation/phase";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";

/**
 * POST /api/phase-builder
 * Body: { athleteId: string, phaseId: string }
 *
 * Fires CALL 2 for one phase. Reads the phase's row from the active
 * skeleton, current athlete state, and (if this isn't the athlete's first
 * phase) the most recent Phase Performance Summary, then writes a new
 * program_drafts row for review at /review.
 */
export async function POST(req: NextRequest) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { athleteId, phaseId } = await req.json();

  if (!athleteId || !phaseId) {
    return NextResponse.json({ error: "athleteId and phaseId are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const draft = await generatePhaseDraft(supabase, { athleteId, phaseId });
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Phase Builder call failed";
    const status = message === "Phase not found" || message.startsWith("No current_athlete_state") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
