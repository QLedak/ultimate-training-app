/* Run: npx tsx tests/history.test.ts */
import assert from "node:assert/strict";
import { buildEntries, effectiveExerciseId, rowSets, summarize, type HistoryRow } from "../lib/training/history";

function row(o: Partial<HistoryRow> & { session_id: string; date: string }): HistoryRow {
  return { exercise_id: "BP-001", substituted_exercise_id: null, weight_used: null, reps_completed: null, sets_completed: null, rir: null, est_1rm: null, set_results: null, ...o };
}

// Per-set results beat the single summary row.
const guided = row({ session_id: "a", date: "2026-09-01", set_results: [
  { weight_used: 200, reps_completed: 5, rir: 3 }, { weight_used: 205, reps_completed: 5, rir: 2 },
] });
assert.equal(rowSets(guided).length, 2);

// Manual (non-guided) rows expand to sets_completed identical sets.
const manual = row({ session_id: "b", date: "2026-09-08", weight_used: 210, reps_completed: 5, sets_completed: 3 });
assert.equal(rowSets(manual).length, 3);

// Entries: sorted by date, estimates via Epley, PR only after a baseline.
const third = row({ session_id: "c", date: "2026-09-15", weight_used: 205, reps_completed: 5, sets_completed: 3 });
const entries = buildEntries([third, manual, guided]);
assert.deepEqual(entries.map((e) => e.date), ["2026-09-01", "2026-09-08", "2026-09-15"]);
assert.equal(entries[0].best_est_1rm, 239.2); // 205 x 5 -> 205 * (1 + 5/30)
assert.equal(entries[0].top_weight, 205);
assert.equal(entries[0].is_pr, false); // baseline
assert.equal(entries[1].is_pr, true); // 210 x 5 beats it
assert.equal(entries[2].is_pr, false); // 205 x 5 does not
assert.equal(entries[0].volume, 200 * 5 + 205 * 5);

// High-rep sets never set an estimate; stored est_1rm is the fallback.
const high = buildEntries([row({ session_id: "d", date: "2026-10-01", weight_used: 100, reps_completed: 20, sets_completed: 1, est_1rm: 150 })]);
assert.equal(high[0].best_est_1rm, 150);
const none = buildEntries([row({ session_id: "e", date: "2026-10-02", weight_used: 100, reps_completed: 20, sets_completed: 1 })]);
assert.equal(none[0].best_est_1rm, null);

// Bodyweight/blank rows produce no entry.
assert.equal(buildEntries([row({ session_id: "f", date: "2026-10-03" })]).length, 0);

// Summary.
const s = summarize(entries);
assert.equal(s.total_sessions, 3);
assert.equal(s.best_est_1rm?.date, "2026-09-08");
assert.deepEqual(s.heaviest, { weight: 210, reps: 5, date: "2026-09-08" });

// Swaps count toward what was actually done.
assert.equal(effectiveExerciseId({ exercise_id: "BP-001", substituted_exercise_id: "DB-009" }), "DB-009");
assert.equal(effectiveExerciseId({ exercise_id: "BP-001", substituted_exercise_id: null }), "BP-001");

console.log("history tests passed");
