import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/drafts/[id]
 *
 * Full detail for the review screen: the draft itself, every other version
 * in its lineage (for the collapsed "version history" list), and the
 * lineage's unified ReviewThread (chat + direct_override entries, in order).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const supabase = getSupabaseAdmin();

  const { data: draft, error: draftError } = await supabase
    .from("program_drafts")
    .select("*, athletes(email, name)")
    .eq("id", params.id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const [{ data: versions, error: versionsError }, { data: thread, error: threadError }] = await Promise.all([
    supabase
      .from("program_drafts")
      .select("id, version, parent_version, edit_source, edit_request, status, created_at")
      .eq("lineage_id", draft.lineage_id)
      .order("version", { ascending: true }),
    supabase
      .from("review_thread_entries")
      .select("*")
      .eq("lineage_id", draft.lineage_id)
      .order("created_at", { ascending: true }),
  ]);

  if (versionsError) return dbError("drafts/[id]", versionsError);
  if (threadError) return dbError("drafts/[id]", threadError);

  // Phase Builder output only carries exercise_id (see corpus-retrieval-spec.md
  // / the AI's own output format) -- the review screen wants the human-readable
  // name alongside it, so look those up here rather than making the coach
  // cross-reference the Exercise Library by hand.
  let exerciseNames: Record<string, string> = {};
  if (draft.call_type === "phase_builder") {
    const weeks = ((draft.output as Record<string, unknown>)?.weeks ?? []) as Array<{
      days: Array<{ exercises: Array<{ exercise_id?: string }> }>;
    }>;
    const exerciseIds = Array.from(
      new Set(
        weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exercise_id).filter(Boolean)))
      )
    ) as string[];

    if (exerciseIds.length) {
      const { data: libraryRows, error: libraryError } = await supabase
        .from("exercise_library")
        .select("exercise_id, exercise_name")
        .in("exercise_id", exerciseIds);
      if (libraryError) return dbError("drafts/[id]", libraryError);
      exerciseNames = Object.fromEntries((libraryRows ?? []).map((r) => [r.exercise_id, r.exercise_name]));
    }
  }

  return NextResponse.json({ draft, versions, thread, exerciseNames });
}
