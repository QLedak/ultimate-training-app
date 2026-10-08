import type { SupabaseClient } from "@supabase/supabase-js";
import type { Level, LibraryRow, SpaceTier } from "../../library/exercise-row";
import type {
  ConditioningModality, InjuryAreaInput, PriorContinuity, SlotProfile,
} from "./types";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Library experience level (N / C / VE) for Olympic-lift and loaded-lift gating.
 *
 *  - Years of structured training (at intake + time since intake on the app)
 *    set the base: under 6 months = N, under 3 years = C, otherwise VE.
 *  - "New" self-describers stay N for their first 6 months on the app, then are
 *    re-evaluated as Comfortable (never higher than C until they self-update).
 *  - "Comfortable with basics" caps at C. "Very experienced" applies no cap.
 */
export function deriveLiftingLevel(
  yearsStructuredTraining: number | null | undefined,
  selfDescribe: string | null | undefined,
  intakeSubmittedAt?: string | Date | null,
  now: Date = new Date()
): Level {
  let elapsedYears = 0;
  if (intakeSubmittedAt) {
    const t = new Date(intakeSubmittedAt).getTime();
    if (!Number.isNaN(t)) elapsedYears = Math.max(0, (now.getTime() - t) / YEAR_MS);
  }
  const years = (yearsStructuredTraining ?? 0) + elapsedYears;
  let level: Level = years < 0.5 ? "N" : years < 3 ? "C" : "VE";
  if (selfDescribe === "new") level = elapsedYears < 0.5 ? "N" : level === "VE" ? "C" : level === "N" ? "C" : level;
  if (selfDescribe === "comfortable_with_basics") level = level === "VE" ? "C" : level === "N" ? "C" : level;
  if (selfDescribe === "very_experienced" && level === "N") level = "C";
  return level;
}

/** League/game night on the athlete's recurring schedule during this phase. */
export function detectLeagueDay(
  intake: Record<string, unknown> | null | undefined,
  phase?: { start_date?: string; end_date?: string } | null
): boolean {
  const commitments = (intake?.recurring_commitments as Array<Record<string, unknown>> | undefined) ?? [];
  return commitments.some((c) => {
    const label = String(c.label ?? "");
    if (!/\b(league|game|games)\b/i.test(label)) return false;
    const start = (c.startDate ?? c.start_date) as string | undefined;
    const end = (c.endDate ?? c.end_date) as string | undefined;
    if (phase?.start_date && phase?.end_date) {
      if (end && end < phase.start_date) return false;
      if (start && start > phase.end_date) return false;
    }
    return true;
  });
}

const KNOWN_LOCATIONS = new Set([
  "achilles_calf", "patellar_knee", "acl_knee", "hamstring", "groin_adductor", "ankle", "shoulder",
  "lower_back", "hip_flexor", "abdominal", "elbow", "wrist",
]);

export function injuriesFromState(state: Record<string, unknown>): InjuryAreaInput[] {
  const active = ((state.current_active_injuries as Array<{ location: string }> | undefined) ?? [])
    .map((i) => i.location)
    .filter((l) => KNOWN_LOCATIONS.has(l));
  const historical = ((state.standing_resilience_regions as Array<{ location: string }> | undefined) ?? [])
    .map((i) => i.location)
    .filter((l) => KNOWN_LOCATIONS.has(l) && !active.includes(l));
  return [
    ...active.map((location) => ({ location, status: "active" as const })),
    ...historical.map((location) => ({ location, status: "historical" as const, monthsAgo: null })),
  ];
}

export function buildSlotProfile(params: {
  intake: Record<string, unknown>;
  state: Record<string, unknown>;
  phase: Record<string, unknown>;
  pins?: Record<string, string>;
}): SlotProfile {
  const { intake, state, phase } = params;
  const space = ((state.available_space as SpaceTier | null) ?? (intake.available_space as SpaceTier | null) ?? "standard") as SpaceTier;
  const modality = ((state.conditioning_modality as ConditioningModality | null) ?? "running") as ConditioningModality;
  return {
    level: deriveLiftingLevel(
      intake.years_structured_training as number | null,
      intake.lifting_experience_selfdescribe as string | null,
      intake.submitted_at as string | null
    ),
    equipment: (state.equipment as string[]) ?? [],
    space,
    daysPerWeek: Number(state.training_days_per_week ?? 3),
    hasLeagueDay: detectLeagueDay(intake, phase as { start_date?: string; end_date?: string }),
    modality,
    injuries: injuriesFromState(state),
    phaseNumber: Number(phase.phase_number ?? 1),
    pins: params.pins ?? {},
  };
}

// ----------------------------------------------------------------------------
// Database loaders
// ----------------------------------------------------------------------------

/** Active v2 library rows. */
export async function loadActiveLibrary(supabase: SupabaseClient): Promise<LibraryRow[]> {
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("is_active", true)
    .eq("library_version", 2);
  if (error) throw new Error(`Failed to load exercise library: ${error.message}`);
  return (data ?? []) as LibraryRow[];
}

export async function loadPins(supabase: SupabaseClient, athleteId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("athlete_slot_pins").select("slot_key, exercise_id").eq("athlete_id", athleteId);
  if (error) throw new Error(`Failed to load slot pins: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.slot_key as string, r.exercise_id as string]));
}

/**
 * What the athlete was prescribed in their most recent EARLIER phase: rule-slot
 * picks (so chains continue instead of restarting) and the highest rung reached
 * per injury chain. Derived from scheduled_sessions, so there is no extra state
 * to keep in sync.
 */
export async function loadPriorContinuity(
  supabase: SupabaseClient,
  params: {
    athleteId: string;
    currentPhaseId: string;
    library: LibraryRow[];
    latestSummary?: Record<string, unknown> | null;
    /** Only phases that ended before this date count as "previous" (the current phase's start date). */
    beforeDate?: string;
  }
): Promise<PriorContinuity> {
  const empty: PriorContinuity = { picks: {}, chainSteps: {}, advance: [] };
  let q = supabase
    .from("scheduled_sessions")
    .select("phase_id, date")
    .eq("athlete_id", params.athleteId)
    .neq("phase_id", params.currentPhaseId);
  if (params.beforeDate) q = q.lt("date", params.beforeDate);
  const { data: latest, error } = await q.order("date", { ascending: false }).limit(1).maybeSingle();
  if (error || !latest) return empty;

  const { data: sessions } = await supabase
    .from("scheduled_sessions")
    .select("week_number, date, prescribed_exercises")
    .eq("athlete_id", params.athleteId)
    .eq("phase_id", latest.phase_id)
    .order("date", { ascending: true });

  const byId = new Map(params.library.map((r) => [r.exercise_id, r]));
  const out: PriorContinuity = { picks: {}, chainSteps: {}, advance: [] };
  for (const s of sessions ?? []) {
    for (const e of ((s.prescribed_exercises as Array<{ exercise_id?: string; slot_key?: string }>) ?? [])) {
      if (!e.exercise_id) continue;
      if (e.slot_key) out.picks[e.slot_key] = e.exercise_id; // later sessions overwrite earlier ones
      for (const m of byId.get(e.exercise_id)?.chain_memberships ?? []) {
        const cur = out.chainSteps[m.location];
        if (!cur || m.step > cur.step) out.chainSteps[m.location] = { step: m.step, type: m.type };
      }
    }
  }
  const prog = (params.latestSummary?.resilience_progression_state ?? {}) as Record<string, { recommended_action?: string }>;
  out.advance = Object.entries(prog).filter(([, v]) => v?.recommended_action === "advance").map(([k]) => k);
  return out;
}
