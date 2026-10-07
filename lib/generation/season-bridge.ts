import { SupabaseClient } from "@supabase/supabase-js";
import { addDays, PhaseGoal } from "./phase-sequencing";

/**
 * Season transitions: what happens when an athlete's season plan runs out.
 *
 *  - The season is archived (with a year-in-review) and the athlete rolls
 *    straight into a BRIDGE skeleton: GPP once (ease back into volume after
 *    competition), then Hypertrophy -> Max Strength -> Power Conversion,
 *    4 weeks each, repeating for as long as no new season dates exist.
 *    No GPP in the repeating cycle and no Peak Taper (there is no peak date).
 *  - When the athlete enters next-season dates, the Macrocycle Planner draft
 *    that gets approved is APPENDED to this same skeleton after the last block
 *    that already started (see materializeNextSeason in lib/review/materialize.ts).
 *
 * The bridge itself is built by the app (no AI planner call): every block still
 * goes through the usual Phase Builder draft + coach review before the athlete
 * sees it.
 */

export const BRIDGE_CYCLE: PhaseGoal[] = ["hypertrophy", "max_strength", "power_conversion"];
const BLOCK_WEEKS = 4;

export type BridgeBlock = {
  goal: PhaseGoal;
  start_date: string;
  end_date: string;
  week_count: number;
};

const BRIDGE_NAMES: Record<string, string> = {
  gpp_reacclimation: "Off-Season Bridge: GPP / Re-acclimation",
  hypertrophy: "Off-Season Bridge: Hypertrophy",
  max_strength: "Off-Season Bridge: Max Strength",
  power_conversion: "Off-Season Bridge: Power Conversion",
};

export function bridgePhaseName(goal: string): string {
  return BRIDGE_NAMES[goal] ?? "Off-Season Bridge";
}

/** The goal that follows `lastGoal` in the repeating bridge cycle (GPP -> Hypertrophy). */
export function nextBridgeGoal(lastGoal: string | null | undefined): PhaseGoal {
  const i = BRIDGE_CYCLE.indexOf(lastGoal as PhaseGoal);
  return i === -1 ? BRIDGE_CYCLE[0] : BRIDGE_CYCLE[(i + 1) % BRIDGE_CYCLE.length];
}

/**
 * Pure: 4-week blocks starting on `startDate`. `includeGpp` prepends one GPP
 * block (only ever used for the first block of a bridge). `afterGoal` continues
 * the cycle from where a previous bridge block left off.
 */
