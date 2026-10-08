import fs from "node:fs";
import { buildPhasePlan } from "../lib/generation/slots/engine";
import type { LibraryRow } from "../lib/library/exercise-row";

const lib = JSON.parse(fs.readFileSync("content/exercise-library/exercise-library.json", "utf-8")) as LibraryRow[];
const byId = new Map(lib.map((r) => [r.exercise_id, r]));
const FULL = ["barbell_rack","trap_bar","bench","dumbbells","kettlebell","pullup_bar","cable_machine","bands","med_ball","boxes","sled","turf_track","bike","rower","weight_plates","landmine","hurdles","dip_bars","back_extension_bench","stability_ball"];
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.split("=")[1] ?? d;
const goal = arg("goal", "hypertrophy");
const days = Number(arg("days", "4"));
const level = arg("level", "C") as "N" | "C" | "VE";
const equip = arg("equip", "full") === "bw" ? ["bodyweight_only"] : FULL;
const inj = arg("inj", "").split(",").filter(Boolean).map((x) => ({ location: x.split(":")[0], status: (x.split(":")[1] ?? "historical") as "active" | "historical" }));
const plan = buildPhasePlan({
  library: lib, goal,
  profile: { level, equipment: equip, space: arg("space","large") as never, daysPerWeek: days, hasLeagueDay: arg("league","no")==="yes", modality: arg("mod","running") as never, injuries: inj, phaseNumber: Number(arg("pn","1")), pins: {} },
});
for (const d of plan.days) {
  console.log(`\n== ${d.label}`);
  for (const s of d.slots) {
    const nm = (id: string) => `${id} ${byId.get(id)?.exercise_name}`;
    console.log(`  ${s.order}. [${s.slot_key}]${s.superset ? " ss" + s.superset : ""} ${s.label} — ${s.mode === "rule" ? "RULE " + nm(s.picked!) : "SHORT " + s.candidates.map((c) => c).join(",")}`);
  }
}
console.log("\nWARNINGS:", plan.warnings);
