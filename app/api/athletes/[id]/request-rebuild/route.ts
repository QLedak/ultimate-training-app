import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { compilePhasePerformanceSummary } from "@/lib/pps/compile";
import { generatePhaseRebuildDraft } from "@/lib/generation/phase";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

const REASON_CATEGORIES = ["schedule_change", "injury_pain", "other"] as const;
type ReasonCategory = (typeof REASON_CATEGORIES)[number];

/**
 * POST /api/athletes/[id]/request-rebuild
 * Body: { reason_category: "schedule_change" | "injury_pain" | "other", detail: string }
 *
 * The athlete-initiated rebuild entry point (data-architecture-spec.md step
 * 7 (b)/(c) — "athlete-initiated rebuild, not real-time coach gatekeeping").
 * Compiles a PhasePerformanceSummary for the athlete's current phase,
 * flagged with the rebuild reason, from whatever's been logged so far.
 *
 * - schedule_change maps to a SKELETON-scoped rebuild (days/week or major
 *   calendar change) — per the spec this means the Macrocycle Planner
 *   re-fires first, producing a new skeleton version that preserves past/
 *   completed phases and updates current/future ones. That splice logic
 *   isn't implemented yet (see the response's `needs_coach_action` note) —
 *   this compiles the interruption summary and stops there, for the coach
 *   to re-run the Macrocycle Planner manually via the review flow.
 * - injury_pain / other map to a PHASE-scoped rebuild — this fully
 *   automates re-firing Phase Builder for the remaining weeks of the
 *   current phase, producing a new draft version for the coach to review.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const body = await req.json();
  const { reason_category, detail } = body as { reason_category: ReasonCategory; detail?: string };

  if (!REASON_CATEGORIES.includes(reason_category)) {
    return NextResponse.json(
      { error: `reason_category must be one of ${REASON_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) return dbError("athletes/[id]/request-rebuild", skeletonError);
  if (!skeleton) {
    return NextResponse.json({ error: "No active season plan found for this athlete yet." }, { status: 404 });
  }

  const { data: activePhase, error: phaseError } = await supabase
    .from("macrocycle_phases")
    .select("id")
    .eq("skeleton_id", skeleton.id)
    .eq("status", "active")
    .maybeSingle();
  if (phaseError) return dbError("athletes/[id]/request-rebuild", phaseError);
  if (!activePhase) {
    return NextResponse.json({ error: "No active phase found for this athlete right now." }, { status: 404 });
  }

  const isSkeletonScoped = reason_category === "schedule_change";
  const ppsReason = isSkeletonScoped ? "rebuild_skeleton_scoped" : "rebuild_phase_scoped";

  try {
    const { summary } = await compilePhasePerformanceSummary(supabase, {
      phaseId: activePhase.id,
      reason: ppsReason,
      reasonDetail: detail,
    });

    if (isSkeletonScoped) {
      return NextResponse.json({
        summary,
        needs_coach_action: true,
        message:
          "Your coach will review this schedule change and rebuild your season plan — you'll see the update once it's approved.",
      });
    }

    const draft = await generatePhaseRebuildDraft(supabase, {
      athleteId,
      phaseId: activePhase.id,
      reason: ppsReason,
      reasonDetail: detail,
    });

    return NextResponse.json({
      summary,
      draft,
      message: "Your coach has an updated plan to review — you'll see the change once it's approved.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rebuild request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
