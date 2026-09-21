import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/bodyweight
 *
 * Most recent bodyweight_entries rows for this athlete (default 10), newest
 * first — used to show "last logged" on the dashboard and, eventually, a
 * simple trend. The Phase Performance Summary compile job reads only the
 * single latest row (lib/pps/compile.ts), so this endpoint is purely for
 * the athlete's own view.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 10);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bodyweight_entries")
    .select("*")
    .eq("athlete_id", params.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    return dbError("athletes/[id]/bodyweight", error);
  }

  return NextResponse.json({ entries: data ?? [] });
}

/**
 * POST /api/athletes/[id]/bodyweight
 * Body: { date?: string (YYYY-MM-DD, defaults to today), bodyweight_lb: number }
 *
 * Upserts on (athlete_id, date) — matching bodyweight_entries' own unique
 * constraint, so re-logging the same day just corrects that day's entry
 * rather than erroring or duplicating.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const body = await req.json();
  const { date, bodyweight_lb } = body as { date?: string; bodyweight_lb: number };

  if (bodyweight_lb == null || Number.isNaN(Number(bodyweight_lb))) {
    return NextResponse.json({ error: "bodyweight_lb is required and must be a number." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bodyweight_entries")
    .upsert(
      {
        athlete_id: params.id,
        date: date || new Date().toISOString().slice(0, 10),
        bodyweight_lb: Number(bodyweight_lb),
      },
      { onConflict: "athlete_id,date" }
    )
    .select()
    .single();

  if (error) {
    return dbError("athletes/[id]/bodyweight", error);
  }

  return NextResponse.json({ entry: data });
}
