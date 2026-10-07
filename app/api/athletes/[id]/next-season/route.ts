import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { checkAiGenerationLimit } from "@/lib/api/ai-generation-limit";
import { generateNextSeasonDraft } from "@/lib/generation/macrocycle";
import { getSeasonState } from "@/lib/seasons/state";
import { suggestSeasonLabel, validateSeasonCalendar, SeasonCalendarInput } from "@/lib/seasons/calendar";

export const maxDuration = 60;

/**
 * GET/POST/DELETE /api/athletes/[id]/next-season
 *
 * The athlete's "Plan next season" path: enter next season's dates (and, only
 * if something changed, days/week + goals). Saving creates a `planned` season and
 * auto-drafts a Macrocycle Planner skeleton for coach review — nothing reaches
 * the athlete's schedule until the coach approves. The running plan (or the
 * off-season bridge) keeps going untouched in the meantime.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  try {
    return NextResponse.json(await getSeasonState(supabase, params.id));
  } catch (err) {
    return dbError("athletes/[id]/next-season", err as { message: string });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();
  const athleteId = params.id;

  const body = (await req.json().catch(() => ({}))) as SeasonCalendarInput & {
    label?: string;
    training_days_per_week?: number;
    goals?: string;
  };

  if (!body.season_start || !body.season_end) {
    return NextResponse.json({ error: "Enter your season start and end dates." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const state = await getSeasonState(supabase, athleteId);
  if (state.stage === "no_plan") {
    return NextResponse.json(
      { error: "You don't have a season plan yet — finish intake and wait for your first plan first." },
      { status: 409 }
    );
  }

  // While a season is still running, the next one has to start after it ends.
  const runningEnd = state.stage === "bridge" ? null : state.active_season?.season_end ?? null;
  const invalid = validateSeasonCalendar(body, { requireFuture: true, mustStartAfter: runningEnd });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (
    body.training_days_per_week != null &&
    (!Number.isInteger(body.training_days_per_week) || body.training_days_per_week < 2 || body.training_days_per_week > 6)
  ) {
    return NextResponse.json({ error: "Days per week must be between 2 and 6." }, { status: 400 });
  }

  const planned = state.planned_season;
  if (planned?.skeleton_id) {
    return NextResponse.json(
      {
        error:
          "Your next-season plan has already been approved. Message your coach if the dates changed so they can adjust it.",
      },
      { status: 409 }
    );
  }

  // Only record intake changes that are real changes.
  const intakeChanges: { training_days_per_week?: number; goals?: string } = {};
  if (
    body.training_days_per_week != null &&
    body.training_days_per_week !== state.prefill.training_days_per_week
  ) {
    intakeChanges.training_days_per_week = body.training_days_per_week;
  }
  const goals = typeof body.goals === "string" ? body.goals.trim() : undefined;
  if (goals !== undefined && goals !== (state.prefill.goals ?? "").trim()) intakeChanges.goals = goals;

  const row = {
    athlete_id: athleteId,
    label: body.label?.trim() || suggestSeasonLabel(body.season_start),
    season_start: body.season_start,
    season_end: body.season_end,
    recurring_commitments: body.recurring_commitments ?? [],
    tournament_weekends: body.tournament_weekends ?? [],
    calendar_confirmed: body.season_calendar_confirmed ?? true,
    status: "planned",
    intake_changes: intakeChanges,
  };

  let seasonId: string;
  if (planned) {
    // Replace the earlier submission; its still-pending draft is stale now.
    const { error: rejectError } = await supabase
      .from("program_drafts")
      .update({ status: "rejected" })
      .eq("athlete_id", athleteId)
      .eq("call_type", "macrocycle_planner")
      .eq("status", "pending_review")
      .eq("input_snapshot->>next_season_id", planned.id);
    if (rejectError) return dbError("athletes/[id]/next-season", rejectError);
    const { error: updateError } = await supabase.from("seasons").update(row).eq("id", planned.id);
    if (updateError) return dbError("athletes/[id]/next-season", updateError);
    seasonId = planned.id;
  } else {
    const { data: inserted, error: insertError } = await supabase.from("seasons").insert(row).select("id").single();
    if (insertError || !inserted) return dbError("athletes/[id]/next-season", insertError ?? { message: "insert failed" });
    seasonId = inserted.id as string;
  }

  // Auto-draft the skeleton for coach review. A failure (rate limit, AI hiccup,
  // dates too close to the current blocks) never loses the athlete's input — the
  // season stays saved and the daily job retries drafts that don't exist yet.
  let draftCreated = false;
  let note: string | null = null;
  const limited = await checkAiGenerationLimit(athleteId);
  if (limited) {
    note = "We'll draft your plan shortly.";
  } else {
    try {
      await generateNextSeasonDraft(supabase, { athleteId, seasonId });
      draftCreated = true;
    } catch (err) {
      console.error("[next-season] draft generation failed:", err);
      note = "We saved your dates; your coach will be notified to finish your plan.";
    }
  }

  return NextResponse.json({
    season_id: seasonId,
    draft_created: draftCreated,
    message: draftCreated
      ? "Got it — your coach will review your next-season plan. Until then you keep training as scheduled."
      : `Saved your next-season dates. ${note ?? ""}`.trim(),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  const state = await getSeasonState(supabase, params.id);
  const planned = state.planned_season;
  if (!planned) return NextResponse.json({ ok: true });
  if (planned.skeleton_id) {
    return NextResponse.json({ error: "That plan was already approved — ask your coach to change it." }, { status: 409 });
  }

  await supabase
    .from("program_drafts")
    .update({ status: "rejected" })
    .eq("athlete_id", params.id)
    .eq("call_type", "macrocycle_planner")
    .eq("status", "pending_review")
    .eq("input_snapshot->>next_season_id", planned.id);
  const { error } = await supabase.from("seasons").delete().eq("id", planned.id);
  if (error) return dbError("athletes/[id]/next-season", error);
  return NextResponse.json({ ok: true });
}
