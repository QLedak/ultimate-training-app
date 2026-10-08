import type { Level, SpaceTier } from "../../library/exercise-row";

export type DayType =
  | "lower_strength"
  | "upper_strength_1"
  | "athlete_day"
  | "lower_body_power"
  | "upper_strength_2"
  | "energy_systems";

export const DAY_LABELS: Record<DayType, string> = {
  lower_strength: "Lower Strength",
  upper_strength_1: "Upper Strength 1",
  athlete_day: "Athlete Day",
  lower_body_power: "Lower Body Power",
  upper_strength_2: "Upper Strength 2",
  energy_systems: "Energy Systems",
};

/** Weekly order; the first N appear at N training days/week. */
export const DAY_ORDER: DayType[] = [
  "lower_strength",
  "upper_strength_1",
  "athlete_day",
  "lower_body_power",
  "upper_strength_2",
  "energy_systems",
];

export type ConditioningModality = "running" | "bike" | "rower" | "ski_erg" | "jump_rope" | "incline_walk";
export const CONDITIONING_MODALITIES: Array<{ value: ConditioningModality; label: string }> = [
  { value: "running", label: "Running drills" },
  { value: "bike", label: "Bike" },
  { value: "rower", label: "Rower" },
  { value: "ski_erg", label: "Ski erg" },
  { value: "jump_rope", label: "Jump rope" },
  { value: "incline_walk", label: "Incline walk" },
];

export type InjuryAreaInput = {
  /** Injury location key (achilles_calf, patellar_knee, ...). */
  location: string;
  status: "active" | "historical";
  /** Months since the injury (historical only). Unknown = treated as older. */
  monthsAgo?: number | null;
};

export type SlotProfile = {
  level: Level;
  equipment: string[];
  space: SpaceTier;
  daysPerWeek: number;
  hasLeagueDay: boolean;
  modality: ConditioningModality;
  injuries: InjuryAreaInput[];
  /** 1-based position of this phase in the macrocycle (drives plane rotation / tri-set rotation). */
  phaseNumber: number;
  /** Per-athlete coach pins: slot_key -> exercise_id. */
  pins: Record<string, string>;
};

export type PriorContinuity = {
  /** slot_key -> exercise_id used in the athlete's previous phase. */
  picks: Record<string, string>;
  /** injury location -> highest chain step (and its type) prescribed in the previous phase. */
  chainSteps: Record<string, { step: number; type: "isometric" | "hsr_start" | "hsr" }>;
  /** injury locations whose PPS recommended_action was "advance". */
  advance: string[];
};

export type SlotKind =
  | "speed_accel"
  | "speed_cod"
  | "technical_coordination"
  | "absolute_strength"
  | "lower_hypertrophy"
  | "upper_compound"
  | "core"
  | "lower_isolation"
  | "upper_isolation"
  | "calf"
  | "injury_resilience"
  | "plyometrics"
  | "reflexive_strength"
  | "conditioning";

export type PlannedSlot = {
  slot_key: string; // stable id, e.g. "D1.tc"
  day_type: DayType;
  order: number;
  label: string;
  kind: SlotKind;
  mode: "rule" | "shortlist";
  /** Rule pick (or coach pin). Null for shortlist slots. */
  picked: string | null;
  /** Shortlist options the model chooses from (3-8). Empty for rule slots. */
  candidates: string[];
  /** Superset group letter; entries get A1, A2... */
  superset: string | null;
  intent: string;
  pinned?: boolean;
  extra_injury?: boolean;
  injury?: { location: string; status: "active" | "historical"; step: number | null };
  notes: string[];
};

export type PlannedDay = { day_type: DayType; label: string; slots: PlannedSlot[] };

export type PhasePlan = {
  phase_goal: string;
  days: PlannedDay[];
  /** Plan-level warnings for the coach (unfilled slots, thin pools, fallbacks). */
  warnings: string[];
};
