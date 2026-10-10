/**
 * Pure (no React Native) logic for the guided workout, ported 1:1 from the web
 * logger (app/app/log/[sessionId]/page.tsx) so both front ends build exactly
 * the payload the server expects. Kept free of UI imports so it can be unit
 * tested from the web repo's test runner.
 */
import { parsePrescribedTarget, parseRestSeconds, parseTimedTarget } from "../shared/parse-prescription";
import { suggestNextWeight } from "../shared/autoregulate";
import { effortToRir, rirToEffort } from "../shared/perceived-effort";
import { isSupersetLabel, supersetGroupKey } from "../shared/display-labels";
import type {
  ExercisePayload,
  GuidedExerciseState,
  GuidedSetState,
  SessionExercise,
  SetResult,
} from "../types";

export type WeekType = "build" | "deload" | "test";
export type Step = { kind: "single" | "superset"; exerciseIndexes: number[] };
export type States = Record<string, GuidedExerciseState>;

export function defaultSetCount(exercise: SessionExercise): number {
  const parsed = parsePrescribedTarget(exercise.prescribed_target ?? "");
  if (parsed.sets) return parsed.sets;
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");
  if (timed?.sets) return timed.sets;
  return exercise.tier === 3 ? 1 : 3;
}

export function blankSet(): GuidedSetState {
  return { weight: "", reps: "", rir: "moderate", logged: false, autoSuggested: false };
}

export function initExerciseState(exercise: SessionExercise): GuidedExerciseState {
  const priorSets = exercise.logged?.set_results;
  const targetInfo = parsePrescribedTarget(exercise.prescribed_target ?? "");
  const count = priorSets?.length || defaultSetCount(exercise);

  const sets: GuidedSetState[] = [];
  for (let i = 0; i < count; i++) {
    const prior = priorSets?.[i];
    if (prior) {
      sets.push({
        weight: prior.weight_used != null ? String(prior.weight_used) : "",
        reps: prior.reps_completed != null ? String(prior.reps_completed) : "",
        rir: rirToEffort(prior.rir),
        logged: true,
      });
    } else {
      const s = blankSet();
      s.weight =
        exercise.prescribed_weight_hint != null
          ? String(exercise.prescribed_weight_hint)
          : exercise.last_time?.weight_used != null
          ? String(exercise.last_time.weight_used)
          : "";
      // Timed holds store the seconds held in `reps`, so never prefill them.
      const isTimed = parseTimedTarget(exercise.prescribed_target ?? "") != null;
      s.reps = !isTimed && targetInfo.minReps != null ? String(targetInfo.minReps) : "";
      sets.push(s);
    }
  }

  return {
    sets,
    substituted: !!exercise.logged?.substituted_exercise_id,
    substitutedExerciseId: exercise.logged?.substituted_exercise_id ?? "",
    substitutionReason: exercise.logged?.substitution_reason ?? "",
    isTrueMax: false,
    notes: exercise.logged?.notes ?? "",
    loadDescriptor: exercise.logged?.load_descriptor ?? "",
    skipped: false,
    doneIndex: sets.filter((s) => s.logged).length,
  };
}

export function initStates(exercises: SessionExercise[], saved?: States | null): States {
  const out: States = {};
  for (const ex of exercises) out[ex.exercise_id] = saved?.[ex.exercise_id] ?? initExerciseState(ex);
  return out;
}

export function buildSteps(exercises: SessionExercise[]): Step[] {
  const steps: Step[] = [];
  let i = 0;
  while (i < exercises.length) {
    const label = exercises[i].circuit_label;
    if (isSupersetLabel(label)) {
      const key = supersetGroupKey(label);
      const group = [i];
      let j = i + 1;
      while (
        j < exercises.length &&
        isSupersetLabel(exercises[j].circuit_label) &&
        supersetGroupKey(exercises[j].circuit_label as string) === key
      ) {
        group.push(j);
        j++;
      }
      if (group.length > 1) {
        steps.push({ kind: "superset", exerciseIndexes: group });
        i = j;
        continue;
      }
    }
    steps.push({ kind: "single", exerciseIndexes: [i] });
    i++;
  }
  return steps;
}

export function updateExercise(states: States, id: string, patch: Partial<GuidedExerciseState>): States {
  return { ...states, [id]: { ...states[id], ...patch } };
}

export function updateSet(states: States, id: string, setIndex: number, patch: Partial<GuidedSetState>): States {
  const current = states[id];
  const sets = current.sets.map((s, i) => {
    if (i !== setIndex) return s;
    const merged = { ...s, ...patch };
    // Typing a weight by hand overrides any auto-suggestion.
    if ("weight" in patch && !("autoSuggested" in patch)) {
      merged.autoSuggested = false;
      merged.manualWeight = true;
    }
    return merged;
  });
  return { ...states, [id]: { ...current, sets } };
}

export function addSet(states: States, id: string): States {
  return updateExercise(states, id, { sets: [...states[id].sets, blankSet()] });
}

export function removeSet(states: States, id: string, setIndex: number): States {
  return updateExercise(states, id, { sets: states[id].sets.filter((_, i) => i !== setIndex) });
}

