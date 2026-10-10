import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, getSessionCoachId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { humanizeExerciseId } from "@/lib/training/display-labels";
import { buildEntries, summarize } from "@/lib/training/history";
import { fetchHistoryRows, isSafeExerciseId } from "@/lib/training/history-fetch";

/**
 * GET /api/athletes/[id]/exercise-history/[exerciseId]
 *
 * One exercise's full history: a chart series (best estimated 1RM per
 * session), the per-session sets, and PRs. Sessions where the athlete swapped
 * in this exercise count toward it; sessions where they swapped it out do not.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string; exerciseId: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  const sessionCoachId = sessionAthleteId ? null : await getSessionCoachId();
  if (!sessionAthleteId && !sessionCoachId) return unauthorized();
  if (sessionAthleteId && sessionAthleteId !== params.id) return forbidden();

  const exerciseId = decodeURIComponent(params.exerciseId);
  if (!isSafeExerciseId(exerciseId)) return NextResponse.json({ error: "Invalid exercise id" }, { status: 400 });

  const { rows, error } = await fetchHistoryRows(params.id, exerciseId);
  if (error) return dbError("athletes/[id]/exercise-history/[exerciseId]", error);

  const { data: lib } = await getSupabaseAdmin()
    .from("exercise_library")
    .select("exercise_id, exercise_name")
    .eq("exercise_id", exerciseId)
    .limit(1);

  const entries = buildEntries(rows);
  return NextResponse.json({
    exercise_id: exerciseId,
    exercise_name: lib?.[0]?.exercise_name ?? humanizeExerciseId(exerciseId),
    summary: summarize(entries),
    // Newest first for the list; the chart reverses it.
    entries: entries.slice().reverse(),
  });
}
