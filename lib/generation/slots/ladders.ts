import type { PhaseGoal } from "../../library/exercise-row";

/**
 * Coach-editable rule tables for the slot engine. Every list is an ORDERED
 * preference: the engine takes the first entry the athlete is eligible for
 * (equipment, space, experience, phase window, not already used this week).
 * Ending each ladder with minimal-equipment fallbacks keeps the slot filled
 * for any athlete. Edit IDs here, not in the engine.
 */

type ByPhase<T> = Record<PhaseGoal, T>;

/** Speed acceleration (rule): mechanics + wall drills early, starts + resisted middle, flying + full-speed starts late. */
export const ACCEL_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["SP-003", "SP-005", "SP-001", "SP-004", "SP-029"],
  hypertrophy: ["SP-005", "SP-006", "SP-002", "SP-031", "SP-030", "SP-029"],
  max_strength: ["SP-008", "SP-010", "SP-007", "SP-006", "SP-011", "SP-031", "SP-030", "SP-029"],
  power_conversion: ["SP-012", "SP-009", "SP-008", "SP-010", "SP-007", "SP-031", "SP-029"],
  peak_taper: ["SP-012", "SP-009", "SP-008", "SP-031", "SP-029"],
};

/** Lower absolute strength, UNILATERAL (Day 1 at 2-3 days/wk; Day 4). Rear-foot-elevated family is the default. */
export const LOWER_PUSH_UNILATERAL_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["AS-006", "AS-035", "AS-007"],
  hypertrophy: ["AS-007", "AS-006", "AS-035"],
  max_strength: ["AS-007", "AS-006", "AS-035"],
  power_conversion: ["AS-008", "AS-007", "AS-006", "AS-035"],
  peak_taper: ["AS-008", "AS-007", "AS-006", "AS-035"],
};
/** Rest of the unilateral family, used when Day 4 needs an exercise different from Day 1's. */
export const LOWER_PUSH_UNILATERAL_ALL = ["AS-008", "AS-007", "AS-006", "AS-035", "HY-003", "HY-043"];

/** Lower absolute strength, BILATERAL (Day 1 at 4+ days/wk). */
export const LOWER_PUSH_BILATERAL_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["AS-003", "AS-002", "AS-005", "AS-001", "AS-036"],
  hypertrophy: ["AS-003", "AS-002", "AS-005", "AS-001", "AS-036"],
  max_strength: ["AS-003", "AS-004", "AS-002", "AS-005", "AS-001", "AS-036"],
  power_conversion: ["AS-004", "AS-003", "AS-005", "AS-001", "AS-036"],
  peak_taper: ["AS-004", "AS-003", "AS-005", "AS-001", "AS-036"],
};

/** Adductor isolation (Day 1 isolation 1 when no injured area claims it). */
export const ADDUCTOR_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["IR-012", "HY-039", "IR-013", "IR-010", "IR-009"],
  hypertrophy: ["IR-012", "HY-039", "IR-013", "IR-010", "IR-009"],
  max_strength: ["IR-013", "HY-039", "IR-012", "IR-010", "IR-009"],
  power_conversion: ["IR-013", "IR-037", "HY-039", "IR-012", "IR-010", "IR-009"],
  peak_taper: ["IR-012", "HY-039", "IR-013", "IR-010", "IR-009"],
};

/** Posterior-chain isolation (Day 1 isolation 2): region priority by phase. Hamstring only when Day 4 isn't in the week. */
export const POSTERIOR_REGION_ORDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["glute", "low back", "hamstring"],
  hypertrophy: ["hamstring", "glute", "low back"],
  max_strength: ["low back", "hamstring", "glute"],
  power_conversion: ["glute", "hamstring", "low back"],
  peak_taper: ["glute", "low back", "hamstring"],
};

/** Calf isolation (Day 3) when no Achilles/calf injury claims the slot. */
export const CALF_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["HY-031", "HY-033", "HY-032"],
  hypertrophy: ["HY-033", "HY-031", "HY-032"],
  max_strength: ["HY-032", "HY-033", "HY-031"],
  power_conversion: ["HY-033", "HY-032", "HY-031"],
  peak_taper: ["HY-033", "HY-031", "HY-032"],
};
/** Last resort when the athlete has no dumbbell/barbell: bodyweight calf holds. */
export const CALF_FALLBACK = ["IR-002", "IR-001"];

/** Reflexive strength ladder. Day 3 takes the first eligible entry; Day 4 (late phases) takes the next. */
export const REFLEXIVE_LADDER: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: ["RS-008", "RS-011", "RS-012", "RS-001", "RS-004", "RS-015", "RS-019", "RS-020"],
  hypertrophy: ["RS-012", "RS-013", "RS-002", "RS-004", "RS-005", "RS-015", "RS-019", "RS-020"],
  max_strength: ["RS-013", "RS-003", "RS-005", "RS-006", "RS-007", "RS-014", "RS-016", "RS-019", "RS-020"],
  power_conversion: ["RS-006", "RS-007", "RS-009", "RS-010", "RS-014", "RS-017", "RS-018", "RS-013", "RS-019", "RS-020"],
  peak_taper: ["RS-006", "RS-007", "RS-009", "RS-010", "RS-014", "RS-017", "RS-018", "RS-013", "RS-019", "RS-020"],
};

/** How far up a technical-coordination chain to start, as a fraction of the athlete's eligible depth range. */
export const TC_DEPTH_FRACTION: Partial<ByPhase<number>> = {
  gpp_reacclimation: 0.5,
  hypertrophy: 0.7,
  max_strength: 1,
  power_conversion: 1,
  peak_taper: 0.6,
};

/** Conditioning time frames by phase, in priority order. Day 6 uses the first; the Day 2 finisher uses the second when there is one. */
export const CONDITIONING_FRAMES: Partial<ByPhase<string[]>> = {
  gpp_reacclimation: [">10 min"],
  hypertrophy: [">10 min", "2-10 min"],
  max_strength: ["2-10 min", "30 s-2 min"],
  power_conversion: ["30 s-2 min", "10-30 s"],
  peak_taper: ["REPEATED_SPRINT", "<10 s", "10-30 s"],
};
export const REPEATED_SPRINT_ID = "CN-010";

/** Hypertrophy Upper compound rows have no push/pull field in the library; direction is fixed here. */
export const UPPER_COMPOUND_DIRECTION: Record<string, "push" | "pull"> = {
  "HY-013": "push", "HY-014": "pull", "HY-015": "pull", "HY-016": "pull",
};

export const TRISET_GROUPS = ["biceps", "triceps", "forearm", "shoulder"];

export const ladderFor = <T,>(table: Partial<ByPhase<T>>, goal: PhaseGoal, fallback: T): T =>
  table[goal] ?? fallback;
