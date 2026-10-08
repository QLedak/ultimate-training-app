/**
 * Single source of truth for the equipment vocabulary shown to athletes
 * (intake wizard + the post-intake equipment edit screen). Values must match
 * the tags produced by scripts/convert_exercise_library.py and used by
 * lib/db/exercise-filter.ts exactly.
 */
export const EQUIPMENT_OPTIONS = [
  { value: "barbell_rack", label: "Barbell + Rack" },
  { value: "trap_bar", label: "Trap Bar" },
  { value: "bench", label: "Bench" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "pullup_bar", label: "Pull-Up Bar" },
  { value: "cable_machine", label: "Cable Machine" },
  { value: "bands", label: "Resistance Bands" },
  { value: "med_ball", label: "Medicine Ball" },
  { value: "boxes", label: "Boxes/Plyo Boxes" },
  { value: "sled", label: "Sled" },
  { value: "turf_track", label: "Turf/Track/Running Room" },
  { value: "treadmill", label: "Treadmill" },
  { value: "bike", label: "Bike" },
  { value: "rower", label: "Rower" },
  { value: "ski_erg", label: "Ski Erg" },
  { value: "weight_plates", label: "Weight Plates" },
  { value: "landmine", label: "Landmine" },
  { value: "stability_ball", label: "Stability Ball" },
  { value: "sliders", label: "Sliders/Gliders" },
  { value: "ab_wheel", label: "Ab Wheel" },
  { value: "hurdles", label: "Hurdles" },
  { value: "jump_rope", label: "Jump Rope" },
  { value: "back_extension_bench", label: "Back Extension Bench" },
  { value: "dip_bars", label: "Dip Bars" },
  { value: "bodyweight_only", label: "Bodyweight Only" },
] as const;

export const EQUIPMENT_VALUES: string[] = EQUIPMENT_OPTIONS.map((o) => o.value);

/**
 * Toggles one option in an equipment selection. "Bodyweight Only" is
 * exclusive: selecting it clears everything else, and selecting anything
 * else clears it.
 */
export function toggleEquipmentValue(current: string[], value: string): string[] {
  if (value === "bodyweight_only") {
    return current.includes("bodyweight_only") ? [] : ["bodyweight_only"];
  }
  const without = current.filter((e) => e !== "bodyweight_only");
  return without.includes(value) ? without.filter((e) => e !== value) : [...without, value];
}

/** Returns a cleaned, de-duplicated list, or an error string. */
export function validateEquipment(input: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "equipment must be a list." };
  const unique = Array.from(new Set(input.map(String)));
  const bad = unique.filter((v) => !EQUIPMENT_VALUES.includes(v));
  if (bad.length) return { ok: false, error: `Unknown equipment: ${bad.join(", ")}` };
  if (unique.length === 0) return { ok: false, error: "Select at least one piece of equipment." };
  if (unique.includes("bodyweight_only") && unique.length > 1) {
    return { ok: false, error: "Bodyweight Only can't be combined with other equipment." };
  }
  return { ok: true, value: unique };
}

export const SPACE_OPTIONS = [
  { value: "minimal", label: "Minimal (about 5 yards or less, e.g. a small room)" },
  { value: "standard", label: "Standard (about 5-20 yards, e.g. a garage or yard)" },
  { value: "large", label: "Large (20+ yards, e.g. a field or track)" },
] as const;
export const SPACE_VALUES: string[] = SPACE_OPTIONS.map((o) => o.value);

export const MODALITY_OPTIONS = [
  { value: "running", label: "Running (default)" },
  { value: "bike", label: "Bike" },
  { value: "rower", label: "Rower" },
  { value: "ski_erg", label: "Ski Erg" },
  { value: "jump_rope", label: "Jump rope" },
  { value: "incline_walk", label: "Incline walk" },
] as const;
export const MODALITY_VALUES: string[] = MODALITY_OPTIONS.map((o) => o.value);
