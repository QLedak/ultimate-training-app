/* Run: npx tsx tests/mobile.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyToAllSets, buildFinalPayload, buildSteps, effectiveOf, firstUnloggedIndex, initStates, logSet, logSupersetSet, stepValue, swapPatch, updateSet, updateExercise,
} from "../mobile/src/workout/state";
import { parseTimedTarget } from "../mobile/src/shared/parse-prescription";
import { currentPhaseInfo } from "../mobile/src/lib/phase";
import { workoutIcon } from "../mobile/src/lib/workoutIcons";
import { addMonthsStr, monthGridWeeks, monthTitle, startOfMonthStr } from "../mobile/src/lib/dates";
import { matchesSearch } from "../mobile/src/lib/search";
import {
  blankCommitment, commitmentsPayload, fromHHMM, fromIso, isGameLabel, normalizeCommitments, prettyTime, setPriorityTournament, toHHMM, toIso, validateScheduleForm,
} from "../mobile/src/lib/schedule.core";
import { planReminders, formatReminderTime, clampTime, MAX_REMINDERS } from "../mobile/src/lib/reminders.core";
import { createQueue, type PendingLog } from "../mobile/src/lib/pendingLogs.core";
import type { SessionExercise, SubmitPayload } from "../mobile/src/types";

// 1. The phone's copies of shared logic must match the web originals exactly.
const pairs: Array<[string, string]> = [
  ["lib/training/perceived-effort.ts", "mobile/src/shared/perceived-effort.ts"],
  ["lib/training/autoregulate.ts", "mobile/src/shared/autoregulate.ts"],
  ["lib/training/display-labels.ts", "mobile/src/shared/display-labels.ts"],
  ["lib/pps/parse-prescription.ts", "mobile/src/shared/parse-prescription.ts"],
  ["lib/training/equipment-options.ts", "mobile/src/shared/equipment-options.ts"],
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

// 9. Steppers and active-set helpers.
assert.equal(stepValue("200", 5), "205");
assert.equal(stepValue("", 5), "5");
assert.equal(stepValue("2", -5), "0"); // never negative
assert.equal(stepValue("102.5", 2.5), "105");
assert.equal(firstUnloggedIndex([{ logged: true }, { logged: false }]), 1);
assert.equal(firstUnloggedIndex([{ logged: true }]), null);

// 10. Phase outline: active phase, week-of-phase, clamping, superseded ignored.
const ph = (n: number, status: any, start: string, end: string, weeks: number) =>
  ({ id: `p${n}`, phase_number: n, phase_name: `Phase ${n}`, goal: "x", start_date: start, end_date: end, week_count: weeks, status });
const phases = [ph(1, "completed", "2026-06-01", "2026-06-28", 4), ph(2, "active", "2026-06-29", "2026-08-09", 6), ph(3, "upcoming", "2026-08-10", "2026-09-06", 4), ph(9, "superseded", "2026-06-29", "2026-07-05", 1)];
let info = currentPhaseInfo(phases as any, "2026-07-14");
assert.equal(info?.active.phase_number, 2);
assert.equal(info?.index, 1);
assert.equal(info?.phases.length, 3);
assert.equal(info?.weekOfPhase, 3); // Jun 29 + 15 days -> week 3
info = currentPhaseInfo(phases as any, "2026-12-01");
assert.equal(info?.weekOfPhase, 6); // clamped to the phase length
assert.equal(currentPhaseInfo([], "2026-07-14"), null);
assert.equal(currentPhaseInfo([ph(1, "upcoming", "2027-01-01", "2027-02-01", 4)] as any, "2026-07-14"), null);

// 11. Workout icons match the website's rules (+ sprint days).
assert.equal(workoutIcon("Lower Body Power").icon, "💥");
assert.equal(workoutIcon("Lower Strength").icon, "🦵");
assert.equal(workoutIcon("Upper Strength 2").icon, "💪");
assert.equal(workoutIcon("Athlete Day").icon, "⚡");
assert.equal(workoutIcon("Energy Systems").icon, "🔥");
assert.equal(workoutIcon("Sprint Day").icon, "🏃");
assert.equal(workoutIcon("Something new").icon, "🏋️");

// 12. Month grid: whole Sun-Sat weeks covering the month.
const oct = monthGridWeeks("2026-10-15");
assert.equal(oct[0][0], "2026-09-27"); // Oct 1 2026 is a Thursday
assert.equal(oct[oct.length - 1][6], "2026-10-31");
assert.ok(oct.every((w) => w.length === 7));
assert.equal(oct.length, 5);
assert.equal(startOfMonthStr("2026-10-15"), "2026-10-01");
assert.equal(addMonthsStr("2026-12-20", 1), "2027-01-01");
assert.equal(addMonthsStr("2026-01-31", -1), "2025-12-01");
assert.equal(monthTitle("2026-10-15"), "October 2026");
assert.equal(monthGridWeeks("2026-02-10").length, 4); // Feb 2026 starts on a Sunday and has 28 days
assert.equal(monthGridWeeks("2027-02-10").length, 5);


// Timed holds start at the prescribed time (the countdown never rewrites it)
const plank = ex("PL", { tier: 2, prescribed_target: "3x20s/side", prescribed_weight_hint: null, exercise_name: "Plank",
  alternatives: [{ exercise_id: "DIP", exercise_name: "Copenhagen Dip", tier: 2, uses_weight: false, prescribed_target: "3x8" }] });
let ps = initStates([plank]);
assert.equal(ps.PL.sets.length, 3);
assert.equal(ps.PL.sets[0].reps, "20", "timed sets are pre-filled with the prescribed seconds");
assert.equal(effectiveOf(plank, ps.PL).timedSeconds, 20);

// Swapping rewrites the unlogged sets to fit the new exercise; logged sets are untouched
ps = { PL: { ...ps.PL, sets: ps.PL.sets.map((x, i) => (i === 0 ? { ...x, logged: true, reps: "22" } : x)) } };
ps = updateExercise(ps, "PL", swapPatch(plank, ps.PL, "DIP"));
assert.equal(effectiveOf(plank, ps.PL).target, "3x8");
assert.equal(effectiveOf(plank, ps.PL).timedSeconds, null, "swapped to a rep exercise: no timer");
assert.equal(ps.PL.sets[0].reps, "22", "logged set kept");
assert.equal(ps.PL.sets[1].reps, "8", "unlogged sets follow the new prescription");
ps = updateExercise(ps, "PL", swapPatch(plank, ps.PL, null));
assert.equal(ps.PL.sets[1].reps, "20", "swapping back restores the original");

// Tempo work gets no embedded timer even if the text contains a duration
const tempoEx = ex("BP", { tier: 1, prescribed_target: "3x8, 3s down, 3s up", tempo: "3-0-3" });
assert.equal(effectiveOf(tempoEx, null).timedSeconds, null);
assert.equal(initStates([tempoEx]).BP.sets[0].reps, "8");
assert.equal(effectiveOf(ex("T2", { tier: 2, prescribed_target: "3x30s", tempo: "3-0-3" }), null).timedSeconds, null, "a tempo field always wins");

// Any loaded exercise can take a weight, even tier 3 (e.g. a dumbbell calf raise)
const calf = ex("HY-033", { tier: 3, prescribed_target: "3x12/side", prescribed_weight_hint: null, uses_weight: true, uses_dumbbells: true });
assert.equal(effectiveOf(calf, null).usesWeight, true);
assert.equal(effectiveOf(ex("BS", { tier: 3, uses_weight: false, prescribed_weight_hint: null }), null).usesWeight, false);
let cs = initStates([calf]);
cs = updateSet(cs, "HY-033", 0, { weight: "35" });
cs = logSet(cs, calf, 0, "build").states;
assert.equal(buildFinalPayload([calf], cs).exercises[0].set_results![0].weight_used, 35);

// A swap needs no typed reason
{
  const sw = ex("SQ2", { alternatives: [{ exercise_id: "GS", exercise_name: "Goblet Squat", tier: 1, uses_weight: true, prescribed_target: "3x5" }] });
  let ss = initStates([sw]);
  ss = updateExercise(ss, "SQ2", swapPatch(sw, ss.SQ2, "GS"));
  ss = logSet(ss, sw, 0, "build").states;
  const pl = buildFinalPayload([sw], ss).exercises[0];
  assert.equal(pl.substituted_exercise_id, "GS");
  assert.ok(pl.substitution_reason, "reason defaults so older servers accept the log");
}

// Tempo cues are not timed holds
assert.equal(parseTimedTarget("3x8, 3s down, 3s up"), null);
assert.equal(parseTimedTarget("3x10 (4 sec lowering)"), null);
assert.equal(parseTimedTarget("3x6 pause 2 sec at bottom"), null);
assert.equal(parseTimedTarget("3x8 tempo: 3 sec"), null);
assert.equal(parseTimedTarget("3x30s")?.seconds, 30, "real holds still time");
assert.equal(parseTimedTarget("3x20s/side")?.seconds, 20);
assert.equal(parseTimedTarget("Hold 45 sec x3")?.seconds, 45);

// Workout reminders
{
  const settings = { enabled: true, hour: 17, minute: 30 };
  const sess = (date: string, label: string, status: any = null) => ({ date, day_label: label, exercise_count: 6, status });
  const now = new Date(2026, 9, 10, 9, 0); // Oct 10 2026, 9:00 local
  const plan = planReminders(
    [sess("2026-10-09", "Past day"), sess("2026-10-10", "Lower Strength"), sess("2026-10-11", "Upper", "completed"), sess("2026-10-12", "Athlete Day"), sess("2026-10-12", "Core")],
    settings, now
  );
  assert.deepEqual(plan.map((p) => p.date), ["2026-10-10", "2026-10-12"], "past and already-logged days get no reminder");
  assert.equal(plan[0].fireAt.getHours(), 17);
  assert.equal(plan[0].fireAt.getMinutes(), 30);
  assert.equal(plan[0].title, "Workout today: Lower Strength");
  assert.equal(plan[1].title, "2 workouts today", "two sessions on one day make one reminder");
  assert.equal(planReminders([sess("2026-10-10", "Lower")], { ...settings, hour: 8 }, now).length, 0, "time already passed today");
  assert.equal(planReminders([sess("2026-10-12", "Lower")], { ...settings, enabled: false }, now).length, 0, "off means none");
  assert.equal(planReminders([sess("2026-10-12", "Lower", "skipped")], settings, now).length, 0, "skipped days are done");
  const many = Array.from({ length: 50 }, (_, i) => sess(`2026-11-${String((i % 28) + 1).padStart(2, "0")}`, "x" + i));
  assert.ok(planReminders(many, settings, now).length <= MAX_REMINDERS);
  assert.equal(formatReminderTime(17, 5), "5:05 PM");
  assert.equal(formatReminderTime(0, 0), "12:00 AM");
  assert.equal(formatReminderTime(12, 0), "12:00 PM");
  assert.deepEqual(clampTime(25, -3), { hour: 23, minute: 0 });
}

// Progress search
assert.equal(matchesSearch("Barbell Bench Press", "bench"), true);
assert.equal(matchesSearch("Barbell Bench Press", "BARB press"), true, "every word must match, any order, any case");
assert.equal(matchesSearch("Barbell Bench Press", "squat"), false);
assert.equal(matchesSearch("Barbell Bench Press", "  "), true, "empty search shows everything");

// Season schedule helpers
{
  const ok = { season_start: "2026-03-01", season_end: "2026-09-30", tournaments: [], commitments: [] as any[] };
  assert.equal(validateScheduleForm(ok), null);
  assert.ok(validateScheduleForm({ ...ok, season_end: "2026-02-01" }));
  assert.ok(validateScheduleForm({ ...ok, season_start: "" }));
  assert.ok(validateScheduleForm({ ...ok, tournaments: [{ start_date: "2026-05-02", end_date: "", label: "", is_priority: false }] }));
  assert.ok(validateScheduleForm({ ...ok, tournaments: [{ start_date: "2026-05-03", end_date: "2026-05-02", label: "", is_priority: false }] }));
  assert.ok(validateScheduleForm({ ...ok, commitments: [blankCommitment()] }), "a weekly commitment needs a day");
  assert.equal(validateScheduleForm({ ...ok, commitments: [{ ...blankCommitment(), day_of_week: "Tuesday" }] }), null);

  const t = [{ start_date: "a", end_date: "b", label: "x", is_priority: true }, { start_date: "c", end_date: "d", label: "y", is_priority: false }];
  assert.deepEqual(setPriorityTournament(t, 1).map((x) => x.is_priority), [false, true], "only one priority event");
  assert.deepEqual(setPriorityTournament(setPriorityTournament(t, 1), 1).map((x) => x.is_priority), [false, false], "tap again to clear");

  assert.equal(isGameLabel("League night"), true);
  assert.equal(isGameLabel("Team practice"), false);
  const norm = normalizeCommitments([{ day_of_week: "Tuesday", time: "19:00", label: "League game", startDate: "2026-04-01", endDate: "2026-06-01" }]);
  assert.equal(norm[0].start_date, "2026-04-01", "camelCase rows from older saves are read");
  const payload = commitmentsPayload([{ day_of_week: "Tuesday", time: "", label: " ", start_date: "", end_date: "" }]);
  assert.deepEqual(payload[0], { day_of_week: "Tuesday", time: "", label: "League game", start_date: null, end_date: null });

  assert.equal(toIso(fromIso("2026-10-11")!), "2026-10-11", "dates round-trip without drifting a day");
  assert.equal(toHHMM(fromHHMM("19:05")!), "19:05");
  assert.equal(prettyTime("19:05"), "7:05 PM");
  assert.equal(fromIso("nope"), null);
}

// Offline log queue
async function queueTests() {
  const payload = (n: number) => ({ status: "completed", exercises: [], n }) as unknown as SubmitPayload;
  const err = (status: number, message = "x") => Object.assign(new Error(message), { status });
  let disk: PendingLog[] = [];
  const store = { read: async () => disk.map((d) => ({ ...d })), write: async (i: PendingLog[]) => { disk = i.map((d) => ({ ...d })); } };
  const sent: string[] = [];
  let mode: "offline" | "online" | "reject" = "offline";
  const q = createQueue(store, async (id) => {
    if (mode === "offline") throw err(0);
    if (mode === "reject" && id === "a") throw err(403, "Not allowed");
    sent.push(id);
  }, () => "2026-10-10T12:00:00Z");

  await q.enqueue("a", payload(1));
  await q.enqueue("b", payload(2));
  await q.enqueue("a", payload(3)); // re-finishing the same session replaces the earlier copy
  assert.equal((await q.list()).length, 2);
  assert.equal(await q.has("a"), true);

  let r = await q.flush();
  assert.deepEqual(r, { synced: 0, waiting: 2, rejected: 0 }, "offline keeps everything");
  assert.equal((await q.list()).length, 2);

  mode = "reject";
  r = await q.flush();
  assert.deepEqual(r, { synced: 1, waiting: 0, rejected: 1 }, "one rejection doesn't block the next log");
  const left = await q.list();
  assert.equal(left.length, 1);
  assert.equal(left[0].sessionId, "a");
  assert.equal(left[0].lastError, "Not allowed", "a rejected log is kept with its reason, not dropped");

  mode = "online";
  r = await q.flush();
  assert.deepEqual(r, { synced: 1, waiting: 0, rejected: 0 }, "a kept log is retried and clears once accepted");
  assert.equal((await q.list()).length, 0);

  await q.enqueue("z", payload(9));
  await q.discard("z");
  assert.equal((await q.list()).length, 0);

  // Successful send removes it from the queue
  await q.enqueue("c", payload(4));
  r = await q.flush();
  assert.deepEqual(r, { synced: 1, waiting: 0, rejected: 0 });
  assert.ok(sent.includes("c"));
  assert.equal((await q.list()).length, 0);
}
queueTests().then(() => console.log("offline queue tests passed"));

console.log("mobile logic tests passed");
