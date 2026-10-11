/**
 * Intake wizard logic (pure, no React Native imports so it can be unit tested).
 * Mirrors the website wizard (app/app/intake/page.tsx) minus its account step:
 * on the phone the account already exists by the time intake starts.
 * The payload built here is exactly what POST /api/intake expects.
 */
import { toggleEquipmentValue } from "../shared/equipment-options";
import { validateScheduleForm, type Commitment, type Tournament } from "./schedule.core";

export type MaxEntry = { weight: string; reps: string; skip: boolean };
export type Benchmark = "male_typical" | "female_typical" | "general_range" | "";
export type Lifting = "new" | "comfortable_with_basics" | "very_experienced" | "";

export type IntakeState = {
  age: string;
  benchmarkSet: Benchmark;
  yearsPlayingUltimate: string;
  yearsStructuredTraining: string;
  liftingExperience: Lifting;
  seasonStart: string;
  seasonEnd: string;
  commitments: Commitment[];
  tournaments: Tournament[];
  calendarConfirmed: "yes" | "not_yet" | "";
  trainingDaysPerWeek: string;
  equipment: string[];
  availableSpace: string;
  conditioningModality: string;
  bodyweightLb: string;
  bodyweightSkip: boolean;
  backSquat: MaxEntry;
  benchPress: MaxEntry;
  deadlift: MaxEntry;
  powerClean: MaxEntry;
  pullupMaxReps: string;
  pullupSkip: boolean;
  verticalJumpIn: string;
  currentInjuries: string[];
  injuryHistory: string[];
  catchall: string;
  goals: string;
};

const blankMax = (): MaxEntry => ({ weight: "", reps: "", skip: false });

export const initialIntake = (): IntakeState => ({
  age: "",
  benchmarkSet: "",
  yearsPlayingUltimate: "",
  yearsStructuredTraining: "",
  liftingExperience: "",
  seasonStart: "",
  seasonEnd: "",
  commitments: [],
  tournaments: [],
  calendarConfirmed: "",
  trainingDaysPerWeek: "",
  equipment: [],
  availableSpace: "",
  conditioningModality: "running",
  bodyweightLb: "",
  bodyweightSkip: false,
  backSquat: blankMax(),
  benchPress: blankMax(),
  deadlift: blankMax(),
  powerClean: blankMax(),
  pullupMaxReps: "",
  pullupSkip: false,
  verticalJumpIn: "",
  currentInjuries: [],
  injuryHistory: [],
  catchall: "",
  goals: "",
});

export const STEP_TITLES = [
  "About you",
  "Experience",
  "Season calendar",
  "Training days",
  "Equipment",
  "Stats & maxes",
  "Injury screening",
  "Goals",
  "Review",
] as const;
export const TOTAL_STEPS = STEP_TITLES.length;

export const GOAL_CHIPS = [
  "Get faster",
  "Jump higher",
  "Build strength",
  "Stay healthy through a long season",
  "Coming back from injury",
  "Make a specific team/roster",
];

export const BENCHMARK_OPTIONS = [
  { value: "male_typical", label: "Male-typical benchmarks" },
  { value: "female_typical", label: "Female-typical benchmarks" },
  { value: "general_range", label: "Prefer a general range" },
] as const;

export const LIFTING_OPTIONS = [
  { value: "new", label: "New to structured lifting" },
  { value: "comfortable_with_basics", label: "Comfortable with the basics (squat, bench, deadlift)" },
  { value: "very_experienced", label: "Very experienced, have trained through multiple programs" },
] as const;

export const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
export const toggleEquipment = toggleEquipmentValue;

