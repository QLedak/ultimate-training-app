import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/sessions
 *
 * The athlete's logging dashboard feed: scheduled sessions in a window,
 * each annotated with whether it's already been logged (session_logs.status)
 * so the dashboard/calendar can show at a glance what still needs attention.
 *
 * Two ways to pick the window:
 *  - ?start=YYYY-MM-DD&end=YYYY-MM-DD — an explicit range (used by the
 *    calendar view on /app/log, one call per month it pages to).
 *  - ?daysBack=N&daysForward=N (or neither, default 14/21) — a window around
 *    today, unrelated to the current date. Kept for the home dashboard's
 *    "this week at a glance" card and as the default for /app/log's initial
 *    load.
 * `start`/`end` win when both are present.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const { searchParams } = new URL(req.url);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  const explicitStart = searchParams.get("start");
  const explicitEnd = searchParams.get("end");

  let startStr: string;
  let endStr: string;

  if (explicitStart && explicitEnd) {
    startStr = explicitStart;
    endStr = explicitEnd;
  } else {
    const daysBack = Number(searchParams.get("daysBack") ?? 14);
    const daysForward = Number(searchParams.get("daysForward") ?? 21);

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - daysBack);
    const end = new Date(today);
    end.setDate(end.getDate() + daysForward);
    startStr = toDateStr(start);
    endStr = toDateStr(end);
  }

  const supabase = getSupabaseAdmin();

  const { data: sessions, error } = await supabase
    .from("scheduled_sessions")
    .select("id, date, phase_id, week_number, day_label, week_type, prescribed_exercises")
    .eq("athlete_id", athleteId)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true });

  if (error) {
    return dbError("athletes/[id]/sessions", error);
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: logs, error: logsError } = sessionIds.length
    ? await supabase.from("session_logs").select("session_id, status").in("session_id", sessionIds)
    : { data: [], error: null };

  if (logsError) {
    return dbError("athletes/[id]/sessions", logsError);
  }

  const statusBySession = new Map((logs ?? []).map((l) => [l.session_id, l.status]));

  const result = (sessions ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    phase_id: s.phase_id,
    week_number: s.week_number,
    day_label: s.day_label,
    week_type: s.week_type,
    exercise_count: Array.isArray(s.prescribed_exercises) ? s.prescribed_exercises.length : 0,
    status: statusBySession.get(s.id) ?? null, // null = not logged yet
  }));

  return NextResponse.json({ sessions: result });
}
