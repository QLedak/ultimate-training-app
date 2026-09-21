import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/sessions
 *
 * The athlete's logging dashboard feed: scheduled sessions in a window
 * around today (default 14 days back, 21 days forward — plenty to log a
 * missed day late or look ahead at the week, without ever paging the whole
 * season through the client), each annotated with whether it's already been
 * logged (session_logs.status) so the dashboard can show at a glance what
 * still needs attention.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const { searchParams } = new URL(req.url);
  const daysBack = Number(searchParams.get("daysBack") ?? 14);
  const daysForward = Number(searchParams.get("daysForward") ?? 21);

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  const end = new Date(today);
  end.setDate(end.getDate() + daysForward);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  const supabase = getSupabaseAdmin();

  const { data: sessions, error } = await supabase
    .from("scheduled_sessions")
    .select("id, date, phase_id, week_number, day_label, week_type, prescribed_exercises")
    .eq("athlete_id", athleteId)
    .gte("date", toDateStr(start))
    .lte("date", toDateStr(end))
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
