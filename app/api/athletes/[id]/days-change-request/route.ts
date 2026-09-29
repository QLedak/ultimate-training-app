import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

const MIN_DAYS = 2;
const MAX_DAYS = 6;

/**
 * GET/POST /api/athletes/[id]/days-change-request
 *
 * The athlete-facing half of the days/week change feature: lets an athlete
 * see their current training frequency and any pending request, and submit
 * a new request for the coach to approve. This never touches
 * current_athlete_state or athlete_intake itself — that only happens once a
 * coach approves the request (lib/generation/days-change.ts), so nothing
 * about the athlete's actual plan changes just by asking.
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();

  const { data: state, error: stateError } = await supabase
    .from("current_athlete_state")
    .select("training_days_per_week")
    .eq("athlete_id", params.id)
    .maybeSingle();
  if (stateError) return dbError("athletes/[id]/days-change-request", stateError);

  const { data: pending, error: pendingError } = await supabase
    .from("athlete_days_change_requests")
    .select("id, current_days_per_week, requested_days_per_week, note, status, requested_at")
    .eq("athlete_id", params.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingError) return dbError("athletes/[id]/days-change-request", pendingError);

  return NextResponse.json({
    current_days_per_week: state?.training_days_per_week ?? null,
    pending_request: pending ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const body = await req.json();
  const { requested_days_per_week, note } = body as { requested_days_per_week?: number; note?: string };

  if (
    typeof requested_days_per_week !== "number" ||
    !Number.isInteger(requested_days_per_week) ||
    requested_days_per_week < MIN_DAYS ||
    requested_days_per_week > MAX_DAYS
  ) {
    return NextResponse.json(
      { error: `requested_days_per_week must be a whole number between ${MIN_DAYS} and ${MAX_DAYS}.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: state, error: stateError } = await supabase
    .from("current_athlete_state")
    .select("training_days_per_week")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (stateError) return dbError("athletes/[id]/days-change-request", stateError);
  if (!state) {
    return NextResponse.json({ error: "Complete intake first." }, { status: 404 });
  }

  const currentDays = state.training_days_per_week as number;
  if (requested_days_per_week === currentDays) {
    return NextResponse.json(
      { error: `You're already training ${currentDays} days/week.` },
      { status: 400 }
    );
  }

  const { data: existingPending, error: existingError } = await supabase
    .from("athlete_days_change_requests")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) return dbError("athletes/[id]/days-change-request", existingError);
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending days/week change request. Cancel it before submitting a new one." },
      { status: 409 }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("athlete_days_change_requests")
    .insert({
      athlete_id: athleteId,
      current_days_per_week: currentDays,
      requested_days_per_week,
      note: note ?? null,
    })
    .select("id, current_days_per_week, requested_days_per_week, note, status, requested_at")
    .single();
  if (insertError) return dbError("athletes/[id]/days-change-request", insertError);

  return NextResponse.json({
    request: created,
    message: "Sent to your coach for approval.",
  });
}
