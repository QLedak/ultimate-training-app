import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { materializeMacrocycleSkeleton, materializeScheduledSessions, buildCorpusSituationTags } from "@/lib/review/materialize";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";

/**
 * POST /api/drafts/[id]/approve
 * Body: { publish_to_athlete: boolean, add_to_corpus: boolean }
 *
 * Two separate approvals, one action (review-approval-flow-spec.md): the
 * coach answers "publish to the athlete?" and "add to the self-consistency
 * corpus?" independently. Must be acting on the LATEST version in the
 * lineage — approving a stale version would silently discard later edits.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { publish_to_athlete: publishToAthlete, add_to_corpus: addToCorpus } = await req.json();

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

  const { data: latestInLineage } = await supabase
    .from("program_drafts")
    .select("id, version")
    .eq("lineage_id", draft.lineage_id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (latestInLineage && latestInLineage.id !== draft.id) {
    return NextResponse.json(
      {
        error: `This is v${draft.version}, but v${latestInLineage.version} is the latest version in this lineage — approve that one instead.`,
      },
      { status: 409 }
    );
  }

  // Materialize FIRST, flip status to "approved" only once that succeeds —
  // otherwise a failed publish leaves the draft stuck marked "approved" with
  // nothing actually written, and no longer editable/rejectable since those
  // require pending_review.
  let materialized: Record<string, unknown> = {};
  if (publishToAthlete) {
    try {
      materialized =
        draft.call_type === "macrocycle_planner"
          ? await materializeMacrocycleSkeleton(supabase, draft)
          : await materializeScheduledSessions(supabase, draft);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            `Publishing to the athlete failed, so nothing was changed — draft is still ` +
            `pending_review: ` +
            (err instanceof Error ? err.message : "unknown error"),
        },
        { status: 500 }
      );
    }
  }

  if (addToCorpus) {
    try {
      const situationTags = await buildCorpusSituationTags(supabase, draft);
      const { error: corpusError } = await supabase.from("corpus_entries").insert({
        source_draft_id: draft.id,
        call_type: draft.call_type,
        situation_tags: situationTags,
      });
      if (corpusError) throw new Error(corpusError.message);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            `Adding to the corpus failed before the draft was marked approved (any publish above ` +
            `already happened and is NOT rolled back): ` +
            (err instanceof Error ? err.message : "unknown error"),
        },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("program_drafts")
    .update({
      status: "approved",
      publish_to_athlete: !!publishToAthlete,
      add_to_corpus: !!addToCorpus,
    })
    .eq("id", draft.id);
  if (updateError) {
    return NextResponse.json(
      {
        error:
          `Publishing/corpus succeeded, but saving the draft's approved status failed — the ` +
          `data is live but this draft will incorrectly still show as pending: ` +
          updateError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    draft: { ...draft, status: "approved", publish_to_athlete: !!publishToAthlete, add_to_corpus: !!addToCorpus },
    materialized,
  });
}
