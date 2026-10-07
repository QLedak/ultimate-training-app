import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";
import { generateNextSeasonDraft } from "@/lib/generation/macrocycle";
import { getSeasonState } from "@/lib/seasons/state";

export const maxDuration = 60;

/**
 * POST /api/coach/athletes/[id]/next-season-plan
 *
 * Manual trigger for the next-season Macrocycle Planner draft — for when the
 * automatic draft failed, was rejected, or went stale. Requires the athlete to
 * have entered next-season dates (a `planned` season); it never invents dates.
 * Any still-pending draft for that season is rejected first so only one is live.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const supabase = getSupabaseAdmin();
  const state = await getSeasonState(supabase, params.id);
  const planned = state.planned_season;
  if (!planned) {
    return NextResponse.json(
      { error: "This athlete hasn't entered next-season dates yet (they do that under \"Plan next season\")." },
      { status: 409 }
    );
  }
  if (planned.skeleton_id) {
    return NextResponse.json({ error: "That season's plan is already approved." }, { status: 409 });
  }

  const limited = await checkAiGenerationLimit(params.id);
  if (limited) return limited;

  await supabase
    .from("program_drafts")
    .update({ status: "rejected" })
    .eq("athlete_id", params.id)
    .eq("call_type", "macrocycle_planner")
    .eq("status", "pending_review")
    .eq("input_snapshot->>next_season_id", planned.id);

  try {
    const draft = await generateNextSeasonDraft(supabase, { athleteId: params.id, seasonId: planned.id });
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Next-season plan generation failed" },
      { status: 502 }
    );
  }
}
