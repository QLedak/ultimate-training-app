import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { deriveLoggingTier } from "@/lib/training/logging-tier";
import { parsePrescribedWeightHint } from "@/lib/pps/parse-prescription";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/sessions/[id]
 *
 * Full detail for the logging screen: the prescribed program for this day
 * (snapshotted at publish time, per workout-logging-schema-spec.md), each
 * exercise's logging tier + display info from the Exercise Library, any
 * existing log for this session (so re-opening an already-logged day shows
 * what was entered), and — per the spec's "referring back" behavior — each
 * exercise's most recent PRIOR logged result for this athlete, so the UI
 * can pre-fill weight/reps/load_descriptor the way the athlete's real
 * tracker already did.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== session.athlete_id) return forbidden();

  const prescribedExercises = (session.prescribed_exercises as Array<Record<string, unknown>>) ?? [];
  const exerciseIds = Array.from(new Set(prescribedExercises.map((e) => e.exercise_id as string)));

  const [{ data: sessionLog, error: logError }, { data: loggedExercises, error: exercisesError }, { data: libraryRows, error: libraryError }, { data: otherSessions, error: otherSessionsError }] =
    await Promise.all([
      supabase.from("session_logs").select("*").eq("session_id", sessionId).maybeSingle(),
      supabase.from("logged_exercises").select("*").eq("session_id", sessionId),
      exerciseIds.length
        ? supabase
            .from("exercise_library")
            .select("exercise_id, exercise_name, cue, movement_pattern, injury_considerations")
            .in("exercise_id", exerciseIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("scheduled_sessions")
        .select("id, date")
        .eq("athlete_id", session.athlete_id)
        .neq("id", sessionId),
    ]);

  if (logError) return dbError("sessions/[id]", logError);
  if (exercisesError) return dbError("sessions/[id]", exercisesError);
  if (libraryError) return dbError("sessions/[id]", libraryError);
  if (otherSessionsError) return dbError("sessions/[id]", otherSessionsError);

  const libraryByExerciseId = new Map((libraryRows ?? []).map((r) => [r.exercise_id, r]));
  const loggedByExerciseId = new Map((loggedExercises ?? []).map((e) => [e.exercise_id, e]));

  // "Last time" pre-fill: most recent OTHER session's logged_exercises row
  // per exercise_id, regardless of how long ago (spec: "regardless of how
  // long ago it was last performed"). This is presentation-only pre-fill,
  // never re-derived into anything a rule reads.
  const otherSessionIds = (otherSessions ?? []).map((s) => s.id);
  const dateBySessionId = new Map((otherSessions ?? []).map((s) => [s.id, s.date as string]));

  const lastTimeByExerciseId = new Map<string, Record<string, unknown>>();
  if (otherSessionIds.length && exerciseIds.length) {
    const { data: priorLogged, error: priorError } = await supabase
      .from("logged_exercises")
      .select("*")
      .in("session_id", otherSessionIds)
      .in("exercise_id", exerciseIds);
    if (priorError) return dbError("sessions/[id]", priorError);

    for (const row of priorLogged ?? []) {
      const date = dateBySessionId.get(row.session_id) ?? "";
      const existing = lastTimeByExerciseId.get(row.exercise_id);
      const existingDate = existing ? (dateBySessionId.get(existing.session_id as string) ?? "") : "";
      if (!existing || date > existingDate) {
        lastTimeByExerciseId.set(row.exercise_id, row);
      }
    }
  }

  const exercises = prescribedExercises.map((prescribed) => {
    const exerciseId = prescribed.exercise_id as string;
    const libraryRow = libraryByExerciseId.get(exerciseId);
    const tier = deriveLoggingTier({
      movement_pattern: libraryRow?.movement_pattern ?? null,
      injury_considerations: (libraryRow?.injury_considerations as string[] | undefined) ?? null,
    });
    const logged = loggedByExerciseId.get(exerciseId) ?? null;
    const lastTime = lastTimeByExerciseId.get(exerciseId) ?? null;

    return {
      exercise_id: exerciseId,
      exercise_name: libraryRow?.exercise_name ?? exerciseId,
      cue: libraryRow?.cue ?? null,
      tier,
      circuit_label: prescribed.circuit_label ?? null,
      prescribed_target: prescribed.sets_reps ?? null,
      prescribed_weight_hint:
        tier !== 3 && typeof prescribed.sets_reps === "string"
          ? parsePrescribedWeightHint(prescribed.sets_reps)
          : null,
      tempo: prescribed.tempo ?? null,
      rest: prescribed.rest ?? null,
      coach_notes: prescribed.notes ?? null,
      logged,
      last_time: lastTime
        ? {
            weight_used: lastTime.weight_used,
            reps_completed: lastTime.reps_completed,
            load_descriptor: lastTime.load_descriptor,
            date: dateBySessionId.get(lastTime.session_id as string) ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({
    session: {
      id: session.id,
      date: session.date,
      phase_id: session.phase_id,
      week_number: session.week_number,
      day_label: session.day_label,
      week_type: session.week_type,
    },
    session_log: sessionLog ?? null,
    exercises,
  });
}
