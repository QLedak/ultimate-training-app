"""
Conversion: exercise-library.xlsx (v2 workbook) -> exercise-library.json

Run any time the source workbook changes:
    python3 scripts/convert_exercise_library.py

The workbook has four sheets: Exercises (one row per exercise), Injury chains
(ordered isometric -> HSR rungs per injury area), Equipment (the controlled
vocabulary) and Rules (human-readable notes; not read here).

Equipment text in the workbook ("dumbbell, bench", "cable or band",
"dumbbell or kettlebell, weight plates") is parsed into conjunctive normal
form: `equipment_groups` is a list of ANY-OF groups, and the athlete needs at
least one tag from EVERY group. Tokens that name something every athlete is
assumed to have (bodyweight, wall, step, cones, partner, household items, band
anchor) never create a requirement. `equipment_needed` / `equipment_all` are
kept as a compatibility projection of the same data for older readers.

The v2 library replaces the v1 library entirely (library_version = 2). Retired
v1 rows stay in the table, inactive, so old sessions and logs still resolve.
"""

import json
import re
import sys
import openpyxl

SRC = "content/exercise-library/exercise-library.xlsx"
OUT = "content/exercise-library/exercise-library.json"

# token (lowercase, as it appears in the workbook) -> intake equipment tag
TOKEN_TAG = [
    (r"^barbell$", "barbell_rack"),
    (r"^trap bar$", "trap_bar"),
    (r"^dumbbell$", "dumbbells"),
    (r"^kettlebell$", "kettlebell"),
    (r"^band$", "bands"),
    (r"^cable$", "cable_machine"),
    (r"^(plyo )?box$", "boxes"),
    (r"^bench$", "bench"),
    (r"^pull-up bar$", "pullup_bar"),
    (r"^med ball$", "med_ball"),
    (r"^sled$", "sled"),
    (r"^weight plates$", "weight_plates"),
    (r"^landmine$", "landmine"),
    (r"^stability ball$", "stability_ball"),
    (r"^sliders$", "sliders"),
    (r"^ab wheel$", "ab_wheel"),
    (r"^hurdles$", "hurdles"),
    (r"^jump rope$", "jump_rope"),
    (r"^back extension bench$", "back_extension_bench"),
    (r"^dip bars$", "dip_bars"),
    (r"^ski erg$", "ski_erg"),
    (r"^treadmill$", "treadmill"),
    (r"^bike$", "bike"),
    (r"^rower$", "rower"),
    (r"^(field|track|road|hill)$", "turf_track"),
    (r"^rings$", "rings"),  # not an intake option: effectively unavailable
]
# tokens that every athlete is assumed to have / that add no requirement
ALWAYS = {"bodyweight", "wall", "step", "cones", "partner", "anchor", "ball",
          "pillow", "floor", "chair", "backpack", "towel", "sturdy door", "household"}

# One-off readings of ambiguous workbook text.
EQUIPMENT_OVERRIDES = {
    "AS-037": [],  # "bodyweight, bench or box": feet-elevated push-up, any raised surface works
    "CR-013": [["dumbbells", "kettlebell", "trap_bar"]],  # "dumbbell, kettlebell or trap bar" = any of three
}

EXPERIENCE = {"N": "N", "C": "C", "VE": "VE"}
PHASE_KEY = {"GPP": "gpp_reacclimation", "Hypertrophy": "hypertrophy", "Max": "max_strength",
             "Power": "power_conversion", "Peak": "peak_taper"}

# Injury-chain area (workbook) -> injury location keys used by the app
AREA_LOCATIONS = {
    "Achilles / calf": ["achilles_calf"],
    "Knee (patellar / quad)": ["patellar_knee", "acl_knee"],
    "Hamstring": ["hamstring"],
    "Groin / adductor": ["groin_adductor"],
    "Ankle": ["ankle"],
    "Shoulder": ["shoulder"],
    "Low back": ["lower_back"],
    "Hip flexor": ["hip_flexor"],
    "Core": ["abdominal"],
    "Elbow": ["elbow"],
    "Wrist": ["wrist"],
}
CHAIN_TYPE = {"Isometric": "isometric", "HSR (historical start)": "hsr_start", "HSR": "hsr"}

TIME_FRAMES = ["<10 s", "10-30 s", "30 s-2 min", "2-10 min", ">10 min"]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", (s or "").lower()).strip("_")


def parse_equipment(raw, exercise_id):
    """-> (equipment_groups, unmapped_tokens)"""
    if exercise_id in EQUIPMENT_OVERRIDES:
        return EQUIPMENT_OVERRIDES[exercise_id], []
    groups, unmapped = [], []
    for clause in [c.strip().lower() for c in (raw or "").split(",") if c.strip()]:
        alts = [a.strip() for a in re.split(r"\s+or\s+", clause) if a.strip()]
        tags, free = [], False
        for alt in alts:
            if alt in ALWAYS:
                free = True
                continue
            for pat, tag in TOKEN_TAG:
                if re.match(pat, alt):
                    tags.append(tag)
                    break
            else:
                unmapped.append(alt)
        if free:
            continue  # an always-available alternative satisfies the clause
        if tags:
            groups.append(sorted(set(tags)))
    return groups, unmapped


