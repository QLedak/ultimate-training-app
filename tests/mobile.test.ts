/* Run: npx tsx tests/mobile.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyToAllSets, buildFinalPayload, buildSteps, initStates, logSet, logSupersetSet, updateSet,
} from "../mobile/src/workout/state";
import type { SessionExercise } from "../mobile/src/types";

// 1. The phone's copies of shared logic must match the web originals exactly.
const pairs: Array<[string, string]> = [
  ["lib/training/perceived-effort.ts", "mobile/src/shared/perceived-effort.ts"],
  ["lib/training/autoregulate.ts", "mobile/src/shared/autoregulate.ts"],
  ["lib/training/display-labels.ts", "mobile/src/shared/display-labels.ts"],
  ["lib/pps/parse-prescription.ts", "mobile/src/shared/parse-prescription.ts"],
];
for (const [a, b] of pairs) {
  assert.equal(readFileSync(b, "utf8"), readFileSync(a, "utf8"), `${b} is out of date - run: node mobile/scripts/sync-shared.js`);
}

function ex(id: string, o: Partial<SessionExercise> = {}): SessionExercise {
  return {
    exercise_id: id, exercise_name: id, cue: null, tier: 1, circuit_label: null, prescribed_target: "3x5 @ 100",
    prescribed_weight_hint: 100, tempo: null, rest: "90s", coach_notes: null, alternatives: [], warmup: [],
    logged: null, last_time: null, ...o,
  };
}

// 2. Init: set count, prefilled weight/reps.
const squat = ex("SQ");
let states = initStates([squat]);
assert.equal(states.SQ.sets.length, 3);
assert.equal(states.SQ.sets[0].weight, "100");
assert.equal(states.SQ.sets[0].reps, "5");

// 3. Logging a set: autoregulation + rest timer.
states = updateSet(states, "SQ", 0, { rir: "very_easy" });
let r = logSet(states, squat, 0, "build");
assert.equal(r.states.SQ.sets[0].logged, true);
assert.equal(r.states.SQ.sets[1].weight, "105");
assert.equal(r.restSeconds, 90);
r = logSet(r.states, squat, 2, "build");
assert.equal(r.restSeconds, null); // last set: no rest

// 4. Test week: no autoregulation.
const t = logSet(updateSet(states, "SQ", 0, { rir: "very_easy" }), squat, 0, "test");
assert.equal(t.states.SQ.sets[1].weight, "100");

// 5. Manual weights are never overwritten.
let m = updateSet(states, "SQ", 1, { weight: "120" });
m = updateSet(m, "SQ", 0, { rir: "very_easy" });
assert.equal(logSet(m, squat, 0, "build").states.SQ.sets[1].weight, "120");

// 6. Apply to all.
let a = updateSet(states, "SQ", 0, { weight: "135", reps: "4" });
a = applyToAllSets(a, "SQ");
assert.deepEqual(a.SQ.sets.map((s) => s.weight), ["135", "135", "135"]);

// 7. Supersets rest only after a full round.
const a1 = ex("A1", { circuit_label: "A1", tier: 2, prescribed_target: "2x8" });
const a2 = ex("A2", { circuit_label: "A2", tier: 2, prescribed_target: "2x8" });
const lone = ex("LONE", { circuit_label: "B1" });
const list = [a1, a2, lone];
const steps = buildSteps(list);
assert.deepEqual(steps.map((s) => s.kind), ["superset", "single"]);
let ss = initStates(list);
let s1 = logSupersetSet(ss, [a1, a2], a1, 0, "build");
assert.equal(s1.restSeconds, null);
s1 = logSupersetSet(s1.states, [a1, a2], a2, 0, "build");
assert.equal(s1.restSeconds, 90);
s1 = logSupersetSet(s1.states, [a1, a2], a1, 1, "build");
s1 = logSupersetSet(s1.states, [a1, a2], a2, 1, "build");
assert.equal(s1.restSeconds, null); // group finished

// 8. Final payload shape matches what the server expects.
const fin = buildFinalPayload(list, s1.states);
assert.equal(fin.exercises.length, 2);
assert.equal(fin.anySkipped, true); // LONE never logged
assert.equal(fin.exercises[0].set_results?.[0].rir, 3); // "moderate" => RIR 3
assert.equal(fin.exercises[0].set_results?.[0].set_number, 1);

console.log("mobile logic tests passed");