export function buildBridgeBlocks(params: {
  startDate: string;
  includeGpp: boolean;
  afterGoal?: string | null;
  cycles?: number;
}): BridgeBlock[] {
  const { startDate, includeGpp, afterGoal, cycles = 1 } = params;
  const goals: PhaseGoal[] = [];
  if (includeGpp) goals.push("gpp_reacclimation");
  // After GPP the cycle starts at hypertrophy; without GPP it continues after `afterGoal`.
  let cursor = BRIDGE_CYCLE.indexOf(includeGpp ? BRIDGE_CYCLE[0] : nextBridgeGoal(afterGoal ?? null));
  for (let i = 0; i < cycles * BRIDGE_CYCLE.length; i++) {
    goals.push(BRIDGE_CYCLE[cursor % BRIDGE_CYCLE.length]);
    cursor++;
  }
  const blocks: BridgeBlock[] = [];
  let start = startDate;
  for (const goal of goals) {
    const end = addDays(start, BLOCK_WEEKS * 7 - 1);
    blocks.push({ goal, start_date: start, end_date: end, week_count: BLOCK_WEEKS });
    start = addDays(end, 1);
  }
  return blocks;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ seasons

/** Year-in-review compiled when a season ends. Stored in season_reviews. */
export async function compileSeasonReview(
  supabase: SupabaseClient,
  params: { athleteId: string; seasonId: string | null; skeletonId: string }
) {
  const { athleteId, seasonId, skeletonId } = params;

  const { data: phases } = await supabase
    .from("macrocycle_phases")
    .select("id, phase_number, goal, start_date, end_date, status")
    .eq("skeleton_id", skeletonId)
    .neq("status", "superseded")
    .order("phase_number", { ascending: true });
  const completed = (phases ?? []).filter((p) => p.status === "completed");
  const first = phases?.[0];
  const last = phases?.[phases.length - 1];

  let scheduled = 0;
  let logged = 0;
  if (first && last) {
    const { data: sessions } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("athlete_id", athleteId)
      .gte("date", first.start_date as string)
      .lte("date", last.end_date as string);
    const ids = (sessions ?? []).map((s) => s.id as string);
    scheduled = ids.length;
    if (ids.length) {
      const { data: logs } = await supabase.from("session_logs").select("session_id").in("session_id", ids);
      logged = new Set((logs ?? []).map((l) => l.session_id as string)).size;
    }
  }

  const phaseIds = (phases ?? []).map((p) => p.id as string);
  const maxes: Record<string, { start: number; end: number; change: number }> = {};
  if (phaseIds.length) {
    const { data: ppsRows } = await supabase
      .from("phase_performance_summaries")
      .select("updated_maxes, created_at")
      .in("phase_id", phaseIds)
      .eq("reason", "normal_transition")
      .order("created_at", { ascending: true });
    const firstPps = ppsRows?.[0]?.updated_maxes as Record<string, { value: number }> | undefined;
    const lastPps = ppsRows?.[ppsRows.length - 1]?.updated_maxes as Record<string, { value: number }> | undefined;
    for (const lift of Object.keys(lastPps ?? {})) {
      const s = firstPps?.[lift]?.value;
      const e = lastPps?.[lift]?.value;
      if (typeof s === "number" && typeof e === "number") maxes[lift] = { start: s, end: e, change: e - s };
    }
  }

  const summary = {
    phases_total: phases?.length ?? 0,
    phases_completed: completed.length,
    period: { start: first?.start_date ?? null, end: last?.end_date ?? null },
    sessions_scheduled: scheduled,
    sessions_logged: logged,
    adherence_pct: scheduled > 0 ? Math.round((logged / scheduled) * 100) : null,
    maxes,
  };

  const { data, error } = await supabase
    .from("season_reviews")
    .insert({ athlete_id: athleteId, season_id: seasonId, skeleton_id: skeletonId, summary })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Marks the athlete's ACTIVE season completed (and compiles its review) — idempotent. */
export async function completeActiveSeason(
  supabase: SupabaseClient,
  params: { athleteId: string; skeletonId: string }
) {
  const { athleteId, skeletonId } = params;
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!season) return null;

  const { data: existingReview } = await supabase
    .from("season_reviews")
    .select("id")
    .eq("season_id", season.id)
    .limit(1)
    .maybeSingle();
  const review = existingReview ?? (await compileSeasonReview(supabase, { athleteId, seasonId: season.id as string, skeletonId }));

  const { error } = await supabase
    .from("seasons")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", season.id);
  if (error) throw new Error(error.message);
  return { seasonId: season.id as string, review };
}

// ------------------------------------------------------------------ bridge

type PhaseRow = Record<string, unknown>;

async function insertBridgePhases(
  supabase: SupabaseClient,
  params: { skeletonId: string; blocks: BridgeBlock[]; firstPhaseNumber: number; label: string; firstActive: boolean }
) {
  const rows = params.blocks.map((b, i) => ({
    skeleton_id: params.skeletonId,
    phase_number: params.firstPhaseNumber + i,
    phase_name: bridgePhaseName(b.goal),
    goal: b.goal,
    start_date: b.start_date,
    end_date: b.end_date,
    week_count: b.week_count,
    weekly_template_label: params.label,
    deload_test_note: null,
    is_bridge: true,
    status: params.firstActive && i === 0 ? "active" : "upcoming",
  }));
  const { data, error } = await supabase.from("macrocycle_phases").insert(rows).select();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Season is over and there is no next season plan: archive it and open a bridge
 * skeleton (GPP first, once; then the Hyp -> Max -> Power cycle). Returns the new
 * active phase, or null if nothing was started.
 */
export async function startBridge(
  supabase: SupabaseClient,
  params: { athleteId: string; endedSkeletonId: string }
): Promise<PhaseRow | null> {
  const { athleteId, endedSkeletonId } = params;

  // A bridge never "ends" — if its last block ran out (cron gap), queue the next cycle and continue.
  const { data: endedSk } = await supabase
    .from("macrocycle_skeletons")
    .select("is_bridge")
    .eq("id", endedSkeletonId)
    .single();
  if (endedSk?.is_bridge) {
    await extendBridgeIfNeeded(supabase, { skeletonId: endedSkeletonId, leadDays: 100000 });
    const { data: upcoming } = await supabase
      .from("macrocycle_phases")
      .select("*")
      .eq("skeleton_id", endedSkeletonId)
      .eq("status", "upcoming")
      .order("phase_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!upcoming) return null;
    await supabase.from("macrocycle_phases").update({ status: "active" }).eq("id", upcoming.id);
    return { ...upcoming, status: "active" };
  }

  const { data: endedPhases } = await supabase
    .from("macrocycle_phases")
    .select("phase_number, end_date, weekly_template_label, status, goal")
    .eq("skeleton_id", endedSkeletonId)
    .neq("status", "superseded")
    .order("phase_number", { ascending: false });
  const lastPhase = endedPhases?.[0];
  if (!lastPhase) return null;

  await completeActiveSeason(supabase, { athleteId, skeletonId: endedSkeletonId });

  const { error: closeError } = await supabase
    .from("macrocycle_skeletons")
    .update({ is_active: false, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", endedSkeletonId);
  if (closeError) throw new Error(closeError.message);

  const startDate = (() => {
    const next = addDays(lastPhase.end_date as string, 1);
    return next < today() ? today() : next;
  })();

  const { data: skeleton, error: skError } = await supabase
    .from("macrocycle_skeletons")
    .insert({ athlete_id: athleteId, source_draft_id: null, is_active: true, status: "active", is_bridge: true })
    .select()
    .single();
  if (skError) throw new Error(skError.message);

  const blocks = buildBridgeBlocks({ startDate, includeGpp: true, cycles: 1 });
  const phases = await insertBridgePhases(supabase, {
    skeletonId: skeleton.id as string,
    blocks,
    firstPhaseNumber: 1,
    label: (lastPhase.weekly_template_label as string) ?? "Off-season training",
    firstActive: true,
  });
  return phases[0] ?? null;
}

/**
 * Keeps a bridge going: when the LAST block of a bridge skeleton is active (or
 * already finished) and ends within `leadDays`, appends the next cycle
 * (Hyp -> Max -> Power; never GPP again). No-op for non-bridge skeletons and
 * for bridges whose last block is still far away.
 */
export async function extendBridgeIfNeeded(
  supabase: SupabaseClient,
  params: { skeletonId: string; leadDays: number }
): Promise<boolean> {
  const { skeletonId, leadDays } = params;
  const { data: sk } = await supabase
    .from("macrocycle_skeletons")
    .select("is_bridge, is_active")
    .eq("id", skeletonId)
    .single();
  if (!sk?.is_bridge || !sk.is_active) return false;

  const { data: phases } = await supabase
    .from("macrocycle_phases")
    .select("phase_number, goal, end_date, status, weekly_template_label")
    .eq("skeleton_id", skeletonId)
    .neq("status", "superseded")
    .order("phase_number", { ascending: false })
    .limit(1);
  const last = phases?.[0];
  if (!last) return false;

  const { data: maxRow } = await supabase
    .from("macrocycle_phases")
    .select("phase_number")
    .eq("skeleton_id", skeletonId)
    .order("phase_number", { ascending: false })
    .limit(1)
    .single();

  const msLeft =
    new Date(`${last.end_date as string}T00:00:00Z`).getTime() - new Date(`${today()}T00:00:00Z`).getTime();
  if (msLeft / 86400000 > leadDays) return false;

  const blocks = buildBridgeBlocks({
    startDate: addDays(last.end_date as string, 1),
    includeGpp: false,
    afterGoal: last.goal as string,
    cycles: 1,
  });
  await insertBridgePhases(supabase, {
    skeletonId,
    blocks,
    firstPhaseNumber: ((maxRow?.phase_number as number) ?? (last.phase_number as number)) + 1,
    label: last.weekly_template_label as string,
    firstActive: false,
  });
  return true;
}

// ------------------------------------------------------------------ next season

/**
 * Bridge blocks that haven't started yet are replaced by the next-season plan.
 * They're marked superseded (and parked at phase_number + 1000 so neither the
 * unique(skeleton_id, phase_number) constraint nor the "phase_number + 1" lookups
 * in the cron / PPS compile ever trip over them); any unpublished drafts for them
 * are rejected and future unlogged sessions removed.
 */
export async function supersedeUnstartedBridgePhases(supabase: SupabaseClient, skeletonId: string) {
  const { data: stale } = await supabase
    .from("macrocycle_phases")
    .select("id, phase_number")
    .eq("skeleton_id", skeletonId)
    .eq("is_bridge", true)
    .eq("status", "upcoming");
  if (!stale?.length) return 0;
  const ids = stale.map((p) => p.id as string);

  await supabase.from("program_drafts").update({ status: "rejected" }).in("phase_id", ids).eq("status", "pending_review");

  const { data: sessions } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .in("phase_id", ids)
    .gt("date", today());
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length) {
    const { data: logs } = await supabase.from("session_logs").select("session_id").in("session_id", sessionIds);
    const logged = new Set((logs ?? []).map((l) => l.session_id as string));
    const deletable = sessionIds.filter((id) => !logged.has(id));
    if (deletable.length) await supabase.from("scheduled_sessions").delete().in("id", deletable);
  }

  for (const p of stale) {
    const { error } = await supabase
      .from("macrocycle_phases")
      .update({ status: "superseded", phase_number: (p.phase_number as number) + 1000 })
      .eq("id", p.id);
    if (error) throw new Error(error.message);
  }
  return stale.length;
}

/**
 * Called whenever a phase becomes active: if it's the FIRST phase of a planned
 * season's plan, that season becomes the active one (previous one is closed out
 * with its review) and its calendar is mirrored onto the athlete's latest intake
 * row, which the rest of the app reads for tournaments / the program calendar.
 */
export async function activatePlannedSeasonIfStarting(
  supabase: SupabaseClient,
  params: { athleteId: string; skeletonId: string; phaseNumber: number }
) {
  const { athleteId, skeletonId, phaseNumber } = params;
  const { data: planned } = await supabase
    .from("seasons")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("status", "planned")
    .eq("skeleton_id", skeletonId)
    .eq("first_phase_number", phaseNumber)
    .limit(1)
    .maybeSingle();
  if (!planned) return null;

  await completeActiveSeason(supabase, { athleteId, skeletonId });

  const { error } = await supabase.from("seasons").update({ status: "active" }).eq("id", planned.id);
  if (error) throw new Error(error.message);
  await supabase.from("macrocycle_skeletons").update({ season_id: planned.id, is_bridge: false }).eq("id", skeletonId);

  const { data: intake } = await supabase
    .from("athlete_intake")
    .select("id")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intake) {
    await supabase
      .from("athlete_intake")
      .update({
        season_start: planned.season_start,
        season_end: planned.season_end,
        recurring_commitments: planned.recurring_commitments,
        tournament_weekends: planned.tournament_weekends,
        season_calendar_confirmed: planned.calendar_confirmed,
      })
      .eq("id", intake.id);
  }
  await applySeasonIntakeChanges(supabase, { athleteId, season: planned });
  return planned;
}

/** days/week + goals the athlete asked for alongside next season's dates (idempotent). */
export async function applySeasonIntakeChanges(
  supabase: SupabaseClient,
  params: { athleteId: string; season: Record<string, unknown> }
) {
  const { athleteId, season } = params;
  const changes = (season.intake_changes as { training_days_per_week?: number; goals?: string } | null) ?? {};
  if (changes.training_days_per_week == null && changes.goals == null) return;

  const { data: intake } = await supabase
    .from("athlete_intake")
    .select("id")
    .eq("athlete_id", athleteId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (changes.training_days_per_week != null) {
    await supabase
      .from("current_athlete_state")
      .update({ training_days_per_week: changes.training_days_per_week })
      .eq("athlete_id", athleteId);
    if (intake) {
      await supabase
        .from("athlete_intake")
        .update({ training_days_per_week: changes.training_days_per_week })
        .eq("id", intake.id);
    }
  }
  if (changes.goals != null && intake) {
    await supabase.from("athlete_intake").update({ goals: changes.goals }).eq("id", intake.id);
  }
}
