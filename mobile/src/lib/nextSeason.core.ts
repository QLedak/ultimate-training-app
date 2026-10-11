/**
 * "Plan next season" helpers (pure). Shapes match GET/POST /api/athletes/:id/next-season.
 */
import { commitmentsPayload, normalizeCommitments, normalizeTournaments, validateScheduleForm, type Commitment, type Tournament } from "./schedule.core";

export type SeasonStage = "no_plan" | "in_season_plan" | "ending_soon" | "bridge";

export type PlannedSeason = {
  id: string;
  label: string;
  season_start: string | null;
  season_end: string | null;
  recurring_commitments: unknown;
  tournament_weekends: unknown;
  skeleton_id: string | null;
  intake_changes: { training_days_per_week?: number; goals?: string };
  draft_status: "none" | "pending_review" | "approved" | "rejected";
};

export type SeasonState = {
  stage: SeasonStage;
  is_bridge: boolean;
  active_season: { label: string; season_end: string | null } | null;
  planned_season: PlannedSeason | null;
  days_until_final_phase_end: number | null;
  prefill: { training_days_per_week: number | null; goals: string | null; equipment: string[]; active_injuries: number };
};

export const DAYS_OPTIONS = [2, 3, 4, 5, 6];

export function seasonIntro(stage: SeasonStage): string {
  if (stage === "bridge") {
    return "Your season has wrapped up. You're in off-season training blocks that keep going until you enter new dates. Then your coach builds your next plan from them.";
  }
  if (stage === "ending_soon") {
    return "Your current plan is close to done. Enter next season's dates now and your next plan will be ready to start right after it.";
  }
  return "Know your next season's dates already? Enter them and your coach will build a plan that picks up right after your current one.";
}

/** One-line status of a saved next season, or null when nothing is saved. */
export function plannedStatus(p: PlannedSeason | null): string | null {
  if (!p) return null;
  if (p.skeleton_id) return `Your ${p.label} plan is approved and scheduled to start when your current block finishes. Message your coach if any dates change.`;
  if (p.draft_status === "pending_review") return `Your ${p.label} dates are in. Your coach is reviewing the plan. You keep training as scheduled meanwhile.`;
  if (p.draft_status === "rejected") return `Your ${p.label} dates are saved. Your coach is reworking the plan.`;
  return `Your ${p.label} dates are saved. Your plan is being drafted.`;
}

/** The plan is approved, so dates can no longer be edited here. */
export const isLocked = (p: PlannedSeason | null) => !!p?.skeleton_id;

/** Whether Today should nudge the athlete to plan their next season. */
export function shouldPromptNextSeason(s: SeasonState | null): boolean {
  if (!s) return false;
  return s.stage === "ending_soon" || s.stage === "bridge";
}

export type NextSeasonForm = {
  start: string;
  end: string;
  tournaments: Tournament[];
  commitments: Commitment[];
  days: number | null;
  goals: string;
};

/** Form values from the server's saved plan, falling back to prefill for days/goals. */
export function formFromState(s: SeasonState): NextSeasonForm {
  const p = s.planned_season;
  return {
    start: p?.season_start ?? "",
    end: p?.season_end ?? "",
    tournaments: normalizeTournaments(p?.tournament_weekends),
    commitments: normalizeCommitments(p?.recurring_commitments),
    days: p?.intake_changes?.training_days_per_week ?? s.prefill.training_days_per_week,
    goals: p?.intake_changes?.goals ?? s.prefill.goals ?? "",
  };
}

export function nextSeasonProblem(f: NextSeasonForm, today: string): string | null {
  const p = validateScheduleForm({ season_start: f.start, season_end: f.end, tournaments: f.tournaments, commitments: f.commitments });
  if (p) return p;
  if (f.start < today) return "Your next season has to start in the future.";
  return null;
}

/** Body for POST /next-season. The server only records days/goals if they actually differ from before. */
export function buildNextSeasonBody(f: NextSeasonForm) {
  return {
    season_start: f.start,
    season_end: f.end,
    tournament_weekends: f.tournaments,
    recurring_commitments: commitmentsPayload(f.commitments),
    season_calendar_confirmed: true,
    training_days_per_week: f.days ?? undefined,
    goals: f.goals,
  };
}
