import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * DELETE /api/athletes/[id]/days-change-request/[requestId]
 *
 * Lets an athlete cancel their own pending days/week change request — e.g.
 * they changed their mind, or fat-fingered the number. Only ever deletes a
 * request that's still "pending"; once a coach has approved or declined it,
 * it's part of the record and stays.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("athlete_days_change_requests")
    .select("id, athlete_id, status")
    .eq("id", params.requestId)
    .maybeSingle();
  if (requestError) return dbError("athletes/[id]/days-change-request/[requestId]", requestError);
  if (!request || request.athlete_id !== params.id) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Only a pending request can be cancelled." }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from("athlete_days_change_requests")
    .delete()
    .eq("id", params.requestId);
  if (deleteError) return dbError("athletes/[id]/days-change-request/[requestId]", deleteError);

  return NextResponse.json({ cancelled: true });
}
