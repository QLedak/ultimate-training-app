import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { HistoryRow } from "./history";

type Raw = {
  session_id: string;
  exercise_id: string;
  substituted_exercise_id: string | null;
  weight_used: number | null;
  reps_completed: number | null;
  sets_completed: number | null;
  rir: number | null;
  est_1rm: number | null;
  set_results: HistoryRow["set_results"];
  scheduled_sessions: { date: string; athlete_id: string } | { date: string; athlete_id: string }[] | null;
};

/** Safe-id check: exercise ids are codes like "SQ-001" and go into a filter string. */
export function isSafeExerciseId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/** Every logged row for an athlete (optionally one exercise, counting swaps), with its session date. */
export async function fetchHistoryRows(athleteId: string, exerciseId?: string): Promise<{ rows: HistoryRow[]; error: { message: string } | null }> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("logged_exercises")
    .select(
      "session_id, exercise_id, substituted_exercise_id, weight_used, reps_completed, sets_completed, rir, est_1rm, set_results, scheduled_sessions!inner(date, athlete_id)"
    )
    .eq("scheduled_sessions.athlete_id", athleteId);
  if (exerciseId) {
    q = q.or(`and(exercise_id.eq.${exerciseId},substituted_exercise_id.is.null),substituted_exercise_id.eq.${exerciseId}`);
  }
  const { data, error } = await q.limit(5000);
  if (error) return { rows: [], error };

  const rows: HistoryRow[] = [];
  for (const r of (data ?? []) as unknown as Raw[]) {
    const ss = Array.isArray(r.scheduled_sessions) ? r.scheduled_sessions[0] : r.scheduled_sessions;
    if (!ss) continue;
    rows.push({
      session_id: r.session_id,
      date: ss.date,
      exercise_id: r.exercise_id,
      substituted_exercise_id: r.substituted_exercise_id,
      weight_used: r.weight_used,
      reps_completed: r.reps_completed,
      sets_completed: r.sets_completed,
      rir: r.rir,
      est_1rm: r.est_1rm,
      set_results: r.set_results,
    });
  }
  return { rows, error: null };
}
