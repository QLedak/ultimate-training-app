import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/program
 *
 * The athlete's season-at-a-glance: their active MacrocycleSkeleton's
 * phases (data-architecture-spec.md — the skeleton IS the latest approved
 * macrocycle_planner draft, materialized), plus the season calendar
 * (season dates, tournament weekends) from their intake record, so an
 * athlete can see where they are in the season without asking their coach.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const supabase = getSupabaseAdmin();

  const { data: skeleton, error: skeletonError } = await supabase
    .from("macrocycle_skeletons")
    .select("id, created_at")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();
  if (skeletonError) return dbError("athletes/[id]/program", skeletonError);

  if (!skeleton) {
    return NextResponse.json({ skeleton: null, phases: [], tournament_weekends: [], season: null });
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
  });
}
