/* Run: npx tsx tests/purchases.test.ts */
import fs from "node:fs";
import assert from "node:assert/strict";
import { scheduleDates, validateSchedule } from "../lib/purchases/schedule";
import { fulfillPurchase } from "../lib/purchases/fulfill";
import { parsePrescribedTarget } from "../lib/pps/parse-prescription";

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n++; console.log("ok  " + name); });

const lib = JSON.parse(fs.readFileSync("content/exercise-library/exercise-library.json", "utf-8")) as Array<{ exercise_id: string; min_experience: string }>;
const byId = new Map(lib.map((r) => [r.exercise_id, r]));
const prog = JSON.parse(fs.readFileSync("content/programs/accelerate-12wk/program.json", "utf-8"));

(async () => {
  await t("scheduleDates: Mon start, Mon/Tue/Thu/Sat", () => {
    const d = scheduleDates("2026-10-12", [1, 2, 4, 6], 8); // 2026-10-12 is a Monday
    assert.deepEqual(d, ["2026-10-12", "2026-10-13", "2026-10-15", "2026-10-17", "2026-10-19", "2026-10-20", "2026-10-22", "2026-10-24"]);
  });
  await t("scheduleDates: Wednesday start begins at next chosen day", () => {
    const d = scheduleDates("2026-10-14", [1, 2, 4, 6], 3);
    assert.deepEqual(d, ["2026-10-15", "2026-10-17", "2026-10-19"]);
  });
  await t("scheduleDates: 48 sessions span 12 weeks", () => {
    const d = scheduleDates("2026-10-12", [1, 2, 4, 6], 48);
    assert.equal(d.length, 48);
    assert.equal(new Set(d).size, 48);
    assert.ok(d[47] === "2027-01-02");
  });
  await t("validateSchedule: rules", () => {
    const today = "2026-10-09";
    assert.equal(validateSchedule("2026-10-08", [1, 2, 4, 6], 4, today).ok, false);
    assert.equal(validateSchedule("2026-10-10", [1, 2, 4], 4, today).ok, false);
    assert.equal(validateSchedule("2026-10-10", [1, 2, 4, 9], 4, today).ok, false);
    assert.equal(validateSchedule("2028-10-10", [1, 2, 4, 6], 4, today).ok, false);
    const ok = validateSchedule("2026-10-10", [6, 4, 2, 1], 4, today);
    assert.ok(ok.ok && ok.weekdays.join() === "1,2,4,6");
  });
  await t("program.json: 12 weeks x 4 days, valid ids, no VE-only, no weekly repeats", () => {
    assert.equal(prog.weeks_data.length, 12);
    for (const w of prog.weeks_data) {
      assert.equal(w.days.length, 4);
      const seen = new Set<string>();
      for (const d of w.days) for (const e of d.exercises) {
        const r = byId.get(e.exercise_id);
        assert.ok(r, `unknown ${e.exercise_id}`);
        assert.notEqual(r!.min_experience, "VE", e.exercise_id);
        assert.ok(!seen.has(e.exercise_id), `week ${w.week_number} repeats ${e.exercise_id}`);
        seen.add(e.exercise_id);
        assert.ok(e.sets_reps && e.rest, `${e.exercise_id} missing dose`);
      }
    }
  });
  await t("program.json: no removed equipment, tests only in weeks 1 and 12", () => {
    for (const bad of ["sled", "landmine", "trap_bar", "back_extension_bench"]) assert.ok(!prog.equipment.includes(bad), bad);
    for (const x of prog.tests) assert.deepEqual(x.weeks, [1, 12]);
    assert.equal(prog.weeks_data[11].week_type, "test");
  });
  await t("program.json: every sets_reps parses (sets and reps found) or is a hold", () => {
    for (const w of prog.weeks_data) for (const d of w.days) for (const e of d.exercises) {
      const p = parsePrescribedTarget(e.sets_reps);
      assert.ok(p.sets != null, `${e.exercise_id} "${e.sets_reps}"`);
    }
  });

  await t("fulfillPurchase: copies 48 sessions once, idempotent", async () => {
    const tables: Record<string, any[]> = {
      purchases: [{ id: "p1", athlete_id: "a1", product_id: "x", status: "pending", start_date: "2026-10-12", weekdays: [1, 2, 4, 6] }],
      product_sessions: prog.weeks_data.flatMap((w: any) => w.days.map((d: any) => ({ product_id: "x", week_number: w.week_number, day_index: d.day_index, day_label: d.day_label, week_type: w.week_type, prescribed_exercises: d.exercises }))),
      scheduled_sessions: [],
    };
    const mock: any = {
      from(name: string) {
        let rows = tables[name]; let single = false; let updates: any = null; let inserts: any[] | null = null;
        const q: any = {
          select() { return q; }, eq(c: string, v: any) { rows = rows.filter((r) => r[c] === v); return q; },
          order() { return q; }, limit() { return q; },
          single() { single = true; return q; },
          update(u: any) { updates = u; return q; },
          insert(r: any) { inserts = Array.isArray(r) ? r : [r]; return q; },
          then(res: any) {
            if (inserts) { tables[name].push(...inserts); return res({ data: inserts, error: null }); }
            if (updates) { rows.forEach((r) => Object.assign(r, updates)); return res({ data: rows, error: null }); }
            return res({ data: single ? rows[0] ?? null : rows, error: null });
          },
        };
        return q;
      },
    };
    const first = await fulfillPurchase(mock, "p1");
    assert.equal(first.sessionsCreated, 48);
    assert.equal(tables.scheduled_sessions.length, 48);
    assert.ok(tables.scheduled_sessions.every((s) => s.phase_id === null && s.purchase_id === "p1"));
    assert.equal(tables.purchases[0].status, "paid");
    const second = await fulfillPurchase(mock, "p1");
    assert.equal(second.sessionsCreated, 0);
    assert.equal(tables.scheduled_sessions.length, 48);
    assert.equal(tables.scheduled_sessions[0].day_label, "Lower Strength");
    assert.equal(tables.scheduled_sessions[0].date, "2026-10-12");
  });
  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
