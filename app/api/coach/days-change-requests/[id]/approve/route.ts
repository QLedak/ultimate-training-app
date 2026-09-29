import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";
import { approveDaysChangeRequest } from "@/lib/generation/days-change";

/**
 * POST /api/coach/days-change-requests/[id]/approve
 * Body (optional): { coach_note?: string }
 *
 * The one coach action that moves an athlete onto their newly-requested
 * training frequency, mid-phase if needed. See
 * lib/generation/days-change.ts::approveDaysChangeRequest for exactly what
 * this does — in short: updates the athlete's day count everywhere it's
 * read from, then re-fires the Macrocycle Planner and (if there's an active,
 * already-delivered phase) Phase Builder, both landing as new pending_review
 * drafts in the normal /review queue for the coach's final sign-off.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("athlete_days_change_requests")
    .select("id, athlete_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (requestError) return dbError("coach/days-change-requests/[id]/approve", requestError);
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: `This request has already been ${request.status}.` }, { status: 400 });
  }

  const limited = await checkAiGenerationLimit(request.athlete_id as string);
  if (limited) return limited;

  let body: { coach_note?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body sent — fine, coach_note is optional
  }

  try {
    const result = await approveDaysChangeRequest(supabase, {
      requestId: params.id,
      coachId,
      coachNote: body.coach_note,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve request";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
