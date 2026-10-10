import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, getSessionCoachId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { humanizeExerciseId } from "@/lib/training/display-labels";
import { buildEntries, effectiveExerciseId, summarize, type HistoryRow } from "@/lib/training/history";
import { fetchHistoryRows } from "@/lib/training/history-fetch";

/**
 * GET /api/athletes/[id]/exercise-history
 *
 * Every exercise this athlete has logged a weight for, with its best
 * estimated 1RM and most recent date - the Progress tab's list. The athlete
 * sees only their own; a coach can read any athlete's.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  const sessionCoachId = sessionAthleteId ? null : await getSessionCoachId();
  if (!sessionAthleteId && !sessionCoachId) return unauthorized();
  if (sessionAthleteId && sessionAthleteId !== params.id) return forbidden();

  const { rows, error } = await fetchHistoryRows(params.id);
  if (error) return dbError("athletes/[id]/exercise-history", error);

  const byExercise = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const id = effectiveExerciseId(r);
    const list = byExercise.get(id) ?? [];
    list.push(r);
    byExercise.set(id, list);
  }

  const ids = Array.from(byExercise.keys());
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: lib, error: libError } = await getSupabaseAdmin()
      .from("exercise_library")
      .select("exercise_id, exercise_name")
      .in("exercise_id", ids);
    if (libError) return dbError("athletes/[id]/exercise-history", libError);
    for (const l of lib ?? []) if (!names.has(l.exercise_id)) names.set(l.exercise_id, l.exercise_name);
  }

  const exercises = ids
    .map((id) => {
      const entries = buildEntries(byExercise.get(id)!);
      const summary = summarize(entries);
      return {
        exercise_id: id,
        exercise_name: names.get(id) ?? humanizeExerciseId(id),
        times_logged: entries.length,
        last_date: entries.length ? entries[entries.length - 1].date : null,
        best_est_1rm: summary.best_est_1rm?.value ?? null,
        heaviest_weight: summary.heaviest?.weight ?? null,
      };
    })
    // Only things with a load make a useful progress chart.
    .filter((e) => e.heaviest_weight != null && e.times_logged > 0)
    .sort((a, b) => (a.last_date! < b.last_date! ? 1 : a.last_date! > b.last_date! ? -1 : a.exercise_name.localeCompare(b.exercise_name)));

  return NextResponse.json({ exercises });
}
