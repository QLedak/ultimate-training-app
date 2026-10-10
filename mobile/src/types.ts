import type { EffortLevel } from "./shared/perceived-effort";

export type Athlete = { id: string; email: string; name: string | null };

export type SessionSummary = {
  id: string;
  date: string;
  week_number: number;
  day_label: string;
  week_type: "build" | "deload" | "test";
  exercise_count: number;
  status: "completed" | "partially_completed" | "skipped" | null;
};

export type SetResult = { set_number: number; weight_used: number | null; reps_completed: number | null; rir: number | null };

export type SessionExercise = {
  exercise_id: string;
  exercise_name: string;
  cue: string | null;
  tier: 1 | 2 | 3;
  circuit_label: string | null;
  prescribed_target: string | null;
  prescribed_weight_hint: number | null;
  tempo: string | null;
  rest: string | null;
  coach_notes: string | null;
  alternatives: Array<{ exercise_id: string; exercise_name: string; uses_dumbbells?: boolean }>;
  uses_dumbbells?: boolean;
  active_injury_locations?: string[];
  warmup: Array<{ sets_reps: string; suggested_weight: number }>;
  logged: {
    weight_used: number | null;
    reps_completed: number | null;
    sets_completed: number | null;
    rir: number | null;
    substituted_exercise_id: string | null;
    substitution_reason: string | null;
    load_descriptor: string | null;
    notes: string | null;
    set_results: SetResult[] | null;
  } | null;
  last_time: {
    weight_used: number | null;
    reps_completed: number | null;
    load_descriptor: string | null;
    notes?: string | null;
    date: string | null;
  } | null;
};

export type SessionDetail = {
  session: { id: string; date: string; phase_id: string | null; week_number: number; day_label: string; week_type: "build" | "deload" | "test" };
  session_log: {
    status: "completed" | "partially_completed" | "skipped";
    skip_reason: string | null;
    skip_reason_other_text: string | null;
    overall_notes: string | null;
  } | null;
  exercises: SessionExercise[];
};

export type ExercisePayload = {
  exercise_id: string;
  substituted_exercise_id?: string | null;
  substitution_reason?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  sets_completed?: number | null;
  rir?: number | null;
  load_descriptor?: string | null;
  notes?: string | null;
  is_true_max?: boolean;
  set_results?: SetResult[];
};

export type SubmitPayload = {
  status: "completed" | "partially_completed" | "skipped";
  skip_reason?: string | null;
  skip_reason_other_text?: string | null;
  overall_notes?: string | null;
  exercises: ExercisePayload[];
};

export type GuidedSetState = {
  weight: string;
  reps: string;
  rir: EffortLevel | "";
  logged: boolean;
  autoSuggested?: boolean;
  manualWeight?: boolean;
};

export type GuidedExerciseState = {
  sets: GuidedSetState[];
  substituted: boolean;
  substitutedExerciseId: string;
  substitutionReason: string;
  isTrueMax: boolean;
  notes: string;
  loadDescriptor: string;
  skipped: boolean;
  doneIndex: number;
};

export type GuidedProgress = { stepIndex: number; states: Record<string, GuidedExerciseState> };

export type TestDef = { key: string; label: string; unit: string; weeks: number[] };
export type PurchaseRow = {
  id: string;
  product_id: string;
  start_date: string;
  total_sessions: number;
  logged_sessions: number;
  end_date: string | null;
  product: { title: string; week_count: number; days_per_week: number; tests: TestDef[] } | null;
  next_session: { id: string; date: string; week_number: number; day_label: string } | null;
  tests: Array<{ test_key: string; week_number: number; value: number }>;
};

export type HistorySet = { weight: number | null; reps: number | null; rir: number | null };
export type HistoryEntry = {
  date: string;
  session_id: string;
  sets: HistorySet[];
  top_weight: number | null;
  best_est_1rm: number | null;
  volume: number;
  is_pr: boolean;
};
export type ExerciseHistory = {
  exercise_id: string;
  exercise_name: string;
  summary: {
    total_sessions: number;
    best_est_1rm: { value: number; date: string } | null;
    heaviest: { weight: number; reps: number | null; date: string } | null;
  };
  entries: HistoryEntry[]; // newest first
};
export type ExerciseListItem = {
  exercise_id: string;
  exercise_name: string;
  times_logged: number;
  last_date: string | null;
  best_est_1rm: number | null;
  heaviest_weight: number | null;
};
export type Phase = {
  id: string;
  phase_number: number;
  phase_name: string;
  goal: string;
  start_date: string;
  end_date: string;
  week_count: number;
  status: "upcoming" | "active" | "completed" | "superseded";
};
