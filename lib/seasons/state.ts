import { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "./calendar";

export type SeasonStage =
  | "no_plan" // intake done, no skeleton yet
  | "in_season_plan" // normal: season plan running, final phase not close
  | "ending_soon" // final phase of the plan ends within ENDING_SOON_DAYS
  | "bridge"; // season over, rolling off-season blocks (provisional)

export const ENDING_SOON_DAYS = 28;

export type SeasonRow = {
  id: string;
  label: string;
  season_start: string | null;
  season_end: string | null;
  recurring_commitments: unknown[];
  tournament_weekends: unknown[];
  calendar_confirmed: boolean;
  status: "planned" | "active" | "completed";
  intake_changes: { training_days_per_week?: number; goals?: string };
  skeleton_id: string | null;
  completed_at: string | null;
};

export type SeasonState = {
  stage: SeasonStage;
  is_bridge: boolean;
  active_season: SeasonRow | null;
  planned_season: (SeasonRow & { draft_status: "none" | "pending_review" | "approved" | "rejected" }) | null;
  days_until_final_phase_end: number | null;
  prefill: { training_days_per_week: number | null; goals: string | null; equipment: string[]; active_injuries: number };
  past_seasons: Array<SeasonRow & { review: Record<string, unknown> | null }>;
};

function daysUntil(iso: string, today: string): number {
  return Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
}

/** One read of everything the athlete's season UI + coach badges need. */
export async function getSeasonState(supabase: SupabaseClient, athleteId: string): Promise<SeasonState> {
  const today = todayISO();

  const [{ data: seasons }, { data: skeleton }, { data: state }, { data: intake }, { data: reviews }] = await Promise.all([
    supabase.from("seasons").select("*").eq("athlete_id", athleteId).order("created_at", { ascending: false }),
    supabase
      .from("macrocycle_skeletons")
      .select("id, is_bridge")
      .eq("athlete_id", athleteId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("current_athlete_state")
      .select("training_days_per_week, equipment, current_active_injuries")
      .eq("athlete_id", athleteId)
      .maybeSingle(),
    supabase
      .from("athlete_intake")
      .select("goals")
      .eq("athlete_id", athleteId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("season_reviews").select("season_id, summary").eq("athlete_id", athleteId),
  ]);

  const all = (seasons ?? []) as SeasonRow[];
  const activeSeason = all.find((s) => s.status === "active") ?? null;
  const plannedSeason = all.find((s) => s.status === "planned") ?? null;

  let stage: SeasonStage = "no_plan";
  let daysUntilFinal: number | null = null;
  if (skeleton) {
    if (skeleton.is_bridge) {
      stage = "bridge";
    } else {
      const { data: phases } = await supabase
        .from("macrocycle_phases")
        .select("end_date")
        .eq("skeleton_id", skeleton.id)
        .neq("status", "superseded")
        .order("phase_number", { ascending: false })
        .limit(1);
      const finalEnd = phases?.[0]?.end_date as string | undefined;
      daysUntilFinal = finalEnd ? daysUntil(finalEnd, today) : null;
      stage = daysUntilFinal != null && daysUntilFinal <= ENDING_SOON_DAYS ? "ending_soon" : "in_season_plan";
    }
  }

  let draftStatus: "none" | "pending_review" | "approved" | "rejected" = "none";
  if (plannedSeason) {
    const { data: drafts } = await supabase
      .from("program_drafts")
      .select("status, version")
      .eq("athlete_id", athleteId)
      .eq("call_type", "macrocycle_planner")
      .eq("input_snapshot->>next_season_id", plannedSeason.id)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (drafts?.[0]) draftStatus = drafts[0].status as typeof draftStatus;
  }

  const reviewBySeason = new Map<string, Record<string, unknown>>(
    (reviews ?? []).map((r): [string, Record<string, unknown>] => [r.season_id as string, r.summary as Record<string, unknown>])
  );

  return {
    stage,
    is_bridge: stage === "bridge",
    active_season: activeSeason,
    planned_season: plannedSeason ? { ...plannedSeason, draft_status: draftStatus } : null,
    days_until_final_phase_end: daysUntilFinal,
    prefill: {
      training_days_per_week: (state?.training_days_per_week as number) ?? null,
      goals: (intake?.goals as string) ?? null,
      equipment: (state?.equipment as string[]) ?? [],
      active_injuries: ((state?.current_active_injuries as unknown[]) ?? []).length,
    },
    past_seasons: all
      .filter((s) => s.status === "completed")
      .map((s) => ({ ...s, review: reviewBySeason.get(s.id) ?? null })),
  };
}