def split_ids(cell):
    if not cell or str(cell).strip() in ("-", ""):
        return []
    return re.findall(r"[A-Z]{2}-\d{3}", str(cell))


def parse_also(cell):
    """'Hypertrophy: Lower compound; Speed: Acceleration' -> [{category, subcategory}]
    Injury-chain tags in this column are ignored: the Injury chains sheet is authoritative."""
    out = []
    for part in [p.strip() for p in (cell or "").split(";") if p.strip()]:
        if part.lower().startswith("injury resilience"):
            continue
        cat, _, sub = part.partition(":")
        out.append({"category": cat.strip(), "subcategory": sub.strip() or None})
    return out


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)

    # --- injury chains ---
    chains = {}  # exercise_id -> [{location, area, step, type}]
    for r in list(wb["Injury chains"].iter_rows(values_only=True))[1:]:
        area, step, typ, ex_id = r[0], r[1], r[2], r[3]
        if not ex_id:
            continue
        for loc in AREA_LOCATIONS[area]:
            chains.setdefault(ex_id, []).append(
                {"location": loc, "area": area, "step": int(step), "type": CHAIN_TYPE[typ]}
            )

    rows, unmapped_all = [], {}
    for r in list(wb["Exercises"].iter_rows(values_only=True))[1:]:
        if not r[0]:
            continue
        (ex_id, name, category, sub, also, equip_raw, min_exp, phases, space, lat, plane,
         region, joints, regress, progress, fill, cue) = (list(r) + [None] * 17)[:17]

        groups, unmapped = parse_equipment(equip_raw, ex_id)
        for u in unmapped:
            unmapped_all.setdefault(u, []).append(ex_id)

        chain = chains.get(ex_id, [])
        sub_clean = (sub or "").strip()
        time_frames = []
        if category == "Conditioning":
            time_frames = [t.strip() for t in sub_clean.split(",") if t.strip() in TIME_FRAMES]

        phase_list = []
        if phases and phases.strip().lower() not in ("all", "see fill rule"):
            phase_list = [PHASE_KEY[p.strip()] for p in phases.split(",") if p.strip()]

        impact = None
        m = re.search(r"Impact:\s*([a-z\-]+)", cue or "")
        if m:
            impact = m.group(1)

        if category == "Injury resilience":
            logging_tier = 2
        elif category in ("Absolute strength",) or (category == "Hypertrophy" and sub_clean == "Lower compound") \
                or (category == "Hypertrophy" and sub_clean == "Upper compound") \
                or (category == "Technical coordination"
                    and any(t in (equip_raw or "") for t in ("barbell", "trap bar", "dumbbell", "kettlebell"))):
            logging_tier = 1
        else:
            logging_tier = 3

        rows.append({
            "exercise_id": ex_id,
            "exercise_name": name,
            "priority_tier": "extended",
            "movement_pattern": f"{category} / {sub_clean}" if sub_clean else category,
            "primary_purpose": category,
            "category": category,
            "subcategory": sub_clean or None,
            "also_tagged": parse_also(also),
            "equipment_needed_raw": equip_raw,
            "equipment_groups": groups,
            # compatibility projection of equipment_groups (older readers); finalized below
            "equipment_needed": [],
            "equipment_all": [g[0] for g in groups if len(g) == 1],
            "min_experience": EXPERIENCE.get((min_exp or "").strip()),
            "phases": phase_list,
            "space_tier": (space or "").strip().lower() if (space or "").strip().lower() in ("minimal", "standard", "large") else "minimal",
            "space_requirements": space,
            "laterality": lat,
            "plane": plane,
            "region": region,
            "joints_loaded": [j.strip() for j in (joints or "").split(",") if j.strip()],
            "regress_from": split_ids(regress),
            "progress_to": split_ids(progress),
            "fill_mode": "R" if (fill or "").startswith("R") else "S",
            "chain_memberships": chain,
            "injury_considerations": sorted({c["location"] for c in chain}),
            "time_frames": time_frames,
            "impact": impact,
            "logging_tier": logging_tier,
            "cue": cue,
            "regression": None,
            "progression": None,
            "training_age": "both",
            "season_tag": None,
            "contrast_pairing_tendon_specific": None,
            "notes": None,
            "is_active": True,
            "library_version": 2,
        })

    # compatibility projection fix: any-of list = the single multi-option group when there is exactly one
    for row in rows:
        multi = [g for g in row["equipment_groups"] if len(g) > 1]
        row["equipment_needed"] = multi[0] if len(multi) == 1 else []
        if row["equipment_groups"] == []:
            row["equipment_needed"] = ["bodyweight_only"]

    ids = [r["exercise_id"] for r in rows]
    assert len(ids) == len(set(ids)), "duplicate exercise ids"
    for r in rows:
        for ref in r["regress_from"] + r["progress_to"]:
            assert ref in ids, f"{r['exercise_id']} references unknown {ref}"

    with open(OUT, "w") as f:
        json.dump(rows, f, indent=2)
    print(f"Converted {len(rows)} exercises -> {OUT}")
    if unmapped_all:
        print("\nUNMAPPED equipment tokens (treated as no requirement):")
        for k, v in sorted(unmapped_all.items()):
            print(f" - {k}: {', '.join(v)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
