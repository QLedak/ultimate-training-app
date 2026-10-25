/* Run: npx tsx tests/mobile.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyToAllSets, buildFinalPayload, buildSteps, effectiveOf, firstUnloggedIndex, initStates, logSet, logSupersetSet, stepValue, swapPatch, updateSet, updateExercise,
} from "../mobile/src/workout/state";
import { splitSeconds } from "../mobile/src/workout/TimePicker.logic";
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
import {
  addGoal, buildIntakePayload, firstInvalidStep, initialIntake, parseDraft, toggleEquipment, validateIntakeStep, TOTAL_STEPS, type IntakeState,
} from "../mobile/src/lib/intake.core";
import { COACH_PLAN, daysProblem, defaultDaysFor, equipmentLabel, factsLine, levelLabel, priceLabel, toggleWeekday } from "../mobile/src/lib/plans.core";
import { signUpProblem } from "../mobile/src/lib/signup.core";
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


// ---- Sign-up, intake wizard and plans (mobile onboarding) ----
{
  // sign-up form
  const ok = { name: "Sam", email: "sam@example.com", password: "longenough", agreed: true };
  assert.equal(signUpProblem(ok), null);
  assert.match(signUpProblem({ ...ok, name: " " })!, /name/i);
  assert.match(signUpProblem({ ...ok, email: "nope" })!, /email/i);
  assert.match(signUpProblem({ ...ok, password: "short" })!, /8 characters/);
  assert.match(signUpProblem({ ...ok, agreed: false })!, /agree/i);

  // intake step validation
  const s0 = initialIntake();
  assert.equal(validateIntakeStep(0, s0), null, "age is optional");
  assert.match(validateIntakeStep(0, { ...s0, age: "abc" })!, /age/i);
  assert.match(validateIntakeStep(1, s0)!, /structured training/i);
  assert.match(validateIntakeStep(1, { ...s0, yearsStructuredTraining: "2" })!, /lifting experience/i);
  assert.equal(validateIntakeStep(1, { ...s0, yearsStructuredTraining: "0", liftingExperience: "new" }), null);
  assert.match(validateIntakeStep(2, s0)!, /start and end/i);
  assert.match(validateIntakeStep(2, { ...s0, seasonStart: "2026-11-01", seasonEnd: "2026-10-01" })!, /end before/i);
  assert.match(validateIntakeStep(2, { ...s0, seasonStart: "2026-11-01", seasonEnd: "2027-06-01" })!, /schedule is set/i);
  assert.match(validateIntakeStep(3, s0)!, /days/i);
  assert.match(validateIntakeStep(4, s0)!, /equipment/i);
  assert.match(validateIntakeStep(4, { ...s0, equipment: ["dumbbells"] })!, /space/i);
  assert.match(validateIntakeStep(5, { ...s0, backSquat: { weight: "225", reps: "", skip: false } })!, /both weight and reps/);
  assert.equal(validateIntakeStep(5, { ...s0, backSquat: { weight: "225", reps: "", skip: true } }), null);

  // equipment exclusivity is shared with the website
  assert.deepEqual(toggleEquipment(["dumbbells"], "bodyweight_only"), ["bodyweight_only"]);
  assert.deepEqual(toggleEquipment(["bodyweight_only"], "dumbbells"), ["dumbbells"]);

  // goal chips add once
  assert.equal(addGoal("", "Get faster"), "Get faster");
  assert.equal(addGoal("Get faster", "Jump higher"), "Get faster. Jump higher");
  assert.equal(addGoal("Get faster", "get faster"), "Get faster");

  // a complete answer set passes every step and builds the exact payload the API expects
  const full: IntakeState = {
    ...s0,
    age: "27",
    benchmarkSet: "general_range",
    yearsPlayingUltimate: "6",
    yearsStructuredTraining: "3",
    liftingExperience: "comfortable_with_basics",
    seasonStart: "2026-11-01",
    seasonEnd: "2027-06-01",
    commitments: [{ day_of_week: "Wednesday", time: "19:00", label: "", start_date: "", end_date: "" }],
    tournaments: [{ start_date: "2027-05-01", end_date: "2027-05-02", label: "Regionals", is_priority: true }],
    calendarConfirmed: "yes",
    trainingDaysPerWeek: "4",
    equipment: ["dumbbells", "pullup_bar"],
    availableSpace: "standard",
    bodyweightLb: "180",
    backSquat: { weight: "225", reps: "5", skip: false },
    benchPress: { weight: "", reps: "", skip: true },
    pullupMaxReps: "8",
    currentInjuries: ["ankle"],
    injuryHistory: ["hamstring"],
    catchall: " tight left calf ",
    goals: "Get faster",
  };
  for (let i = 0; i < TOTAL_STEPS; i++) assert.equal(validateIntakeStep(i, full), null, `step ${i}`);
  assert.equal(firstInvalidStep(full), null);
  assert.equal(firstInvalidStep({ ...full, trainingDaysPerWeek: "" }), 3);

  const p = buildIntakePayload("ath-1", full);
  assert.equal(p.athleteId, "ath-1");
  assert.equal(p.age, 27);
  assert.equal(p.season_calendar_confirmed, true);
  assert.equal(p.training_days_per_week, 4);
  assert.equal(p.back_squat_weight, 225);
  assert.equal(p.back_squat_reps, 5);
  assert.equal(p.bench_press_weight, null, "skipped max is dropped");
  assert.equal(p.deadlift_weight, null, "untouched max is null");
  assert.equal(p.vertical_jump_in, null);
  assert.equal(p.pullup_max_reps, 8);
  assert.equal(p.recurring_commitments[0].label, "League game", "blank label defaults like the Season screen");
  assert.equal(p.recurring_commitments[0].start_date, null);
  assert.deepEqual(p.injuryReports, [
    { location: "ankle", report_type: "current_active" },
    { location: "hamstring", report_type: "history" },
  ]);
  assert.deepEqual(p.catchallRestrictions, ["tight left calf"]);
  // keys must be ones the intake table / route know about
  const known = new Set([
    "athleteId", "age", "benchmark_set", "years_playing_ultimate", "years_structured_training", "lifting_experience_selfdescribe",
    "season_start", "season_end", "recurring_commitments", "tournament_weekends", "season_calendar_confirmed", "training_days_per_week",
    "equipment", "available_space", "conditioning_modality", "bodyweight_lb", "back_squat_weight", "back_squat_reps", "bench_press_weight",
    "bench_press_reps", "deadlift_weight", "deadlift_reps", "power_clean_weight", "power_clean_reps", "pullup_max_reps", "vertical_jump_in",
    "goals", "injuryReports", "catchallRestrictions",
  ]);
  assert.deepEqual(Object.keys(p).filter((k) => !known.has(k)), []);
  const webSrc = readFileSync("app/app/intake/page.tsx", "utf8");
  for (const k of known) if (k !== "athleteId") assert.ok(webSrc.includes(k), `website intake payload no longer has ${k}`);

  // drafts
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft("{not json"), null);
  const d = parseDraft(JSON.stringify({ step: 99, state: { age: "30" } }))!;
  assert.equal(d.step, TOTAL_STEPS - 1);
  assert.equal(d.state.age, "30");
  assert.deepEqual(d.state.equipment, [], "missing fields fall back to defaults");

  // plans
  assert.equal(priceLabel(0), "Free during launch");
  assert.equal(priceLabel(4900), "$49");
  assert.equal(priceLabel(4950), "$49.50");
  assert.equal(levelLabel("comfortable"), "For lifters comfortable with the basics");
  assert.equal(levelLabel(null), "All levels");
  assert.equal(factsLine({ week_count: 12, days_per_week: 4, level: "comfortable" }), "12 weeks · 4 days/week · For lifters comfortable with the basics");
  assert.equal(equipmentLabel("dumbbells"), "Dumbbells");
  assert.match(equipmentLabel("turf_track"), /sprint/);
  assert.deepEqual(defaultDaysFor(4), [1, 2, 4, 6]);
  assert.deepEqual(defaultDaysFor(3), [1, 2, 4]);
  assert.equal(defaultDaysFor(6).length, 6);
  assert.deepEqual(toggleWeekday([1, 4], 2), [1, 2, 4]);
  assert.deepEqual(toggleWeekday([1, 2, 4], 2), [1, 4]);
  assert.equal(daysProblem([1, 2, 4, 6], 4), null);
  assert.match(daysProblem([1], 4)!, /3 more days/);
  assert.match(daysProblem([1, 2, 3, 4, 5], 4)!, /exactly 4/);
  assert.ok(COACH_PLAN.bullets.length >= 4 && COACH_PLAN.how.length === 4);
}
console.log("onboarding (sign-up, intake, plans) tests passed");

// ---- Account deletion + password reset ----
import {
  buildNextSeasonBody, formFromState, isLocked, nextSeasonProblem, plannedStatus, seasonIntro, shouldPromptNextSeason, type SeasonState, type PlannedSeason,
} from "../mobile/src/lib/nextSeason.core";
import { buildErrorReport, createDeduper, supportMailto } from "../mobile/src/lib/errorReport.core";
import { sanitizeClientError } from "../lib/client-errors";
import { createRequire } from "node:module";
import { buildPushMessages, chunk, deadTokensFromTickets, isExpoPushToken, planPublishedMessage } from "../lib/push/expo";
import { projectIdFrom, pushEnabledFromStore, screenForPush } from "../mobile/src/lib/push.core";
import { validateDeleteRequest } from "../lib/account/delete";
import { resetEmailProblem } from "../mobile/src/lib/signup.core";
{
  assert.equal(validateDeleteRequest({ confirm: "DELETE" }).ok, true);
  assert.equal(validateDeleteRequest({ confirm: " delete " }).ok, true);
  assert.equal(validateDeleteRequest({ confirm: "yes" }).ok, false);
  assert.equal(validateDeleteRequest(null).ok, false);
  assert.equal(validateDeleteRequest({}).ok, false);
  assert.equal(resetEmailProblem(""), "Enter the email you signed up with.");
  assert.equal(resetEmailProblem("bad"), "Enter a valid email address.");
  assert.equal(resetEmailProblem("a@b.co"), null);
  // The route must delete athlete data before the login, and refuse coaches.
  const route = readFileSync("app/api/me/account/route.ts", "utf8");
  assert.ok(route.indexOf('from("athletes").delete()') < route.indexOf("auth.admin.deleteUser"));
  assert.ok(route.includes("403"));
  console.log("account deletion + reset tests passed");
}


// ---- Plan next season (mobile) ----
{
  const base: SeasonState = {
    stage: "ending_soon", is_bridge: false, active_season: { label: "2026", season_end: "2026-11-01" }, planned_season: null,
    days_until_final_phase_end: 20, prefill: { training_days_per_week: 4, goals: "Get faster", equipment: [], active_injuries: 0 },
  };
  assert.equal(shouldPromptNextSeason(base), true);
  assert.equal(shouldPromptNextSeason({ ...base, stage: "bridge", is_bridge: true }), true);
  assert.equal(shouldPromptNextSeason({ ...base, stage: "in_season_plan" }), false);
  assert.equal(shouldPromptNextSeason({ ...base, stage: "no_plan" }), false);
  assert.equal(shouldPromptNextSeason(null), false);
  assert.match(seasonIntro("bridge"), /off-season/);
  assert.match(seasonIntro("ending_soon"), /close to done/);

  // empty form falls back to prefill
  const f0 = formFromState(base);
  assert.deepEqual([f0.start, f0.end, f0.days, f0.goals], ["", "", 4, "Get faster"]);

  // a saved plan wins over prefill, and old camelCase / missing fields normalize
  const planned: PlannedSeason = {
    id: "s1", label: "2027", season_start: "2027-03-01", season_end: "2027-07-01",
    recurring_commitments: [{ day_of_week: "Tuesday", time: "", label: "Practice" }],
    tournament_weekends: [{ start_date: "2027-06-01", end_date: "2027-06-02", label: "Nationals", is_priority: true }],
    skeleton_id: null, intake_changes: { training_days_per_week: 5, goals: "Peak for nationals" }, draft_status: "pending_review",
  };
  const withPlan = { ...base, planned_season: planned };
  const f1 = formFromState(withPlan);
  assert.equal(f1.start, "2027-03-01");
  assert.equal(f1.days, 5);
  assert.equal(f1.goals, "Peak for nationals");
  assert.equal(f1.tournaments[0].is_priority, true);
  assert.equal(f1.commitments[0].start_date, "");

  assert.match(plannedStatus(planned)!, /reviewing/);
  assert.match(plannedStatus({ ...planned, draft_status: "rejected" })!, /reworking/);
  assert.match(plannedStatus({ ...planned, draft_status: "none" })!, /being drafted/);
  assert.match(plannedStatus({ ...planned, skeleton_id: "k1" })!, /approved/);
  assert.equal(plannedStatus(null), null);
  assert.equal(isLocked({ ...planned, skeleton_id: "k1" }), true);
  assert.equal(isLocked(planned), false);

  // validation
  assert.match(nextSeasonProblem({ ...f0 }, "2026-10-11")!, /season start/i);
  assert.match(nextSeasonProblem({ ...f1, start: "2026-01-01", end: "2026-02-01" }, "2026-10-11")!, /future/);
  assert.match(nextSeasonProblem({ ...f1, start: "2027-08-01", end: "2027-07-01" }, "2026-10-11")!, /end before/i);
  assert.equal(nextSeasonProblem(f1, "2026-10-11"), null);

  // body matches what the route reads
  const body = buildNextSeasonBody(f1);
  assert.deepEqual(Object.keys(body).sort(), ["goals", "recurring_commitments", "season_calendar_confirmed", "season_end", "season_start", "tournament_weekends", "training_days_per_week"]);
  assert.equal(body.recurring_commitments[0].start_date, null);
  const route = readFileSync("app/api/athletes/[id]/next-season/route.ts", "utf8");
  for (const k of Object.keys(body)) assert.ok(route.includes(k), `next-season route no longer reads ${k}`);
  console.log("next season tests passed");
}


// ---- TestFlight readiness: crash reports, support link, EAS env ----
{
  const r = buildErrorReport(new Error("boom"), "screen-crash", { platform: "ios", appVersion: "1.0.0" }, true);
  assert.equal(r.message, "boom");
  assert.equal(r.fatal, true);
  assert.ok(r.stack.includes("boom"));
  assert.equal(buildErrorReport("text only", "x", { platform: "ios", appVersion: "1" }).message, "text only");
  assert.equal(buildErrorReport(undefined, "x", { platform: "ios", appVersion: "1" }).message, "Unknown error");
  assert.equal(buildErrorReport(new Error("x".repeat(900)), "c", { platform: "ios", appVersion: "1" }).message.length, 500);

  let t = 0;
  const once = createDeduper(1000, () => t);
  assert.equal(once("a"), true);
  assert.equal(once("a"), false, "same error within the window is dropped");
  assert.equal(once("b"), true);
  t = 1500;
  assert.equal(once("a"), true, "and allowed again after the window");

  const mail = supportMailto("help@example.com", "1.0.0", "ios", "18.1");
  assert.ok(mail.startsWith("mailto:help@example.com?subject="));
  assert.ok(decodeURIComponent(mail).includes("App 1.0.0 · ios 18.1"));

  // server side sanitizer
  assert.equal(sanitizeClientError(null), null);
  assert.equal(sanitizeClientError({ message: "  " }), null);
  const ok = sanitizeClientError({ message: "m".repeat(900), stack: "s".repeat(9000), fatal: true, extra: "ignored" })!;
  assert.equal(ok.message.length, 500);
  assert.equal(ok.stack.length, 4000);
  assert.equal(ok.fatal, true);
  assert.equal("extra" in ok, false);

  // EAS env builder
  const require2 = createRequire(import.meta.url);
  const { buildEasEnv, applyEnv, isServiceRoleKey } = require2("../mobile/scripts/eas-env.core.js");
  const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString("base64")}.y`;
  const good = `# comment\nEXPO_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt("anon")}\nEXPO_PUBLIC_API_URL="https://app.example.com/"\nEXPO_PUBLIC_SUPPORT_EMAIL=\n`;
  const built = buildEasEnv(good);
  assert.equal(built.ok, true);
  assert.equal(built.env.EXPO_PUBLIC_API_URL, "https://app.example.com", "trailing slash and quotes removed");
  assert.equal("EXPO_PUBLIC_SUPPORT_EMAIL" in built.env, false, "blank optional values are left out");
  assert.equal(buildEasEnv(good.replace(jwt("anon"), jwt("service_role"))).ok, false);
  assert.equal(isServiceRoleKey(jwt("service_role")), true);
  assert.equal(buildEasEnv(good.replace("https://app.example.com/", "http://192.168.1.5:3000")).ok, false);
  assert.equal(buildEasEnv("EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co\n").ok, false);
  const merged = applyEnv(JSON.parse(readFileSync("mobile/eas.json", "utf8")), built.env);
  assert.equal(merged.build.production.autoIncrement, true, "existing settings kept");
  assert.equal(merged.build.preview.env.EXPO_PUBLIC_API_URL, "https://app.example.com");
  assert.equal(merged.build.production.env.EXPO_PUBLIC_SUPABASE_URL, "https://abc.supabase.co");
  console.log("testflight readiness tests passed");
}


// ---- Push notifications when the coach publishes ----
{
  assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc-123_x]"), true);
  assert.equal(isExpoPushToken("fcm:abc"), false);
  assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
  assert.equal(isExpoPushToken(null), false);

  const msgs = buildPushMessages(["ExponentPushToken[a]", "garbage", "ExponentPushToken[b]"], { title: "T", body: "B", data: { screen: "Today" } });
  assert.equal(msgs.length, 2, "invalid tokens are dropped");
  assert.deepEqual(msgs.map((m) => m.to), ["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  assert.equal(msgs[0].title, "T");
  assert.deepEqual(msgs[0].data, { screen: "Today" });

  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(chunk(Array.from({ length: 250 }, (_, i) => i)).length, 3);

  const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"];
  const tickets = [{ status: "ok", id: "1" }, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }];
  assert.deepEqual(deadTokensFromTickets(tokens, tickets), ["ExponentPushToken[b]"], "only dead devices are removed");
  assert.deepEqual(deadTokensFromTickets(tokens, null), []);

  assert.match(planPublishedMessage("macrocycle_planner").title, /season plan is ready/i);
  assert.match(planPublishedMessage("phase_builder").title, /updated/i);
  assert.equal(planPublishedMessage("phase_builder").data!.screen, "Today");

  // phone side
  assert.equal(pushEnabledFromStore(null), true, "on by default");
  assert.equal(pushEnabledFromStore("on"), true);
  assert.equal(pushEnabledFromStore("off"), false);
  assert.equal(projectIdFrom({ expoConfig: { extra: { eas: { projectId: "p-1" } } } }), "p-1");
  assert.equal(projectIdFrom({ easConfig: { projectId: "p-2" } }), "p-2");
  assert.equal(projectIdFrom({ expoConfig: {} }), null);
  assert.equal(projectIdFrom(null), null);
  assert.equal(screenForPush({ screen: "Schedule" }), "Schedule");
  assert.equal(screenForPush({ screen: "nope" }), "Today");
  assert.equal(screenForPush(undefined), "Today");

  // wiring: approving + publishing is what sends it, and only after the draft is marked approved
  const approve = readFileSync("app/api/drafts/[id]/approve/route.ts", "utf8");
  assert.ok(approve.includes("sendPushToAthlete"));
  assert.ok(approve.indexOf('status: "approved"') < approve.indexOf("await sendPushToAthlete"), "push is sent after approval is saved");
  assert.ok(/publishToAthlete\s*\?\s*await sendPushToAthlete/.test(approve), "only when publishing to the athlete");
  const tokenRoute = readFileSync("app/api/athletes/[id]/push-token/route.ts", "utf8");
  assert.ok(tokenRoute.includes("sessionAthleteId !== params.id"), "athletes can only register their own phone");
  assert.ok(readFileSync("supabase/migrations/0019_push_tokens.sql", "utf8").includes("on delete cascade"), "tokens are removed with the account");
  console.log("push notification tests passed");
}

// ---- Workout edits: isometrics, per-side timers, warm-ups, swaps, time wheels ----
{
  
  assert.deepEqual(splitSeconds("95"), { m: 1, s: 35 });
  assert.deepEqual(splitSeconds(""), { m: 0, s: 0 });

  // An isometric written in reps still gets a timer, never a rep logger.
  const squeeze = ex("ADD", { tier: 2, exercise_name: "Adductor Squeeze Iso", prescribed_target: "3x10", prescribed_weight_hint: null, measure: "seconds" });
  const sq = initStates([squeeze]);
  assert.equal(effectiveOf(squeeze, sq.ADD).timedSeconds, 30);
  assert.equal(sq.ADD.sets[0].reps, "30", "timed sets start at the default hold");

  // Per side: unilateral holds and "/side" targets run once for each side.
  const side = ex("SP", { tier: 2, exercise_name: "Side Plank", prescribed_target: "3x30s", prescribed_weight_hint: null, measure: "seconds" });
  assert.equal(effectiveOf(side, initStates([side]).SP).perSide, true);
  const front = ex("FP", { tier: 2, exercise_name: "Front Plank", prescribed_target: "3x30s", prescribed_weight_hint: null, measure: "seconds" });
  assert.equal(effectiveOf(front, initStates([front]).FP).perSide, false);

  // Swapping to an iso alternative turns the timer on.
  const sw = ex("CUR", { tier: 2, prescribed_target: "3x10", prescribed_weight_hint: null,
    alternatives: [{ exercise_id: "ISO", exercise_name: "Wall Sit", tier: 2, prescribed_target: "3x10", measure: "seconds" }] });
  const swapped = updateExercise(initStates([sw]), "CUR", swapPatch(sw, initStates([sw]).CUR, "ISO"));
  assert.equal(effectiveOf(sw, swapped.CUR).timedSeconds, 30);

  // Warm-ups: tracked per exercise, never sent to the server; finished once working sets are logged.
  const lift = ex("BP", { warmup: [{ sets_reps: "5", suggested_weight: 95 }, { sets_reps: "3", suggested_weight: 115 }] });
  assert.equal(initStates([lift]).BP.warmupDone, 0);
  const done = ex("BP2", { warmup: lift.warmup, logged: { weight_used: 100, reps_completed: 5, sets_completed: 1, rir: 2, substituted_exercise_id: null, substitution_reason: null, load_descriptor: null, notes: null, set_results: [{ set_number: 1, weight_used: 100, reps_completed: 5, rir: 2 }] } as any });
  assert.equal(initStates([done]).BP2.warmupDone, 2);

  // Partial completion: 8 of 10 logs exactly what was done.
  const pull = ex("PU", { tier: 2, prescribed_target: "3x10", prescribed_weight_hint: null });
  let pu = initStates([pull]);
  pu = updateSet(pu, "PU", 0, { reps: "8" });
  const pr = logSet(pu, pull, 0, "build");
  assert.equal(buildFinalPayload([pull], pr.states).exercises[0].set_results[0].reps_completed, 8);

  // Logged sets can be edited and the edit reaches the payload.
  const edited = updateSet(pr.states, "PU", 0, { reps: "9" });
  assert.equal(edited.PU.sets[0].logged, true);
  assert.equal(buildFinalPayload([pull], edited).exercises[0].set_results[0].reps_completed, 9);

  // API: alternatives come from the same category and a fitting phase tag.
  const route = readFileSync("app/api/sessions/[id]/route.ts", "utf8");
  assert.ok(route.includes('.in("category", categories)'), "alternatives are same-category");
  assert.ok(route.includes("fitsPhase("), "alternatives respect the phase tag");
  assert.ok(!route.includes('.in("movement_pattern"'), "no longer limited to one movement pattern");
  console.log("workout edit tests passed");
}
