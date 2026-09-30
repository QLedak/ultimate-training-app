import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, getSessionCoachId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/program
 *
 * The season-at-a-glance: the active MacrocycleSkeleton's phases
 * (data-architecture-spec.md — the skeleton IS the latest approved
 * macrocycle_planner draft, materialized), plus the season calendar
 * (season dates, tournament weekends) from the intake record, so an athlete
 * can see where they are in the season without asking their coach — and,
 * since this is a single-coach app with no per-athlete assignment, any
 * signed-in coach can read the same thing for any athlete (the "current
 * program" view on the coach dashboard). Also returns the draft ids behind
 * the active skeleton and active phase (both already-APPROVED drafts, per
 * how is_active/status get set at approval), so a coach viewing this can
 * jump straight to the full read-only draft detail on /review/[id] instead
 * of hunting through the review queue's status filter for it.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  const sessionCoachId = sessionAthleteId ? null : await getSessionCoachId();
  if (!sessionAthleteId && !sessionCoachId) return unauthorized();
  if (sessionAthleteId && sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const supabase = getSupabaseAdmin();

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("id, created_at, source_draft_id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) return dbError("athletes/[id]/program", skeletonError);

  if (!skeleton) {
    return NextResponse.json({
      skeleton: null,
      phases: [],
      tournament_weekends: [],
      season: null,
      skeleton_draft_id: null,
      active_phase_draft_id: null,
    });
  }

  const [{ data: phases, error: phasesError }, { data: intake, error: intakeError }] = await Promise.all([
    supabase
      .from("macrocycle_phases")
      .select("*")
      .eq("skeleton_id", skeleton.id)
      .order("phase_number", { ascending: true }),
    supabase
      .from("athlete_intake")
      .select("season_start, season_end, tournament_weekends, season_calendar_confirmed")
      .eq("athlete_id", athleteId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (phasesError) return dbError("athletes/[id]/program", phasesError);
  if (intakeError) return dbError("athletes/[id]/program", intakeError);

  const activePhase = (phases ?? []).find((p) => p.status === "active") ?? null;

  let activePhaseDraftId: string | null = null;
  if (activePhase) {
    const { data: latestApprovedPhaseDraft } = await supabase
      .from("program_drafts")
      .select("id")
      .eq("phase_id", activePhase.id)
      .eq("call_type", "phase_builder")
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    activePhaseDraftId = latestApprovedPhaseDraft?.id ?? null;
  }

  return NextResponse.json({
    skeleton,
    phases: phases ?? [],
    tournament_weekends: intake?.tournament_weekends ?? [],
    season: intake
      ? {
          start: intake.season_start,
          end: intake.season_end,
          confirmed: intake.season_calendar_confirmed,
        }
      : null,
    skeleton_draft_id: skeleton.source_draft_id ?? null,
    active_phase_draft_id: activePhaseDraftId,
  });
}