/** Copy the first unlogged set's weight/reps onto every other unlogged set. */
export function applyToAllSets(states: States, id: string): States {
  const current = states[id];
  const template = current.sets.find((s) => !s.logged);
  if (!template) return states;
  return updateExercise(states, id, {
    sets: current.sets.map((s) => {
      if (s.logged || s === template) return s;
      return {
        ...s,
        weight: template.weight !== "" ? template.weight : s.weight,
        reps: template.reps !== "" ? template.reps : s.reps,
        autoSuggested: false,
        manualWeight: template.weight !== "" ? true : s.manualWeight,
      };
    }),
  });
}

export function canLogSet(tier: 1 | 2 | 3, set: GuidedSetState, timedSeconds: number | null): boolean {
  if (timedSeconds != null) return !!set.reps;
  if (tier === 1) return !!(set.weight && set.reps && set.rir);
  if (tier === 2) return !!set.rir;
  return true;
}

export type LogResult = { states: States; restSeconds: number | null };

export function logSet(
  states: States,
  exercise: SessionExercise,
  setIndex: number,
  weekType: WeekType,
  opts: { skipRest?: boolean } = {}
): LogResult {
  const id = exercise.exercise_id;
  const exState = states[id];
  const loggedSet = exState.sets[setIndex];
  let next = updateSet(states, id, setIndex, { logged: true });
  next = updateExercise(next, id, { doneIndex: Math.max(exState.doneIndex, setIndex + 1) });

  const isLastSetOfExercise = setIndex === exState.sets.length - 1;

  // Tier 3 has no effort rating, and test weeks / true-max attempts chase a
  // ceiling, so the athlete drives the weight there.
  const eligible = exercise.tier !== 3 && weekType !== "test" && !exState.isTrueMax;
  if (eligible && !isLastSetOfExercise) {
    const priorWeight = parseFloat(loggedSet.weight);
    const suggestion = !Number.isNaN(priorWeight) && priorWeight > 0 ? suggestNextWeight(priorWeight, loggedSet.rir) : null;
    const nextSet = exState.sets[setIndex + 1];
    if (suggestion && nextSet && !nextSet.logged && !nextSet.manualWeight) {
      next = updateSet(next, id, setIndex + 1, { weight: String(suggestion.weight), autoSuggested: true });
    }
  }

  const restSeconds = !opts.skipRest && !isLastSetOfExercise ? parseRestSeconds(exercise.rest) ?? 60 : null;
  return { states: next, restSeconds };
}

/** A superset rests once per full round, not after each exercise's set. */
export function logSupersetSet(
  states: States,
  group: SessionExercise[],
  exercise: SessionExercise,
  setIndex: number,
  weekType: WeekType
): LogResult {
  const { states: next } = logSet(states, exercise, setIndex, weekType, { skipRest: true });
  const roundComplete = group.every((g) => next[g.exercise_id].doneIndex >= setIndex + 1);
  const groupFullyDone = group.every((g) => next[g.exercise_id].doneIndex >= next[g.exercise_id].sets.length);
  const restSeconds = roundComplete && !groupFullyDone ? parseRestSeconds(exercise.rest) ?? 60 : null;
  return { states: next, restSeconds };
}

export function buildFinalPayload(
  exercises: SessionExercise[],
  states: States
): { exercises: ExercisePayload[]; anySkipped: boolean } {
  const payload: ExercisePayload[] = [];
  let anySkipped = false;
  for (const ex of exercises) {
    const s = states[ex.exercise_id];
    if (!s || s.skipped) {
      if (s?.skipped) anySkipped = true;
      continue;
    }
    const loggedSets = s.sets.filter((set) => set.logged);
    if (loggedSets.length === 0) {
      anySkipped = true;
      continue;
    }
    const setResults: SetResult[] = loggedSets.map((set, i) => ({
      set_number: i + 1,
      weight_used: set.weight ? Number(set.weight) : null,
      reps_completed: set.reps ? Number(set.reps) : null,
      rir: effortToRir(set.rir),
    }));
    payload.push({
      exercise_id: ex.exercise_id,
      substituted_exercise_id: s.substituted ? s.substitutedExerciseId || null : null,
      substitution_reason: s.substituted ? s.substitutionReason : null,
      notes: s.notes || null,
      load_descriptor: s.loadDescriptor || null,
      is_true_max: s.isTrueMax,
      set_results: setResults,
    });
  }
  return { exercises: payload, anySkipped };
}

export function formatClock(total: number): string {
  const t = Math.max(0, Math.floor(total));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** +/- stepper for the weight and reps boxes; never below zero, no trailing zeros. */
export function stepValue(current: string, delta: number): string {
  const v = parseFloat(current);
  const base = Number.isFinite(v) ? v : 0;
  const next = Math.max(0, Math.round((base + delta) * 100) / 100);
  return String(next);
}

/** Index of the first set not yet logged, or null when every set is logged. */
export function firstUnloggedIndex(sets: { logged: boolean }[]): number | null {
  const i = sets.findIndex((s) => !s.logged);
  return i === -1 ? null : i;
}
