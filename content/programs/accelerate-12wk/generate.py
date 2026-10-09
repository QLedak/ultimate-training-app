"""Generates program.json for 'Accelerate' (12-week acceleration/speed off-season program).
Run: python3 content/programs/accelerate-12wk/generate.py
Fixed program: no weights are prescribed. Athletes enter the first set's weight and the
logging screen's effort ratings adjust later sets (lib/training/autoregulate.ts)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = json.load(open(os.path.join(HERE, "../../exercise-library/exercise-library.json")))
BYID = {r["exercise_id"]: r for r in LIB}

DL = {1: "Lower Strength", 2: "Upper Strength 1", 3: "Athlete Day", 4: "Lower Body Power"}
BLOCKS = [(1, [1, 2, 3, 4]), (2, [5, 6, 7, 8]), (3, [9, 10, 11, 12])]
WEEKTYPE = {4: "deload", 8: "deload", 12: "test"}

def E(eid, by_week, rest, notes=None, circuit=None, slot=None):
    return dict(eid=eid, by_week=by_week, rest=rest, notes=notes, circuit=circuit, slot=slot)

def w(*vals):
    """Four values for the four weeks of a block."""
    return list(vals)

# ---- per-block session definitions: day -> ordered exercise list ----
SESSIONS = {
 1: {
  1: [E("TC-003", w("4x3","4x3","5x3","3x3"), "90s", "Light dumbbells, jump for height. Land quiet and stiff.", slot="tc_lower"),
      E("AS-003", w("4x8, RIR 3","4x8, RIR 2","4x6, RIR 2","3x6, RIR 4"), "2-3 min", "Controlled lowering, drive up hard.", slot="strength_lower"),
      E("AS-012", w("3x10, RIR 3","3x10, RIR 3","3x8, RIR 2","2x8, RIR 4"), "90s", "Hips back, long hamstrings, flat back.", "A1", "hyp_lower"),
      E("CR-003", w("3x10","3x10","3x12","2x10"), "90s", "Slow and tight; ribs down.", "A2", "core_sagittal"),
      E("IR-011", w("3x20s/side","3x25s/side","3x30s/side","2x20s/side"), "60s", "Straight-leg Copenhagen side plank: top leg on the bench, hips stacked, hold.", slot="iso_adductor"),
      E("HY-035", w("3x4","3x5","3x6","2x4"), "90s", "Lower as slowly as you can; catch yourself with your hands.", slot="iso_posterior")],
  2: [E("TC-015", w("4x5","4x5","4x4","3x4"), "90s", "Dip, drive, finish with arms locked overhead.", slot="tc_upper"),
      E("AS-019", w("3x8, RIR 3","3x8, RIR 2","3x6, RIR 2","2x6, RIR 4"), "90s", None, "A1", "abs_push"),
      E("AS-028", w("3x8, RIR 3","3x8, RIR 2","3x6, RIR 2","2x6, RIR 4"), "90s", None, "A2", "abs_pull"),
      E("AS-024", w("3x10, RIR 3","3x10, RIR 2","3x8, RIR 2","2x8, RIR 4"), "75s", None, "B1", "hyp_push"),
      E("HY-016", w("3x10, RIR 3","3x10, RIR 2","3x8, RIR 2","2x8, RIR 4"), "75s", None, "B2", "hyp_pull"),
      E("HY-026", w("3x15","3x15","3x15","2x15"), "45s", None, "C1", "shoulder_health"),
      E("CR-017", w("3x10/side","3x10/side","3x12/side","2x10/side"), "45s", "Resist the rotation.", "C2", "core_transverse")],
  3: [E("SP-001", w("3x6/side","3x6/side","3x8/side","2x6/side"), "45s", "Tall posture, drive the knee down hard into the ground.", slot="accel_drill"),
      E("SP-003", w("2x20 yd","2x20 yd","3x20 yd","2x20 yd"), "walk back", None, slot="accel_drill_2"),
      E("SP-006", w("4x10 yd","5x10 yd","6x10 yd","3x10 yd"), "90s", "Fall forward at about 45 degrees, push the ground away behind you. Full effort every rep.", slot="accel_sprint"),
      E("SP-007", w("4x10 yd","5x10 yd","6x10 yd","3x10 yd"), "90s", "Shin angle forward, long push, no reaching.", slot="accel_sprint_2"),
      E("SP-026", w("3x4/side","3x4/side","3x5/side","2x4/side"), "60s", "Stick every landing for 2 seconds.", slot="cod"),
      E("PL-006", w("3x3","3x3","3x4","2x3"), "75s", "Stick the landing.", "A1", "jump_bilateral"),
      E("PL-019", w("3x3/side","3x3/side","3x4/side","2x3/side"), "75s", "Stick the landing.", "A2", "jump_unilateral"),
      E("RS-012", w("3x6/side","3x6/side","3x8/side","2x6/side"), "60s", "Snap the hips through.", slot="reflexive"),
      E("HY-033", w("3x12/side","3x12/side","3x15/side","2x12/side"), "45s", "Pause at the bottom, full range.", slot="calf")],
  4: [E("SP-031", w("4x4 yd","4x4 yd","4x4 yd","2x4 yd"), "75s", "Explosive first three steps.", slot="accel_sprint"),
      E("TC-019", w("4x4","4x4","4x5","3x4"), "90s", "Light dumbbells, fast and springy.", slot="tc_lower"),
      E("AS-006", w("3x8/side, RIR 3","3x8/side, RIR 2","3x6/side, RIR 2","2x6/side, RIR 4"), "60s", None, "A1", "strength_uni"),
      E("PL-015", w("3x6/side","3x6/side","3x6/side","2x6/side"), "90s", "Fast alternation, stay light on the ground.", "A2", "jump_uni"),
      E("HY-004", w("3x8/side","3x8/side","3x10/side","2x8/side"), "75s", None, slot="hyp_lower"),
      E("HY-036", w("3x8/side","3x8/side","3x10/side","2x8/side"), "75s", None, slot="hamstring")],
 },
 2: {
  1: [E("TC-029", w("4x3","5x3","5x3","3x3"), "2 min", "Explode through the hips and finish tall. Moderate weight, fast bar.", slot="tc_lower"),
      E("AS-003", w("4x5, RIR 2","5x4, RIR 2","5x3, RIR 1","3x5, RIR 4"), "3 min", "Drive out of the hole as fast as you can.", slot="strength_lower"),
      E("AS-012", w("3x8, RIR 3","3x6, RIR 2","3x6, RIR 2","2x6, RIR 4"), "2 min", "Hips back, long hamstrings, flat back; drive the hips through.", "A1", "hyp_lower"),
      E("CR-007", w("3x8","3x10","3x10","2x8"), "90s", "No swinging.", "A2", "core_sagittal"),
      E("IR-012", w("3x6/side","3x8/side","3x8/side","2x6/side"), "60s", "Copenhagen dip from the knee: lower slowly, no bounce.", slot="iso_adductor"),
      E("HY-035", w("3x4","3x5","3x6","2x4"), "90s", "Lower as slowly as you can; catch yourself with your hands.", slot="iso_posterior")],
  2: [E("TC-016", w("4x3","5x3","5x2","3x3"), "2 min", "Fast dip and drive; bar speed is the goal.", slot="tc_upper"),
      E("AS-020", w("4x5, RIR 2","4x4, RIR 2","4x3, RIR 1","3x5, RIR 4"), "2 min", None, "A1", "abs_push"),
      E("AS-029", w("4x5, RIR 2","4x4, RIR 2","4x3, RIR 1","3x5, RIR 4"), "2 min", None, "A2", "abs_pull"),
      E("AS-025", w("3x6, RIR 2","3x5, RIR 2","3x5, RIR 2","2x5, RIR 4"), "90s", None, "B1", "hyp_push"),
      E("AS-032", w("3x6, RIR 2","3x5, RIR 2","3x5, RIR 2","2x5, RIR 4"), "90s", "Add weight or use assistance to stay in the range.", "B2", "hyp_pull"),
      E("HY-026", w("3x15","3x15","3x15","2x15"), "45s", None, "C1", "shoulder_health"),
      E("CR-021", w("3x10/side","3x10/side","3x12/side","2x10/side"), "45s", None, "C2", "core_transverse")],
  3: [E("SP-002", w("3x6/side","3x6/side","3x6/side","2x6/side"), "45s", "Switch fast; keep the shin angle forward.", slot="accel_drill"),
      E("SP-008", w("4x15 yd","5x15 yd","5x15 yd","2x15 yd"), "2 min", "Low first step, drive out for ten yards before rising.", slot="accel_sprint"),
      E("SP-010", w("4x15 yd","5x15 yd","5x15 yd","2x15 yd"), "2 min", "Use a resistance band. Your speed should not drop by more than 10 percent.", slot="accel_sprint_2"),
      E("SP-007", w("3x10 yd","3x10 yd","4x10 yd","2x10 yd"), "90s", "Half-kneeling, shin angle forward, long powerful pushes.", slot="accel_sprint_3"),
      E("SP-028", w("3x4/side","3x4/side","3x5/side","2x4/side"), "60s", "Brake in three steps and stick.", slot="cod"),
      E("PL-011", w("3x4","3x4","3x5","2x3"), "90s", "Minimal ground contact. Step off the box, do not jump off.", "A1", "jump_bilateral"),
      E("PL-020", w("3x4/side","3x4/side","3x5/side","2x4/side"), "90s", None, "A2", "jump_unilateral"),
      E("RS-013", w("3x5/side","3x5/side","3x6/side","2x5/side"), "60s", None, slot="reflexive"),
      E("HY-032", w("3x10","3x10","3x8","2x8"), "60s", "Pause at the bottom, then drive up.", slot="calf")],
  4: [E("SP-009", w("3x10 yd","4x10 yd","4x10 yd","2x10 yd"), "90s", "Chest to the floor, then explode up into the sprint.", slot="accel_sprint"),
      E("TC-019", w("4x3","4x3","5x3","3x3"), "2 min", "Heavier dumbbells than block 1; jump for height.", slot="tc_lower"),
      E("AS-007", w("4x5/side, RIR 2","4x5/side, RIR 2","4x4/side, RIR 1","3x4/side, RIR 4"), "75s", None, "A1", "strength_uni"),
      E("PL-021", w("3x15 yd","3x15 yd","3x20 yd","2x15 yd"), "90s", "Long, powerful strides; drive off the ground.", "A2", "jump_uni"),
      E("HY-005", w("3x6/side","3x6/side","3x8/side","2x6/side"), "75s", None, slot="hyp_lower"),
      E("HY-036", w("3x8/side","3x10/side","3x10/side","2x8/side"), "75s", None, slot="hamstring")],
 },
 3: {
  1: [E("TC-006", w("4x3","4x3","3x3","2x3"), "2 min", "Fast elbows around the bar, catch tall.", slot="tc_lower"),
      E("AS-004", w("4x4, RIR 2","4x3, RIR 2","3x3, RIR 1","2x3, RIR 3"), "3 min", "Move the bar fast. Do not grind.", slot="strength_lower"),
      E("AS-012", w("3x6, RIR 3","3x6, RIR 3","3x5, RIR 2","2x5, RIR 4"), "2 min", "Controlled lowering, fast hip drive.", "A1", "hyp_lower"),
      E("CR-002", w("3x8","3x8","3x10","2x8"), "90s", None, "A2", "core_sagittal"),
      E("IR-013", w("3x6/side","3x6/side","2x6/side","2x5/side"), "60s", "Straight-leg Copenhagen dip: lower slowly, no bounce.", slot="iso_adductor"),
      E("HY-012", w("3x8/side","3x8/side","3x6/side","2x6/side"), "75s", "Drive through the heel; hold the top for a beat.", slot="iso_posterior")],
  2: [E("TC-027", w("4x5","4x5","3x5","2x5"), "90s", "Explode off the floor, land soft.", slot="tc_upper"),
      E("AS-020", w("3x4, RIR 2","3x4, RIR 2","3x3, RIR 1","2x3, RIR 3"), "2 min", None, "A1", "abs_push"),
      E("AS-029", w("3x4, RIR 2","3x4, RIR 2","3x3, RIR 1","2x3, RIR 3"), "2 min", None, "A2", "abs_pull"),
      E("AS-024", w("3x6, RIR 3","3x6, RIR 2","2x6, RIR 2","2x5, RIR 4"), "90s", None, "B1", "hyp_push"),
      E("AS-033", w("3x6, RIR 3","3x6, RIR 2","2x6, RIR 2","2x5, RIR 4"), "90s", None, "B2", "hyp_pull"),
      E("HY-026", w("3x15","3x15","2x15","2x12"), "45s", None, "C1", "shoulder_health"),
      E("CR-011", w("3x8/side","3x8/side","3x8/side","2x8/side"), "45s", None, "C2", "core_frontal")],
  3: [E("SP-004", w("2x20 yd","2x20 yd","2x20 yd","2x20 yd"), "walk back", "Quick, crisp, high heel recovery.", slot="accel_drill"),
      E("SP-008", w("4x20 yd","4x20 yd","3x20 yd","2x20 yd"), "2-3 min", "Full effort, full recovery. Stop the set if your times drop off.", slot="accel_sprint"),
      E("SP-012", w("3x30 m","4x30 m","4x30 m","2x30 m"), "3 min", "Build smoothly to top speed over the first 20 m, then hold it.", slot="accel_sprint_2"),
      E("SP-020", w("3x3/side","3x3/side","3x4/side","2x3/side"), "75s", "Plant hard, then explode out of the cut.", slot="cod"),
      E("PL-012", w("3x4","3x4","3x4","2x3"), "90s", None, "A1", "jump_bilateral"),
      E("PL-022", w("3x4/side","3x4/side","3x4/side","2x3/side"), "90s", None, "A2", "jump_unilateral"),
      E("RS-006", w("3x6/side","3x6/side","3x6/side","2x6/side"), "60s", "Throw hard, catch and redirect immediately.", slot="reflexive"),
      E("HY-033", w("3x8/side","3x8/side","3x8/side","2x8/side"), "60s", "Heavier than before; pause at the bottom.", slot="calf")],
  4: [E("SP-006", w("3x10 yd","4x10 yd","3x10 yd","2x10 yd"), "90s", "Fast and relaxed, no tension in the face or shoulders.", slot="accel_sprint"),
      E("TC-003", w("4x3","4x3","3x3","2x3"), "90s", "Jump tall; absorb quietly.", slot="tc_lower"),
      E("AS-008", w("3x4/side, RIR 2","3x4/side, RIR 2","3x3/side, RIR 1","2x3/side, RIR 3"), "75s", None, "A1", "strength_uni"),
      E("PL-018", w("3x3/side","3x3/side","3x3/side","2x3/side"), "90s", "Contrast jump: go as soon as the strength set ends.", "A2", "jump_uni"),
      E("RS-014", w("3x5/side","3x5/side","3x5/side","2x5/side"), "60s", None, slot="reflexive")],
 },
}
SPRINT_IDS = {"SP-006","SP-007","SP-008","SP-009","SP-010","SP-012","SP-031"}

def build():
    weeks, problems = [], []
    accel = {}
    for block, wks in BLOCKS:
        for i, wn in enumerate(wks):
            week = dict(week_number=wn, week_type=WEEKTYPE.get(wn, "build"), days=[])
            used = {}
            count = 0
            for d in (1, 2, 3, 4):
                exs = []
                for e in SESSIONS[block][d]:
                    r = BYID.get(e["eid"])
                    if not r: problems.append(f"missing {e['eid']}"); continue
                    if not r.get("is_active", True): problems.append(f"inactive {e['eid']}")
                    if r["min_experience"] == "VE": problems.append(f"VE-only {e['eid']}")
                    if e["eid"] in used: problems.append(f"week {wn}: {e['eid']} repeated (day {used[e['eid']]} and {d})")
                    used[e["eid"]] = d
                    sr = e["by_week"][i]
                    if e["eid"] in SPRINT_IDS:
                        count += int(sr.split("x")[0])
                    entry = dict(exercise_id=e["eid"], slot_key=f"D{d}.{e['slot']}", sets_reps=sr, rest=e["rest"])
                    if e["circuit"]: entry["circuit_label"] = e["circuit"]
                    notes = e["notes"]
                    if wn in (1, 12) and d == 3 and e["slot"] == "accel_drill":
                        notes = ((notes + " ") if notes else "") + "TEST DAY: after warm-up, run the baseline tests first (10-yard sprint, 20-yard sprint, broad jump, vertical jump) and record them under Programs > My programs > Test results." if wn == 1 else ((notes + " ") if notes else "") + "RETEST DAY: after warm-up, repeat the week 1 tests first and record them under Programs > My programs > Test results."
                    if notes: entry["notes"] = notes
                    exs.append(entry)
            
                week["days"].append(dict(day_index=d, day_label=DL[d], exercises=exs))
            accel[wn] = count
            weeks.append(week)
    return weeks, problems, accel

def required_equipment(weeks):
    eq = set()
    for w_ in weeks:
        for d in w_["days"]:
            for e in d["exercises"]:
                for g in BYID[e["exercise_id"]]["equipment_groups"]:
                    eq.update(g)
    eq.discard("sled")  # SP-010 accepts bands OR sled; the program is written for bands
    return eq

def write_markdown(weeks, accel):
    names = {k: v["exercise_name"] for k, v in BYID.items()}
    out = ["# Accelerate: 12-Week Off-Season Speed Program (design)", "",
           "4 days per week, comfortable lifting level, no conditioning, no weights prescribed (athletes enter the first set's weight; effort ratings adjust later sets).", "",
           "**Sprint reps per week (starts, resisted and flying sprints):** " + ", ".join(f"W{k}: {v}" for k, v in accel.items()), ""]
    labels = {1: "Block 1: Foundation (weeks 1-4, week 4 deload)", 2: "Block 2: Force (weeks 5-8, week 8 deload)", 3: "Block 3: Velocity (weeks 9-12, week 12 taper and retest)"}
    for block, wks in BLOCKS:
        out += [f"## {labels[block]}", ""]
        for d in (1, 2, 3, 4):
            out += [f"### {DL[d]}", "", f"| Exercise | W{wks[0]} | W{wks[1]} | W{wks[2]} | W{wks[3]} | Rest |", "|---|---|---|---|---|---|"]
            for e in SESSIONS[block][d]:
                lab = (e["circuit"] + " ") if e["circuit"] else ""
                out.append(f"| {lab}{names[e['eid']]} ({e['eid']}) | " + " | ".join(e["by_week"]) + f" | {e['rest']} |")
            out.append("")
    out += ["## Tests (week 1 Athlete Day and week 12 Athlete Day)", "", "10-yard sprint, 20-yard sprint, standing broad jump, vertical jump.", ""]
    open(os.path.join(HERE, "program-design.md"), "w").write("\n".join(out))

if __name__ == "__main__":
    weeks, problems, accel = build()
    prog = dict(
        product_id="accelerate-12wk", title="Accelerate: 12-Week Off-Season Speed Program",
        days_per_week=4, weeks=12, level="comfortable",
        suggested_schedule="Mon / Tue / Thu / Sat (or any layout with Athlete Day well away from Lower Strength)",
        equipment=sorted(required_equipment(weeks)),
        space="large",
        tests=[dict(key="sprint_10yd",label="10-yard sprint",unit="seconds",weeks=[1,12]),
               dict(key="sprint_20yd",label="20-yard sprint",unit="seconds",weeks=[1,12]),
               dict(key="broad_jump",label="Standing broad jump",unit="inches",weeks=[1,12]),
               dict(key="vertical_jump",label="Vertical jump",unit="inches",weeks=[1,12])],
        weeks_data=weeks)
    json.dump(prog, open(os.path.join(HERE, "program.json"), "w"), indent=1)
    write_markdown(weeks, accel)
    print("problems:", problems or "none")
    print("sprint reps per week:", accel)
    print("sessions:", sum(len(w["days"]) for w in weeks), "exercises:", sum(len(d["exercises"]) for w in weeks for d in w["days"]))
    eq=set()
    import itertools
    for w in weeks:
        for d in w["days"]:
            for e in d["exercises"]:
                for g in BYID[e["exercise_id"]]["equipment_groups"]:
                    eq.update(g)
    print("equipment tags referenced:", sorted(eq))
