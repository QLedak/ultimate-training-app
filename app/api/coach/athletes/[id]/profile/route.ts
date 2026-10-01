import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/coach/athletes/[id]/profile
 *
 * The coach-facing athlete profile: everything from intake plus how it's
 * drifted since (current_athlete_state is the living record — see
 * system-prompt-v3.md's "Stored objects" section — while athlete_intake is
 * the original snapshot), the athlete's injury history/current status, and
 * recent bodyweight entries. Read-only and separate from the season-plan
 * view (/coach/athletes/[id]/program) — this is "who is this athlete,"
 * not "what are they training on right now."
 *
 * Single-coach app model (no per-coach athlete assignment, see
 * data-architecture-spec.md) — any signed-in coach can view any athlete,
 * same as the roster and program views already allow.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const athleteId = params.id;
  const supabase = getSupabaseAdmin();

  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id, email, name")
    .eq("id", athleteId)
    .maybeSingle();
  if (athleteError) return dbError("coach/athletes/[id]/profile", athleteError);
  if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

  const { data: intake, error: intakeError } = await supabase
    .from("athlete_intake")
    .select(
      "id, age, benchmark_set, years_playing_ultimate, years_structured_training, lifting_experience_selfdescribe, season_start, season_end, recurring_commitments, tournament_weekends, season_calendar_confirmed, training_days_per_week, equipment, bodyweight_lb, back_squat_weight, back_squat_reps, bench_press_weight, bench_press_reps, deadlift_or_clean_weight, deadlift_or_clean_reps, pullup_max_reps, vertical_jump_in, goals, submitted_at"
    )
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intakeError) return dbError("coach/athletes/[id]/profile", intakeError);

  const { data: state, error: stateError } = await supabase
    .from("current_athlete_state")
    .select(
      "bodyweight_lb, back_squat_1rm, bench_press_1rm, deadlift_or_clean_1rm, pullup_max_reps, vertical_jump_in, maxes_source, equipment, training_days_per_week, current_active_injuries, standing_resilience_regions, updated_at"
    )
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (stateError) return dbError("coach/athletes/[id]/profile", stateError);

  let injuryReports: unknown[] = [];
  let catchallRestrictions: unknown[] = [];
  if (intake) {
    const [{ data: injuries, error: injuriesError }, { data: restrictions, error: restrictionsError }] =
      await Promise.all([
        supabase
          .from("athlete_injury_reports")
          .select("location, location_other_text, report_type, character, duration_text, notes, created_at")
          .eq("intake_id", intake.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("athlete_catchall_restrictions")
          .select("text, created_at")
          .eq("intake_id", intake.id)
          .order("created_at", { ascending: true }),
      ]);
    if (injuriesError) return dbError("coach/athletes/[id]/profile", injuriesError);
    if (restrictionsError) return dbError("coach/athletes/[id]/profile", restrictionsError);
    injuryReports = injuries ?? [];
    catchallRestrictions = restrictions ?? [];
  }

  const { data: bodyweightHistory, error: bodyweightError } = await supabase
    .from("bodyweight_entries")
    .select("date, bodyweight_lb")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false })
    .limit(10);
  if (bodyweightError) return dbError("coach/athletes/[id]/profile", bodyweightError);

  return NextResponse.json({
    athlete,
    intake: intake ?? null,
    current_state: state ?? null,
    injury_reports: injuryReports,
    catchall_restrictions: catchallRestrictions,
    bodyweight_history: bodyweightHistory ?? [],
  });
}
