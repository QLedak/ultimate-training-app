import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/coach/days-change-requests
 *
 * Coach-only list of athlete days/week change requests, joined with the
 * athlete's name/email so the review UI can show "Jordan: 4 -> 6 days/week"
 * without a second round trip. Defaults to pending only (?status=all to see
 * the full history, approved/declined included).
 */
export async function GET(req: Request) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "pending";

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("athlete_days_change_requests")
    .select(
      "id, athlete_id, current_days_per_week, requested_days_per_week, note, status, requested_at, resolved_at, coach_note, athletes(name, email)"
    )
    .order("requested_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: requests, error } = await query;
  if (error) return dbError("coach/days-change-requests", error);

  return NextResponse.json({ requests: requests ?? [] });
}
