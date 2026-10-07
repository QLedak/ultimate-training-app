import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { compilePhasePerformanceSummary } from "@/lib/pps/compile";
import { getSeasonState } from "@/lib/seasons/state";
import { isSeasonOver, validateSeasonCalendar } from "@/lib/seasons/calendar";

/**
 * GET/PATCH /api/athletes/[id]/schedule
 *
 * The real "add a tournament as it comes up" path that intake never had a
 * follow-up for — reads and updates the season calendar fields on the
 * athlete's most recent athlete_intake row directly (season dates, recurring
 * commitments, tournament weekends, including which one is flagged as this
 * season's priority/peak event via `is_priority` on a tournament_weekends
 * entry -- see system-prompt-v3.md's Macrocycle Planner rules for how that
 * flag is used).
 *
 * PATCH does NOT touch macrocycle_skeletons/phases itself -- if the athlete
 * already has an active plan, this only flags the change for the coach via
 * the same rebuild-request mechanism used elsewhere (compiling a
 * rebuild_skeleton_scoped PhasePerformanceSummary), consistent with keeping
 * anything that reshapes an active plan behind coach review for now.
 */

async function getLatestIntake(supabase: ReturnType<typeof getSupabaseAdmin>, athleteId: string) {
  const { data, error } = await supabase
    .from("athlete_intake")
    .select("id, season_start, season_end, recurring_commitments, tournament_weekends, season_calendar_confirmed")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  const { data: intake, error } = await getLatestIntake(supabase, params.id);
  if (error) return dbError("athletes/[id]/schedule", error);
  if (!intake) {
    return NextResponse.json({ error: "Complete intake first." }, { status: 404 });
  }

  const seasonState = await getSeasonState(supabase, params.id);
  return NextResponse.json({
    // True once the season on file has ended — the schedule screen then points the
    // athlete to "Plan next season" instead of letting them overwrite last season.
    season_over: seasonState.stage === "bridge" || isSeasonOver(intake.season_end as string | null),
    season_start: intake.season_start,
    season_end: intake.season_end,
    recurring_commitments: intake.recurring_commitments,
    tournament_weekends: intake.tournament_weekends,
    season_calendar_confirmed: intake.season_calendar_confirmed,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const athleteId = params.id;
  const body = await req.json();
  const {
    season_start,
    season_end,
    recurring_commitments,
    tournament_weekends,
    season_calendar_confirmed,
  } = body as {
    season_start?: string;
    season_end?: string;
    recurring_commitments?: unknown[];
    tournament_weekends?: unknown[];
    season_calendar_confirmed?: boolean;
  };

  const supabase = getSupabaseAdmin();
  const { data: intake, error: intakeError } = await getLatestIntake(supabase, athleteId);
  if (intakeError) return dbError("athletes/[id]/schedule", intakeError);
  if (!intake) {
    return NextResponse.json({ error: "Complete intake first." }, { status: 404 });
  }

  // This screen edits the season that's CURRENT. Once that season has ended (or the athlete is on
  // the off-season bridge), new dates belong to the NEXT season — never overwrite last season's.
  const seasonState = await getSeasonState(supabase, athleteId);
  if (seasonState.stage === "bridge" || isSeasonOver(intake.season_end as string | null)) {
    return NextResponse.json(
      {
        error:
          "Your last season has ended — use \"Plan next season\" to enter your new dates so your coach can build your next plan.",
        next_season_url: "/app/next-season",
      },
      { status: 409 }
    );
  }

  // Validate the calendar as it WOULD look after this edit (dates in order, tournaments inside
  // the season, one priority event max).
  const invalid = validateSeasonCalendar({
    season_start: season_start ?? (intake.season_start as string | null),
    season_end: season_end ?? (intake.season_end as string | null),
    tournament_weekends: tournament_weekends ?? (intake.tournament_weekends as unknown[]),
  });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (season_start !== undefined) updates.season_start = season_start;
  if (season_end !== undefined) updates.season_end = season_end;
  if (recurring_commitments !== undefined) updates.recurring_commitments = recurring_commitments;
  if (tournament_weekends !== undefined) updates.tournament_weekends = tournament_weekends;
  if (season_calendar_confirmed !== undefined) updates.season_calendar_confirmed = season_calendar_confirmed;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("athlete_intake")
    .update(updates)
    .eq("id", intake.id)
    .select("season_start, season_end, recurring_commitments, tournament_weekends, season_calendar_confirmed")
    .single();
  if (updateError) return dbError("athletes/[id]/schedule", updateError);

  // Keep the active season row in step with the intake calendar.
  if (seasonState.active_season) {
    await supabase
      .from("seasons")
      .update({
        season_start: updated.season_start,
        season_end: updated.season_end,
        recurring_commitments: updated.recurring_commitments,
        tournament_weekends: updated.tournament_weekends,
        calendar_confirmed: updated.season_calendar_confirmed,
      })
      .eq("id", seasonState.active_season.id);
  }

  // If there's already an active plan, don't silently let it drift out of
  // sync with the new schedule -- flag it for the coach the same way any
  // other athlete-initiated schedule change does.
  const { data: skeleton } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .maybeSingle();

  if (!skeleton) {
    return NextResponse.json({ schedule: updated, needs_coach_action: false });
  }

  const { data: activePhase } = await supabase
    .from("macrocycle_phases")
    .select("id")
    .eq("skeleton_id", skeleton.id)
    .eq("status", "active")
    .maybeSingle();

  if (!activePhase) {
    return NextResponse.json({ schedule: updated, needs_coach_action: false });
  }

  try {
    await compilePhasePerformanceSummary(supabase, {
      phaseId: activePhase.id,
      reason: "rebuild_skeleton_scoped",
      reasonDetail: "Athlete updated their season schedule (tournament/league dates or season calendar).",
    });
  } catch (err) {
    // The schedule change itself already saved successfully above -- don't
    // fail the whole request just because the coach-flagging step hiccuped.
    console.error("[athletes/[id]/schedule] failed to flag schedule change for coach:", err);
  }

  return NextResponse.json({
    schedule: updated,
    needs_coach_action: true,
    message:
      "Saved. Since you already have an active season plan, your coach will review this change and rebuild it if needed.",
  });
}
