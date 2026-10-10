/**
 * Per-exercise history for the Progress screens. Pure functions only (no DB),
 * so the maths is unit tested; the API routes just fetch rows and call these.
 * Estimated 1RM always uses the shared Epley formula (lib/training/epley.ts).
 */
import { epley1RM } from "./epley";

export type SetResultRow = { set_number?: number; weight_used: number | null; reps_completed: number | null; rir: number | null };

export type HistoryRow = {
  session_id: string;
  date: string;
  exercise_id: string;
  substituted_exercise_id: string | null;
  weight_used: number | null;
  reps_completed: number | null;
  sets_completed: number | null;
  rir: number | null;
  est_1rm: number | null;
  set_results: SetResultRow[] | null;
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

export type HistorySummary = {
  total_sessions: number;
  best_est_1rm: { value: number; date: string } | null;
  heaviest: { weight: number; reps: number | null; date: string } | null;
};

/** Epley is unreliable far past ~12 reps, so those sets never set an estimate. */
const MAX_REPS_FOR_ESTIMATE = 12;

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** The exercise a row counts toward: what the athlete actually did. */
export function effectiveExerciseId(row: { exercise_id: string; substituted_exercise_id: string | null }): string {
  return row.substituted_exercise_id || row.exercise_id;
}

export function rowSets(row: HistoryRow): HistorySet[] {
  if (Array.isArray(row.set_results) && row.set_results.length > 0) {
    return row.set_results.map((s) => ({ weight: num(s.weight_used), reps: num(s.reps_completed), rir: num(s.rir) }));
  }
  const weight = num(row.weight_used);
  const reps = num(row.reps_completed);
  if (weight == null && reps == null) return [];
  const count = Math.max(1, num(row.sets_completed) ?? 1);
  return Array.from({ length: count }, () => ({ weight, reps, rir: num(row.rir) }));
}

function setEst(s: HistorySet): number | null {
  if (s.weight == null || s.weight <= 0 || s.reps == null || s.reps <= 0 || s.reps > MAX_REPS_FOR_ESTIMATE) return null;
  return epley1RM(s.weight, s.reps);
}

/** One entry per session date, oldest first, with PR flags (new best estimated 1RM). */
export function buildEntries(rows: HistoryRow[]): HistoryEntry[] {
  const bySession = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r);
    bySession.set(r.session_id, list);
  }

  const entries: HistoryEntry[] = [];
  for (const list of Array.from(bySession.values())) {
    const sets = list.flatMap(rowSets);
    if (sets.length === 0) continue;
    const weights = sets.map((s) => s.weight).filter((w): w is number => w != null && w > 0);
    const ests = sets.map(setEst).filter((e): e is number => e != null);
    const stored = list.map((r) => num(r.est_1rm)).filter((e): e is number => e != null && e > 0);
    const best = ests.length ? Math.max(...ests) : stored.length ? Math.max(...stored) : null;
    entries.push({
      date: list[0].date,
      session_id: list[0].session_id,
      sets,
      top_weight: weights.length ? Math.max(...weights) : null,
      best_est_1rm: best != null ? round1(best) : null,
      volume: Math.round(sets.reduce((sum, s) => sum + (s.weight && s.reps ? s.weight * s.reps : 0), 0)),
      is_pr: false,
    });
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.session_id < b.session_id ? -1 : 1));
  let bestSoFar = 0;
  for (const e of entries) {
    if (e.best_est_1rm != null && e.best_est_1rm > bestSoFar) {
      e.is_pr = bestSoFar > 0; // the very first entry is a baseline, not a "PR"
      bestSoFar = e.best_est_1rm;
    }
  }
  return entries;
}

export function summarize(entries: HistoryEntry[]): HistorySummary {
  let best: HistorySummary["best_est_1rm"] = null;
  let heaviest: HistorySummary["heaviest"] = null;
  for (const e of entries) {
    if (e.best_est_1rm != null && (!best || e.best_est_1rm > best.value)) best = { value: e.best_est_1rm, date: e.date };
    for (const s of e.sets) {
      if (s.weight != null && s.weight > 0 && (!heaviest || s.weight > heaviest.weight)) {
        heaviest = { weight: s.weight, reps: s.reps, date: e.date };
      }
    }
  }
  return { total_sessions: entries.length, best_est_1rm: best, heaviest };
}
