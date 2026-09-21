import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { reviseMacrocyclePlannerDraft } from "@/lib/generation/macrocycle";
import { revisePhaseBuilderDraft } from "@/lib/generation/phase";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * POST /api/drafts/[id]/chat-edit
 * Body: { message: string }
 *
 * The "chat edit" path (review-approval-flow-spec.md): re-runs the
 * originating call with the full original context PLUS the current draft
 * PLUS the coach's message, producing a brand new full draft version (not a
 * patch) in the same lineage. Logs both the coach's message and the model's
 * rationale as ReviewThread entries.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { message } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
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

  let newDraft;
  try {
    newDraft =
      draft.call_type === "macrocycle_planner"
        ? await reviseMacrocyclePlannerDraft(supabase, draft, message)
        : await revisePhaseBuilderDraft(supabase, draft, message);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 502 }
    );
  }

  const modelSummary =
    (newDraft.output as { rationale?: string }).rationale ??
    "(revised draft — see updated output)";

  const { error: threadError } = await supabase.from("review_thread_entries").insert([
    {
      lineage_id: draft.lineage_id,
      entry_type: "chat",
      role: "coach",
      text: message,
      resulting_version: newDraft.version,
    },
    {
      lineage_id: draft.lineage_id,
      entry_type: "chat",
      role: "model",
      text: modelSummary,
      resulting_version: newDraft.version,
    },
  ]);
  if (threadError) {
    return dbError("drafts/[id]/chat-edit", threadError);
  }

  return NextResponse.json({ draft: newDraft });
}
