import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { generateMacrocycleDraft } from "@/lib/generation/macrocycle";
import { generatePhaseDraft } from "@/lib/generation/phase";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * POST /api/drafts/[id]/reject
 * Body: { regenerate?: boolean }  (defaults to true)
 *
 * "Reject & Discard" (review-approval-flow-spec.md): different from an edit
 * — throws out the draft lineage entirely (kept, status=rejected, never
 * deleted) and, unless regenerate=false, re-runs the originating call fresh
 * as a brand NEW lineage (version 1, no parent), for when the draft's basic
 * assumptions were wrong rather than a detail worth patching.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const body = await req.json().catch(() => ({}));
  const regenerate = body.regenerate ?? true;

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
      { error: `Draft is ${draft.status}, not pending_review.` },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("program_drafts")
    .update({ status: "rejected" })
    .eq("id", draft.id);
  if (updateError) {
    return dbError("drafts/[id]/reject", updateError);
  }

  if (!regenerate) {
    return NextResponse.json({ rejectedDraft: { ...draft, status: "rejected" }, newDraft: null });
  }

  let newDraft;
  try {
    if (draft.call_type === "macrocycle_planner") {
      const inputSnapshot = draft.input_snapshot as { is_rebuild: boolean; rebuild_reason: string | null };
      newDraft = await generateMacrocycleDraft(supabase, {
        athleteId: draft.athlete_id,
        isRebuild: inputSnapshot.is_rebuild,
        rebuildReason: inputSnapshot.rebuild_reason ?? undefined,
      });
    } else {
      newDraft = await generatePhaseDraft(supabase, {
        athleteId: draft.athlete_id,
        phaseId: draft.phase_id,
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        rejectedDraft: { ...draft, status: "rejected" },
        newDraft: null,
        regenerateError: err instanceof Error ? err.message : "Regeneration failed",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ rejectedDraft: { ...draft, status: "rejected" }, newDraft });
}
