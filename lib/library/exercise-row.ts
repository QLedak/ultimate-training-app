/**
 * Typed view of an `exercise_library` row (v2 library) plus the eligibility
 * rules every consumer shares: equipment, space, lifting-experience level and
 * phase window. Pure functions only — no database access — so the slot engine
 * and the tests can run on the JSON produced by scripts/convert_exercise_library.py.
 */

export type Level = "N" | "C" | "VE";
export type SpaceTier = "minimal" | "standard" | "large";
export type PhaseGoal =
  | "gpp_reacclimation"
  | "hypertrophy"
  | "max_strength"
  | "power_conversion"
  | "peak_taper"
  | "injury_return"
  | "testing_block";

export type ChainMembership = {
  location: string; // injury location key, e.g. "achilles_calf"
  area: string;
  step: number;
  type: "isometric" | "hsr_start" | "hsr";
};

export type LibraryRow = {
  exercise_id: string;
  exercise_name: string;
  category: string | null;
  subcategory: string | null;
  also_tagged: Array<{ category: string; subcategory: string | null }> | null;
  equipment_groups: string[][] | null;
  equipment_needed?: string[] | null;
  equipment_all?: string[] | null;
  min_experience: Level | null;
  phases: string[] | null; // empty/null = all phases
  space_tier: SpaceTier | null;
  laterality: "bilateral" | "unilateral" | null;
  plane: "horizontal" | "incline" | "vertical" | null;
  region: string | null;
  joints_loaded: string[] | null;
  regress_from: string[] | null;
  progress_to: string[] | null;
  fill_mode: "R" | "S" | null;
  chain_memberships: ChainMembership[] | null;
  injury_considerations: string[] | null;
  time_frames: string[] | null;
  impact: string | null;
  cue: string | null;
  is_active: boolean;
  library_version?: number | null;
};

export const LEVEL_RANK: Record<Level, number> = { N: 0, C: 1, VE: 2 };
export const SPACE_RANK: Record<SpaceTier, number> = { minimal: 0, standard: 1, large: 2 };

/** Phase goals that borrow another phase's rules (they have no library window of their own). */
export function effectivePhase(goal: string): PhaseGoal {
  if (goal === "injury_return") return "gpp_reacclimation";
  if (goal === "testing_block") return "max_strength";
  return (goal as PhaseGoal) ?? "hypertrophy";
}

export function equipmentGroupsOf(row: LibraryRow): string[][] {
  if (row.equipment_groups) return row.equipment_groups;
  // Fallback for any row that predates equipment_groups: rebuild from the v1 projection.
  const groups: string[][] = [];
  const anyOf = (row.equipment_needed ?? []).filter((t) => t !== "bodyweight_only");
  if (anyOf.length) groups.push(anyOf);
  for (const t of row.equipment_all ?? []) groups.push([t]);
  return groups;
}

/** Athlete has at least one tag from every group (no groups = always doable). */
export function isEquipmentAvailable(row: LibraryRow, athleteEquipment: string[]): boolean {
  const have = new Set(athleteEquipment);
  return equipmentGroupsOf(row).every((group) => group.some((tag) => have.has(tag)));
}

export function fitsSpace(row: LibraryRow, space: SpaceTier): boolean {
  return SPACE_RANK[row.space_tier ?? "minimal"] <= SPACE_RANK[space];
}

export function fitsLevel(row: LibraryRow, level: Level): boolean {
  return !row.min_experience || LEVEL_RANK[row.min_experience] <= LEVEL_RANK[level];
}

const PHASE_WINDOW_KEYS = new Set<string>([
  "gpp_reacclimation", "hypertrophy", "max_strength", "power_conversion", "peak_taper",
]);

export function fitsPhase(row: LibraryRow, goal: string): boolean {
  const phases = (row.phases ?? []).filter((p) => PHASE_WINDOW_KEYS.has(p));
  if (phases.length === 0) return true;
  return phases.includes(effectivePhase(goal));
}

export function isInSubcategory(row: LibraryRow, category: string, subcategory?: string): boolean {
  if (row.category === category && (!subcategory || row.subcategory === subcategory)) return true;
  return false;
}

/** Primary tag OR an "Also tagged" entry (e.g. Hypertrophy: Lower compound on an Absolute strength row). */
export function hasTag(row: LibraryRow, category: string, subcategory?: string): boolean {
  if (isInSubcategory(row, category, subcategory)) return true;
  return (row.also_tagged ?? []).some(
    (t) => t.category === category && (!subcategory || (t.subcategory ?? "").startsWith(subcategory))
  );
}

/** Longest regress chain length behind this row (0 for a chain root). */
export function chainDepth(row: LibraryRow, byId: Map<string, LibraryRow>, path: string[] = []): number {
  if (path.includes(row.exercise_id)) return 0;
  const next = [...path, row.exercise_id];
  let best = 0;
  for (const id of row.regress_from ?? []) {
    const parent = byId.get(id);
    if (parent) best = Math.max(best, 1 + chainDepth(parent, byId, next));
  }
  return best;
}
