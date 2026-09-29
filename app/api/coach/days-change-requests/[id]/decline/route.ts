import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * POST /api/coach/days-change-requests/[id]/decline
 * Body (optional): { coach_note?: string }
 *
 * No AI calls, no changes to the athlete's actual training frequency —
 * just marks the request resolved so the athlete can see it was reviewed
 * (and, per the schema, can submit a new request afterward).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("athlete_days_change_requests")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (requestError) return dbError("coach/days-change-requests/[id]/decline", requestError);
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: `This request has already been ${request.status}.` }, { status: 400 });
  }

  let body: { coach_note?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body sent — fine, coach_note is optional
  }

  const { data: updated, error: updateError } = await supabase
    .from("athlete_days_change_requests")
    .update({
      status: "declined",
      resolved_at: new Date().toISOString(),
      resolved_by: coachId,
      coach_note: body.coach_note ?? null,
    })
    .eq("id", params.id)
    .select("id, status, coach_note")
    .single();
  if (updateError) return dbError("coach/days-change-requests/[id]/decline", updateError);

  return NextResponse.json({ request: updated });
}
