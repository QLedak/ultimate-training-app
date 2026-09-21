import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { epley1RM } from "@/lib/training/epley";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * POST /api/intake
 * Body: full intake payload (see intake-funnel-spec.md) plus injuryReports
 * and catchallRestrictions arrays.
 *
 * Writes athlete_intake + its injury reports, then seeds current_athlete_state
 * — per system-prompt-v3.md's explicit lifecycle rule, this is the ONE time
 * intake numbers populate current state directly; every phase after the
 * first overwrites them with real logged data instead.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { athleteId, injuryReports = [], catchallRestrictions = [], ...intakeFields } = body;

  if (!athleteId) {
    return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
  }

  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== athleteId) return forbidden();

  const supabase = getSupabaseAdmin();

  const { data: intake, error: intakeError } = await supabase
    .from("athlete_intake")
    .insert({ athlete_id: athleteId, ...intakeFields })
    .select()
    .single();

  if (intakeError) {
    return dbError("intake", intakeError);
  }

  if (injuryReports.length > 0) {
    const { error: injuryError } = await supabase.from("athlete_injury_reports").insert(
      injuryReports.map((r: Record<string, unknown>) => ({ ...r, intake_id: intake.id }))
    );
    if (injuryError) {
      return dbError("intake", injuryError);
    }
  }

  if (catchallRestrictions.length > 0) {
    const { error: catchallError } = await supabase.from("athlete_catchall_restrictions").insert(
      catchallRestrictions.map((text: string) => ({ text, intake_id: intake.id }))
    );
    if (catchallError) {
      return dbError("intake", catchallError);
    }
  }

  // Seed current_athlete_state (one-time, per the lifecycle rule).
  const estimateOrNull = (weight: number | null, reps: number | null) =>
    weight != null && reps != null ? epley1RM(weight, reps) : null;

  const standingResilienceRegions = injuryReports
    .filter((r: { report_type: string }) => r.report_type === "history")
    .map((r: { location: string }) => ({ location: r.location, current_stage: "not_yet_started" }));

  const currentActiveInjuries = injuryReports
    .filter((r: { report_type: string }) => r.report_type === "current_active")
    .map((r: { location: string; character: string }) => ({
      location: r.location,
      character: r.character,
      since: new Date().toISOString(),
    }));

  const { error: stateError } = await supabase.from("current_athlete_state").upsert({
    athlete_id: athleteId,
    bodyweight_lb: intakeFields.bodyweight_lb ?? null,
    back_squat_1rm: estimateOrNull(intakeFields.back_squat_weight, intakeFields.back_squat_reps),
    bench_press_1rm: estimateOrNull(intakeFields.bench_press_weight, intakeFields.bench_press_reps),
    deadlift_1rm: estimateOrNull(intakeFields.deadlift_weight, intakeFields.deadlift_reps),
    power_clean_1rm: estimateOrNull(intakeFields.power_clean_weight, intakeFields.power_clean_reps),
    pullup_max_reps: intakeFields.pullup_max_reps ?? null,
    vertical_jump_in: intakeFields.vertical_jump_in ?? null,
    maxes_source: "intake_estimate",
    equipment: intakeFields.equipment ?? [],
    training_days_per_week: intakeFields.training_days_per_week,
    current_active_injuries: currentActiveInjuries,
    standing_resilience_regions: standingResilienceRegions,
  });

  if (stateError) {
    return dbError("intake", stateError);
  }

  return NextResponse.json({ intake });
}
