import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

// How far from the originally-scheduled date a session can move. This is
// meant for "move Tuesday's lift to Thursday because life happened," not for
// rebuilding the program's week-to-week sequencing — a bigger change than
// that should go through the coach (days-change-request / request-rebuild),
// since it can affect deload/test placement and schedule-anchor spacing the
// Macrocycle Skeleton already accounted for.
const MAX_SHIFT_DAYS = 6;

/**
 * PATCH /api/sessions/[id]/reschedule
 * Body: { date: "YYYY-MM-DD" }
 *
 * Lets an athlete move a single scheduled session to a different day of the
 * week — testing feedback: there was no way to do this at all before, only
 * to log a session as "skipped: schedule conflict" and lose it. This only
 * ever changes scheduled_sessions.date; the prescribed exercises, week
 * number, and phase assignment travel with it unchanged. Blocked once the
 * session has already been logged (reschedule a day you haven't done yet,
 * not rewrite history) and when the target date collides with another of
 * this athlete's sessions (scheduled_sessions has a unique (athlete_id,
 * date) constraint) or falls outside this phase's own date range.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();

  const sessionId = params.id;
  const body = await req.json();
  const { date } = body as { date?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_sessions")
    .select("id, athlete_id, date, phase_id")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.athlete_id !== sessionAthleteId) return forbidden();

  if (date === session.date) {
    return NextResponse.json({ error: "That's already this session's date." }, { status: 400 });
  }

  const shiftDays = Math.abs(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${session.date}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (shiftDays > MAX_SHIFT_DAYS) {
    return NextResponse.json(
      {
        error: `You can only move a workout up to ${MAX_SHIFT_DAYS} days from its scheduled date. For a bigger change, ask your coach.`,
      },
      { status: 400 }
    );
  }

  const { data: phase } = await supabase
    .from("macrocycle_phases")
    .select("start_date, end_date")
    .eq("id", session.phase_id)
    .maybeSingle();
  if (phase && (date < phase.start_date || date > phase.end_date)) {
    return NextResponse.json(
      { error: "That date falls outside this workout's phase — ask your coach about moving it that far." },
      { status: 400 }
    );
  }

  const { data: existingLog } = await supabase
    .from("session_logs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existingLog) {
    return NextResponse.json(
      { error: "This workout is already logged — only an upcoming, unlogged workout can be moved." },
      { status: 400 }
    );
  }

  const { data: conflict } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("athlete_id", sessionAthleteId)
    .eq("date", date)
    .maybeSingle();
  if (conflict) {
    return NextResponse.json(
      { error: "You already have a workout scheduled that day — move or log that one first." },
      { status: 409 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("scheduled_sessions")
    .update({ date })
    .eq("id", sessionId)
    .select("id, date, day_label, week_number")
    .single();
  if (updateError) return dbError("sessions/[id]/reschedule", updateError);

  return NextResponse.json({ session: updated });
}
