/* Run: npx tsx tests/slot-engine.test.ts */
import fs from "node:fs";
import assert from "node:assert/strict";
import { buildPhasePlan } from "../lib/generation/slots/engine";
import { reconcileWeeksWithPlan } from "../lib/generation/slots/reconcile";
import { isEquipmentAvailable, fitsLevel, fitsSpace } from "../lib/library/exercise-row";
import type { LibraryRow } from "../lib/library/exercise-row";

const lib = JSON.parse(fs.readFileSync("content/exercise-library/exercise-library.json", "utf-8")) as LibraryRow[];
const byId = new Map(lib.map((r) => [r.exercise_id, r]));
const FULL = ["barbell_rack","trap_bar","bench","dumbbells","kettlebell","pullup_bar","cable_machine","bands","med_ball","boxes","sled","turf_track","bike","rower","weight_plates","landmine","hurdles","dip_bars","back_extension_bench","stability_ball"];
const GOALS = ["gpp_reacclimation","hypertrophy","max_strength","power_conversion","peak_taper"];
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  " + name); };

const mk = (goal: string, days: number, level: "N"|"C"|"VE", equip: string[], space: "minimal"|"standard"|"large", injuries: any[] = []) =>
  buildPhasePlan({ library: lib, goal, profile: { level, equipment: equip, space, daysPerWeek: days, hasLeagueDay: false, modality: "running", injuries, phaseNumber: 1, pins: {} } as any });

t("library: 286 unique rows", () => { assert.equal(lib.length, 286); assert.equal(byId.size, 286); });

const EXPECT_DAYS: Record<number, number> = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
for (const goal of GOALS) for (const days of [2,3,4,5,6]) for (const level of ["N","C","VE"] as const) {
  t(`plan ${goal}/${days}d/${level}: day count, no repeats, rule picks eligible`, () => {
    const plan = mk(goal, days, level, FULL, "large");
    assert.equal(plan.days.length, EXPECT_DAYS[days]);
    const seen = new Set<string>();
    for (const d of plan.days) for (const s of d.slots) {
      assert.ok(s.slot_key, "slot_key");
      if (s.mode === "rule" && s.picked) {
        assert.ok(byId.has(s.picked), `${s.picked} exists`);
        assert.ok(!seen.has(s.picked), `duplicate ${s.picked} in ${s.slot_key}`);
        seen.add(s.picked);
        const r = byId.get(s.picked)!;
        assert.ok(isEquipmentAvailable(r, FULL), `${s.picked} equipment`);
        assert.ok(fitsLevel(r, level), `${s.picked} level`);
      }
      if (s.mode === "shortlist") assert.ok(s.candidates.length >= 1, `${s.slot_key} has candidates`);
    }
  });
}

t("bodyweight athlete: every pick needs no equipment", () => {
  for (const days of [3, 4]) {
    const plan = mk("hypertrophy", days, "N", ["bodyweight_only"], "minimal");
    for (const d of plan.days) for (const s of d.slots) for (const id of [s.picked, ...s.candidates].filter(Boolean) as string[]) {
      assert.ok(isEquipmentAvailable(byId.get(id)!, ["bodyweight_only"]), `${id} in ${s.slot_key}`);
      assert.ok(fitsSpace(byId.get(id)!, "minimal"), `${id} space`);
    }
  }
});

t("new lifter: lower TC limited to TC-001/019/030", () => {
  const plan = mk("max_strength", 4, "N", FULL, "large");
  for (const d of plan.days) for (const s of d.slots) if (s.kind === "tc_lower" && s.picked) assert.ok(["TC-001","TC-019","TC-030"].includes(s.picked), s.picked);
});

t("active injury adds an injury slot", () => {
  const plan = mk("gpp_reacclimation", 3, "C", FULL, "large", [{ location: "hamstring", status: "active" }]);
  assert.ok(plan.days.some((d) => d.slots.some((s) => s.injury?.location === "hamstring")));
});

t("equipment parsing: any-of groups", () => {
  const cr013 = byId.get("CR-013");
  if (cr013) { assert.ok(isEquipmentAvailable(cr013, ["kettlebell"])); assert.ok(!isEquipmentAvailable(cr013, ["bands"])); }
});

t("reconcile: restores rule pick, removes duplicate, flags unreasoned deviation", () => {
  const plan = mk("hypertrophy", 4, "C", FULL, "large");
  const day = plan.days[0];
  const rule = day.slots.find((s) => s.mode === "rule" && s.picked)!;
  const other = lib.find((r) => r.exercise_id !== rule.picked && isEquipmentAvailable(r, FULL))!;
  const weeks: any[] = [{ week_number: 1, week_type: "normal", days: [{ day_label: day.label, date: "2026-01-05", exercises: [{ exercise_id: other.exercise_id, slot_key: rule.slot_key }] }] }];
  const res = reconcileWeeksWithPlan(weeks, plan, lib, { mode: "generate" });
  const ids = weeks[0].days[0].exercises.map((e: any) => e.exercise_id);
  assert.ok(ids.includes(rule.picked!), "rule pick restored");
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  assert.ok(res.repairs >= 1);
});

console.log(`\n${n} tests passed`);