/** Tapping a goal chip adds it to the text once; tapping again leaves it alone. */
export function addGoal(goals: string, chip: string): string {
  if (goals.toLowerCase().includes(chip.toLowerCase())) return goals;
  return goals.trim() ? `${goals.trim().replace(/[.\s]+$/, "")}. ${chip}` : chip;
}

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Returns a plain-language problem for the step, or null when the athlete can move on. */
export function validateIntakeStep(step: number, s: IntakeState): string | null {
  switch (step) {
    case 0:
      if (s.age !== "" && (!isNum(s.age) || Number(s.age) < 10 || Number(s.age) > 100)) return "Enter your age in years, or leave it blank.";
      return null;
    case 1:
      if (!isNum(s.yearsStructuredTraining)) return "Let us know your years of structured training (0 is fine).";
      if (s.yearsPlayingUltimate !== "" && !isNum(s.yearsPlayingUltimate)) return "Years playing ultimate should be a number.";
      if (!s.liftingExperience) return "Choose the option that best describes your lifting experience.";
      return null;
    case 2: {
      if (!s.seasonStart || !s.seasonEnd) return "Season start and end dates are required.";
      const p = validateScheduleForm({ season_start: s.seasonStart, season_end: s.seasonEnd, tournaments: s.tournaments, commitments: s.commitments });
      if (p) return p;
      if (!s.calendarConfirmed) return "Tell us whether your schedule is set yet.";
      return null;
    }
    case 3:
      if (!s.trainingDaysPerWeek) return "Choose how many days a week you want to train.";
      return null;
    case 4:
      if (s.equipment.length === 0) return "Select at least one piece of equipment.";
      if (!s.availableSpace) return "Choose how much space you have to move.";
      return null;
    case 5: {
      const nums: Array<[string, string, boolean]> = [
        ["bodyweight", s.bodyweightLb, s.bodyweightSkip],
        ["vertical jump", s.verticalJumpIn, false],
        ["pull-up max", s.pullupMaxReps, s.pullupSkip],
      ];
      for (const [name, v, skip] of nums) if (!skip && v !== "" && !isNum(v)) return `Your ${name} should be a number.`;
      const lifts: Array<[string, MaxEntry]> = [["back squat", s.backSquat], ["bench press", s.benchPress], ["deadlift", s.deadlift], ["power clean", s.powerClean]];
      for (const [name, m] of lifts) {
        if (m.skip) continue;
        const hasW = m.weight.trim() !== "";
        const hasR = m.reps.trim() !== "";
        if (hasW !== hasR) return `For ${name}, enter both weight and reps, or tap "I don't know".`;
        if (hasW && (!isNum(m.weight) || !isNum(m.reps))) return `Your ${name} should be numbers.`;
        if (hasR && Number(m.reps) < 1) return `Your ${name} reps should be at least 1.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** First step (0-based) with a problem, so Submit can send the athlete back to it. */
export function firstInvalidStep(s: IntakeState): number | null {
  for (let i = 0; i < TOTAL_STEPS; i++) if (validateIntakeStep(i, s)) return i;
  return null;
}

/** Body for POST /api/intake. Blank optional answers become null, skipped maxes are dropped. */
export function buildIntakePayload(athleteId: string, s: IntakeState) {
  const max = (m: MaxEntry) => (m.skip ? { w: null, r: null } : { w: num(m.weight), r: num(m.reps) });
  const sq = max(s.backSquat), bp = max(s.benchPress), dl = max(s.deadlift), pc = max(s.powerClean);
  return {
    athleteId,
    age: num(s.age),
    benchmark_set: s.benchmarkSet || null,
    years_playing_ultimate: num(s.yearsPlayingUltimate),
    years_structured_training: num(s.yearsStructuredTraining),
    lifting_experience_selfdescribe: s.liftingExperience || null,
    season_start: s.seasonStart,
    season_end: s.seasonEnd,
    recurring_commitments: s.commitments.map((c) => ({
      day_of_week: c.day_of_week,
      time: c.time,
      label: c.label.trim() || "League game",
      start_date: c.start_date || null,
      end_date: c.end_date || null,
    })),
    tournament_weekends: s.tournaments.map((t) => ({
      start_date: t.start_date,
      end_date: t.end_date,
      label: t.label,
      is_priority: t.is_priority,
    })),
    season_calendar_confirmed: s.calendarConfirmed === "yes",
    training_days_per_week: num(s.trainingDaysPerWeek),
    equipment: s.equipment,
    available_space: s.availableSpace,
    conditioning_modality: s.conditioningModality,
    bodyweight_lb: s.bodyweightSkip ? null : num(s.bodyweightLb),
    back_squat_weight: sq.w, back_squat_reps: sq.r,
    bench_press_weight: bp.w, bench_press_reps: bp.r,
    deadlift_weight: dl.w, deadlift_reps: dl.r,
    power_clean_weight: pc.w, power_clean_reps: pc.r,
    pullup_max_reps: s.pullupSkip ? null : num(s.pullupMaxReps),
    vertical_jump_in: num(s.verticalJumpIn),
    goals: s.goals,
    injuryReports: [
      ...s.currentInjuries.map((location) => ({ location, report_type: "current_active" })),
      ...s.injuryHistory.map((location) => ({ location, report_type: "history" })),
    ],
    catchallRestrictions: s.catchall.trim() ? [s.catchall.trim()] : [],
  };
}

/** Draft saved on the phone so closing the app mid-intake doesn't lose answers. */
export type IntakeDraft = { step: number; state: IntakeState };

export function parseDraft(raw: string | null): IntakeDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d.step !== "number" || typeof d.state !== "object" || !d.state) return null;
    // Merge over defaults so a draft saved by an older app version still loads.
    const state = { ...initialIntake(), ...d.state } as IntakeState;
    const step = Math.max(0, Math.min(TOTAL_STEPS - 1, Math.floor(d.step)));
    return { step, state };
  } catch {
    return null;
  }
}
