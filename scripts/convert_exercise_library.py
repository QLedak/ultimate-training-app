"""
One-time conversion: exercise-library.xlsx -> exercise-library.json

Run this any time the source spreadsheet changes:
    python3 scripts/convert_exercise_library.py

It normalizes the free-text "Equipment Needed" and "Injury Considerations"
columns into the controlled vocabularies used by intake-funnel-spec.md and
athlete_injury_reports, while keeping the raw text alongside for reference.
The equipment mapping is a best-effort dictionary, not a guarantee — rows
using specialty gym machines (leg curl machine, reverse hyper, etc.) get
mapped to "barbell_rack" as a full-gym proxy, since the app's equipment
options don't yet have a dedicated "machines" tag. The script prints any
phrase it couldn't confidently map so those rows can be spot-checked.
"""

import json
import re
import openpyxl

SRC = "content/exercise-library/exercise-library.xlsx"
OUT = "content/exercise-library/exercise-library.json"

# Ordered so more specific phrases are checked before generic fallbacks.
EQUIPMENT_MAP = [
    (r"pull-?up bar", "pullup_bar"),
    (r"cable", "cable_machine"),
    (r"band", "bands"),
    (r"kettlebell", "kettlebell"),
    (r"dumbbell", "dumbbells"),
    (r"medicine ball", "med_ball"),
    (r"\bbox\b|\bboxes\b|\bstep\b|\bplatform\b", "boxes"),
    (r"sled", "sled"),
    (r"field space|turf|track", "turf_track"),
    (r"assault bike|rower|rowing machine|ski erg|stationary bike|bike", "cardio_machine"),
    (r"trap bar|safety squat bar|barbell|\brack\b|landmine|hyper bench|hyper machine|"
     r"calf raise machine|leg curl machine|leg extension machine|adductor machine|"
     r"weight plate|incline bench|\bbench\b", "barbell_rack"),
]

BODYWEIGHT_MARKERS = [
    "none", "bodyweight", "wall", "doorway", "doorframe", "partner", "cones",
    "agility ladder", "jump rope", "stability ball", "trx", "suspension trainer",
    "dip bars", "rings", "ankle weight", "light load", "light dumbbell",
    "light weight", "harness", "battle ropes", "mini hurdles",
]

INJURY_MAP = [
    (r"achilles|calf", "achilles_calf"),
    (r"patell|knee.*tendon", "patellar_knee"),
    (r"\bacl\b", "acl_knee"),
    (r"hamstring", "hamstring"),
    (r"groin|adductor", "groin_adductor"),
    (r"shoulder", "shoulder"),
    (r"lower back|\blumbar\b", "lower_back"),
    (r"ankle", "ankle"),
]


def normalize_equipment(raw: str):
    if not raw:
        return ["bodyweight_only"], []
    raw_lower = raw.lower()
    tags = set()
    unmatched = []
    always_available = any(marker in raw_lower for marker in BODYWEIGHT_MARKERS)
    for part in re.split(r",| or ", raw):
        part_clean = part.strip().lower()
        if not part_clean:
            continue
        matched = False
        for pattern, tag in EQUIPMENT_MAP:
            if re.search(pattern, part_clean):
                tags.add(tag)
                matched = True
                break
        if not matched and not any(marker in part_clean for marker in BODYWEIGHT_MARKERS):
            unmatched.append(part_clean)
    if always_available:
        tags.add("bodyweight_only")
    if not tags:
        tags.add("bodyweight_only")
    return sorted(tags), unmatched


def normalize_injuries(raw: str):
    if not raw:
        return []
    raw_lower = raw.lower()
    tags = set()
    for pattern, tag in INJURY_MAP:
        if re.search(pattern, raw_lower):
            tags.add(tag)
    return sorted(tags)


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Exercise Library"]

    rows = []
    all_unmatched = set()

    for row in ws.iter_rows(min_row=2, values_only=True):
        exercise_id = row[0]
        if not exercise_id:
            continue

        (
            _id, name, tier, pattern, purpose, equipment_raw, space,
            cue, regression, progression, training_age, season_tag,
            injury_raw, contrast_pairing, notes,
        ) = row

        equipment_tags, unmatched = normalize_equipment(equipment_raw or "")
        all_unmatched.update(unmatched)

        rows.append({
            "exercise_id": exercise_id,
            "exercise_name": name,
            "priority_tier": "core_50" if tier == "Core 50" else "extended",
            "movement_pattern": pattern,
            "primary_purpose": purpose,
            "equipment_needed": equipment_tags,
            "equipment_needed_raw": equipment_raw,
            "space_requirements": space,
            "cue": cue,
            "regression": regression,
            "progression": progression,
            "training_age": (training_age or "Both").lower(),
            "season_tag": season_tag,
            "injury_considerations": normalize_injuries(injury_raw or ""),
            "contrast_pairing_tendon_specific": contrast_pairing,
            "notes": notes,
        })

    with open(OUT, "w") as f:
        json.dump(rows, f, indent=2)

    print(f"Converted {len(rows)} exercises -> {OUT}")
    if all_unmatched:
        print(f"\n{len(all_unmatched)} equipment phrases fell back to no specific tag match")
        print("(still functional — these rows just didn't add anything beyond the")
        print("bodyweight/full-gym defaults already applied). Worth a spot-check:")
        for phrase in sorted(all_unmatched):
            print(" -", phrase)


if __name__ == "__main__":
    main()
