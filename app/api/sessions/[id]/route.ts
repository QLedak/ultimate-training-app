import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { deriveLoggingTier } from "@/lib/training/logging-tier";
import { parsePrescribedWeightHint } from "@/lib/pps/parse-prescription";
import { humanizeExerciseId, isSupersetLabel } from "@/lib/training/display-labels";
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
            .select("exercise_id, exercise_name, cue, movement_pattern, injury_considerations, equipment_needed, equipment_all")
            .in("exercise_id", exerciseIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("scheduled_sessions")
        .select("id, date")
        .eq("athlete_id", session.athlete_id)
        .neq("id", sessionId),
    ]);

  // Active injuries (for the "still bothering you?" nudge on exercises tied to one).
  const { data: injuryState } = await supabase
    .from("current_athlete_state")
    .select("current_active_injuries")
    .eq("athlete_id", session.athlete_id)
    .maybeSingle();
  const activeInjuryLocations = (
    ((injuryState?.current_active_injuries as Array<{ location: string; pending_resolution?: unknown }>) ?? [])
      .filter((i) => !i.pending_resolution)
      .map((i) => i.location)
  );

  if (logError) return dbError("sessions/[id]", logError);
  if (exercisesError) return dbError("sessions/[id]", exercisesError);
  if (libraryError) return dbError("sessions/[id]", libraryError);
  if (otherSessionsError) return dbError("sessions/[id]", otherSessionsError);

  const libraryByExerciseId = new Map((libraryRows ?? []).map((r) => [r.exercise_id, r]));
  const loggedByExerciseId = new Map((loggedExercises ?? []).map((e) => [e.exercise_id, e]));

  // "Swap this for something else" dropdown: every other exercise sharing
  // the SAME movement_pattern tag (e.g. "Upper Push" covers barbell bench,
  // DB bench, incline DB press, cable chest press, etc.) — coarse-grained
  // but data-driven, and it's exactly what keeps a bench press swap landing
  // on another press instead of a pullup or a squat. Deliberately NOT
  // filtered by the athlete's saved equipment profile here: the whole point
  // is "I'm at a different gym / don't have what's normally prescribed
  // today," so every pattern-matched alternative is offered regardless of
  // what's on file, and the athlete picks whatever they actually have access
  // to right now.
  const patterns = Array.from(
    new Set((libraryRows ?? []).map((r) => r.movement_pattern).filter((p): p is string => !!p))
  );
  const { data: alternativeRows, error: alternativesError } = patterns.length
    ? await supabase
        .from("exercise_library")
        .select("exercise_id, exercise_name, movement_pattern, equipment_needed, equipment_all")
        .in("movement_pattern", patterns)
        .eq("is_active", true) // retired exercises are never offered as a swap
    : { data: [], error: null };
  if (alternativesError) return dbError("sessions/[id]", alternativesError);

  // True when the movement is loaded with dumbbells — drives the "enter the
  // weight PER dumbbell" hint in the logging UI.
  const usesDumbbells = (row: { equipment_needed?: unknown; equipment_all?: unknown }) =>
    [row.equipment_needed, row.equipment_all].some((v) => Array.isArray(v) && v.includes("dumbbells"));

  const alternativesByPattern = new Map<
    string,
    Array<{ exercise_id: string; exercise_name: string; uses_dumbbells: boolean }>
  >();
  for (const row of alternativeRows ?? []) {
    const pattern = row.movement_pattern as string;
    const list = alternativesByPattern.get(pattern) ?? [];
    list.push({
      exercise_id: row.exercise_id as string,
      exercise_name: row.exercise_name as string,
      uses_dumbbells: usesDumbbells(row),
    });
    alternativesByPattern.set(pattern, list);
  }
  for (const list of alternativesByPattern.values()) {
    list.sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
  }

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
    // Ramping warmup sets for this lift, if the Phase Builder attached any —
    // attached metadata on THIS SAME prescribed-exercise entry, never a
    // separate exercises[] row, so it can't collide with the per-exercise_id
    // state keying the logging UI and weight-history reads depend on. Purely
    // informational/display: the athlete never logs these to the database.
    const warmup = Array.isArray(prescribed.warmup)
      ? (prescribed.warmup as Array<{ sets_reps: string; suggested_weight: number }>)
      : [];
    const logged = loggedByExerciseId.get(exerciseId) ?? null;
    const lastTime = lastTimeByExerciseId.get(exerciseId) ?? null;

    return {
      exercise_id: exerciseId,
      exercise_name: libraryRow?.exercise_name ?? humanizeExerciseId(exerciseId),
      cue: libraryRow?.cue ?? null,
      tier,
      uses_dumbbells: libraryRow ? usesDumbbells(libraryRow) : false,
      // Active injury areas this exercise is tagged for — the logging page asks
      // "still bothering you?" so an athlete never stays on isometrics by accident.
      active_injury_locations: ((libraryRow?.injury_considerations as string[] | undefined) ?? []).filter((loc) =>
        activeInjuryLocations.includes(loc)
      ),
      warmup,
      // Only a real A1/A2-style superset code is shown/grouped on — see
      // lib/training/display-labels.ts for why this guard exists.
      circuit_label: isSupersetLabel(prescribed.circuit_label) ? (prescribed.circuit_label as string).trim() : null,
      prescribed_target: prescribed.sets_reps ?? null,
      prescribed_weight_hint:
        tier !== 3
          ? typeof prescribed.sets_reps === "string"
            ? parsePrescribedWeightHint(prescribed.sets_reps)
            : null
          : null,
      tempo: prescribed.tempo ?? null,
      rest: prescribed.rest ?? null,
      coach_notes: prescribed.notes ?? null,
      alternatives: libraryRow?.movement_pattern
        ? (alternativesByPattern.get(libraryRow.movement_pattern as string) ?? []).filter(
            (alt) => alt.exercise_id !== exerciseId
          )
        : [],
      logged,
      last_time: lastTime
        ? {
            weight_used: lastTime.weight_used,
            reps_completed: lastTime.reps_completed,
            load_descriptor: lastTime.load_descriptor,
            notes: (lastTime.notes as string | null) ?? null,
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
