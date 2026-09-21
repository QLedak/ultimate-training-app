import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getAtPath, setAtPath } from "@/lib/review/object-path";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * POST /api/drafts/[id]/direct-override
 * Body: { field_path: string, new_value: unknown }
 *
 * The "direct override" path (review-approval-flow-spec.md): a pure data
 * patch, no model call. field_path is dot-separated into the draft's output
 * JSON, array indices as plain numbers — e.g. "phases.2.week_count" or
 * "weeks.0.days.1.exercises.0.exercise_id".
 *
 * One lightweight validation only: if the path's final segment is
 * "exercise_id", warn (don't block) if that id isn't in the exercise
 * library at all — everything else is trusted as-is, since this path exists
 * to be fast.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { field_path: fieldPath, new_value: newValue } = await req.json();
  if (!fieldPath || typeof fieldPath !== "string") {
    return NextResponse.json({ error: "field_path is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: draft, error: draftError } = await supabase
    .from("program_drafts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (draft.status !== "pending_review") {
    return NextResponse.json(
      { error: `Draft is ${draft.status}, not pending_review — can't edit it.` },
      { status: 409 }
    );
  }

  let oldValue: unknown;
  const updatedOutput = JSON.parse(JSON.stringify(draft.output));
  try {
    oldValue = getAtPath(draft.output, fieldPath);
    setAtPath(updatedOutput, fieldPath, newValue);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid field_path" },
      { status: 400 }
    );
  }

  let warning: string | null = null;
  if (fieldPath.endsWith("exercise_id") && typeof newValue === "string") {
    const { data: exists } = await supabase
      .from("exercise_library")
      .select("exercise_id")
      .eq("exercise_id", newValue)
      .maybeSingle();
    if (!exists) {
      warning = `"${newValue}" was not found in the Exercise Library — saved anyway, but double-check the exercise_id.`;
    }
  }

  const { data: newDraft, error: newDraftError } = await supabase
    .from("program_drafts")
    .insert({
      lineage_id: draft.lineage_id,
      athlete_id: draft.athlete_id,
      call_type: draft.call_type,
      phase_id: draft.phase_id,
      version: draft.version + 1,
      parent_version: draft.version,
      status: "pending_review",
      input_snapshot: draft.input_snapshot,
      output: updatedOutput,
      edit_source: "direct_override",
      edit_request: { field_path: fieldPath, old_value: oldValue, new_value: newValue },
    })
    .select()
    .single();

  if (newDraftError) {
    return dbError("drafts/[id]/direct-override", newDraftError);
  }

  const { error: threadError } = await supabase.from("review_thread_entries").insert({
    lineage_id: draft.lineage_id,
    entry_type: "direct_override",
    field_path: fieldPath,
    old_value: oldValue,
    new_value: newValue,
    resulting_version: newDraft.version,
  });
  if (threadError) {
    return dbError("drafts/[id]/direct-override", threadError);
  }

  return NextResponse.json({ draft: newDraft, warning });
}
