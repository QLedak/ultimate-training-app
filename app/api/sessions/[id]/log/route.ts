import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { epley1RM } from "@/lib/training/epley";
import { deriveLoggingTier } from "@/lib/training/logging-tier";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

const VALID_STATUSES = ["completed", "partially_completed", "skipped"];
const VALID_SKIP_REASONS = ["pain_injury", "schedule_conflict", "illness", "no_equipment", "other"];

type ExerciseInput = {
  exercise_id: string;
  substituted_exercise_id?: string | null;
  substitution_reason?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  sets_completed?: number | null;
  rir?: number | null;
  load_descriptor?: string | null;
  notes?: string | null;
  is_true_max?: boolean; // test weeks only — also writes a testing_day_results row
};

/**
 * POST /api/sessions/[id]/log
 * Body: {
 *   status: "completed" | "partially_completed" | "skipped",
 *   skip_reason?, skip_reason_other_text?, overall_notes?,
 *   exercises?: ExerciseInput[]
 * }
 *
 * Writes/updates the SessionLog for this day, and one LoggedExercise row per
 * exercise the athlete actually reported on (untouched prescribed exercises
 * are left unlogged entirely, per the spec — a blank isn't "attempted and
 * failed"). Tier is derived server-side from the Exercise Library so the
 * client can't spoof a lighter logging requirement, and Tier 1 requires
 * weight/reps/RIR since two of the app's core rules (progression cap,
 * missed-load reduction) can't function without them.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const body = await req.json();
  const { status, skip_reason, skip_reason_other_text, overall_notes, exercises = [] } = body as {
    status: string;
    skip_reason?: string;
    skip_reason_other_text?: string;
    overall_notes?: string;
    exercises?: ExerciseInput[];
  };

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }
  if ((status === "skipped" || status === "partially_completed") && !skip_reason) {
    return NextResponse.json(
      { error: "skip_reason is required when the session was skipped or only partially completed." },
      { status: 400 }
    );
  }
  if (skip_reason && !VALID_SKIP_REASONS.includes(skip_reason)) {
    return NextResponse.json({ error: `skip_reason must be one of ${VALID_SKIP_REASONS.join(", ")}` }, { status: 400 });
  }
  if (skip_reason === "other" && !skip_reason_other_text) {
    return NextResponse.json({ error: "skip_reason_other_text is required when skip_reason is 'other'." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_sessions")
    .select("id, athlete_id, phase_id, week_type")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== session.athlete_id) return forbidden();

  // A skipped session needs no exercise-level logs at all.
  const exercisesToLog = status === "skipped" ? [] : exercises;

  // Look up tiers for every exercise actually being logged (using the
  // substituted exercise's own tagging when one was performed instead).
  const lookupIds = Array.from(
    new Set(exercisesToLog.map((e) => e.substituted_exercise_id || e.exercise_id))
  );
  const { data: libraryRows, error: libraryError } = lookupIds.length
    ? await supabase
        .from("exercise_library")
        .select("exercise_id, movement_pattern, injury_considerations")
        .in("exercise_id", lookupIds)
    : { data: [], error: null };
  if (libraryError) {
    return dbError("sessions/[id]/log", libraryError);
  }
  const libraryByExerciseId = new Map((libraryRows ?? []).map((r) => [r.exercise_id, r]));

  const rows: Record<string, unknown>[] = [];
  const testingResultRows: Record<string, unknown>[] = [];

  for (const ex of exercisesToLog) {
    if (!ex.exercise_id) {
      return NextResponse.json({ error: "Each logged exercise needs an exercise_id." }, { status: 400 });
    }
    const lookupId = ex.substituted_exercise_id || ex.exercise_id;
    const libraryRow = libraryByExerciseId.get(lookupId);
    const tier = deriveLoggingTier({
      movement_pattern: libraryRow?.movement_pattern ?? null,
      injury_considerations: (libraryRow?.injury_considerations as string[] | undefined) ?? null,
    });

    if (ex.substituted_exercise_id && !ex.substitution_reason) {
      return NextResponse.json(
        { error: `A substitution reason is required for ${ex.exercise_id} (substituted).` },
        { status: 400 }
      );
    }

    if (tier === 1) {
      if (ex.weight_used == null || ex.reps_completed == null || ex.rir == null) {
        return NextResponse.json(
          {
            error: `${ex.exercise_id} is a Tier 1 lift — weight used, reps completed, and RIR are all required.`,
          },
          { status: 400 }
        );
      }
    }

    const estOneRm =
      ex.weight_used != null && ex.reps_completed != null ? epley1RM(ex.weight_used, ex.reps_completed) : null;

    rows.push({
      session_id: sessionId,
      exercise_id: ex.exercise_id,
      tier,
      prescribed_target: "", // filled in below from the session's own snapshot
      substituted_exercise_id: ex.substituted_exercise_id || null,
      substitution_reason: ex.substitution_reason || null,
      weight_used: ex.weight_used ?? null,
      reps_completed: ex.reps_completed ?? null,
      sets_completed: ex.sets_completed ?? null,
      rir: ex.rir ?? null,
      est_1rm: estOneRm,
      load_descriptor: ex.load_descriptor || null,
      notes: ex.notes || null,
    });

    // Test weeks: a Tier 1 lift flagged as a true max/PR attempt also feeds
    // testing_day_results, which the Phase Performance Summary compile job
    // prefers over an Epley estimate whenever both exist.
    if (session.week_type === "test" && tier === 1 && ex.is_true_max && ex.weight_used != null) {
      testingResultRows.push({
        athlete_id: null, // filled in below once we have it
        phase_id: session.phase_id,
        exercise_id: lookupId,
        result_weight: ex.weight_used,
        result_reps: ex.reps_completed ?? null,
        is_true_max: true,
      });
    }
  }

  // prescribed_target must match what was actually prescribed for this
  // exercise on this day (kept alongside the result so "missed vs. hit" is a
  // direct comparison, not a re-derivation) — pull it from the session's own
  // snapshot rather than trusting the client to echo it back correctly.
  const { data: fullSession } = await supabase
    .from("scheduled_sessions")
    .select("athlete_id, prescribed_exercises")
    .eq("id", sessionId)
    .single();
  const prescribedById = new Map(
    ((fullSession?.prescribed_exercises as Array<Record<string, unknown>>) ?? []).map((p) => [
      p.exercise_id as string,
      (p.sets_reps as string) ?? "",
    ])
  );
  for (const row of rows) {
    row.prescribed_target = prescribedById.get(row.exercise_id as string) ?? "";
  }
  for (const row of testingResultRows) {
    row.athlete_id = fullSession?.athlete_id ?? null;
  }

  // ---- Clear out any previously-logged exercise that isn't in THIS
  // submission anymore (e.g. the athlete cleared a Tier 1 lift's fields, or
  // unchecked a Tier 3 "completed" box, then saved) — a save always
  // replaces the full logged set for this session, it never just adds to
  // it, so an exercise the athlete backs out of doesn't linger in the DB. ----
  const submittedExerciseIds = new Set(rows.map((r) => r.exercise_id as string));
  const { data: existingLogged, error: existingLoggedError } = await supabase
    .from("logged_exercises")
    .select("exercise_id")
    .eq("session_id", sessionId);
  if (existingLoggedError) {
    return dbError("sessions/[id]/log", existingLoggedError);
  }
  const staleExerciseIds = (existingLogged ?? [])
    .map((r) => r.exercise_id as string)
    .filter((id) => !submittedExerciseIds.has(id));
  if (staleExerciseIds.length > 0) {
    const { error: deleteStaleError } = await supabase
      .from("logged_exercises")
      .delete()
      .eq("session_id", sessionId)
      .in("exercise_id", staleExerciseIds);
    if (deleteStaleError) {
      return dbError("sessions/[id]/log", deleteStaleError);
    }
  }

  // ---- Write everything ----
  const { error: logUpsertError } = await supabase.from("session_logs").upsert(
    {
      session_id: sessionId,
      status,
      skip_reason: skip_reason || null,
      skip_reason_other_text: skip_reason_other_text || null,
      overall_notes: overall_notes || null,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
  if (logUpsertError) {
    return dbError("sessions/[id]/log", logUpsertError);
  }

  if (rows.length > 0) {
    const { error: exercisesUpsertError } = await supabase
      .from("logged_exercises")
      .upsert(rows, { onConflict: "session_id,exercise_id" });
    if (exercisesUpsertError) {
      return dbError("sessions/[id]/log", exercisesUpsertError);
    }
  }

  if (testingResultRows.length > 0) {
    const { error: testingInsertError } = await supabase.from("testing_day_results").insert(testingResultRows);
    if (testingInsertError) {
      return dbError("sessions/[id]/log", testingInsertError);
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/sessions/[id]/log?exerciseId=...
 *
 * Removes a single exercise's logged result from this session, immediately
 * (no need to touch the rest of the day's log) — for when an athlete logged
 * something by mistake, or wants to back out of a substitution/entry
 * without re-entering everything else.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const { searchParams } = new URL(req.url);
  const exerciseId = searchParams.get("exerciseId");

  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId query param is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("scheduled_sessions")
    .select("athlete_id")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== session.athlete_id) return forbidden();

  const { error } = await supabase
    .from("logged_exercises")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  if (error) {
    return dbError("sessions/[id]/log", error);
  }

  return NextResponse.json({ success: true });
}
