import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Implements the scoring in corpus-retrieval-spec.md:
 *   - Phase goal: High weight (3), adjacent goal gets half credit (1.5)
 *   - Training age: High weight (3), adjacent bucket gets half credit (1.5)
 *   - Injury-history individualization overlap: Medium weight (2)
 *   - Days/week: Medium weight (2), off-by-one gets half credit (1)
 *   - Equipment context: Low weight (1)
 *   - Minimum threshold: 3 (full weight on Phase Goal alone, at minimum)
 *   - Cap: top 2 entries above threshold, tiebroken by recency
 *   - retired entries are excluded entirely
 */

const GOAL_PROGRESSION = [
  "gpp_reacclimation",
  "hypertrophy",
  "max_strength",
  "power_conversion",
  "peak_taper",
];
// injury_return and testing_block are situational, not on the linear
// progression, so they get no adjacency credit to/from other goals.

const AGE_PROGRESSION = ["novice", "intermediate", "advanced"];

function adjacency(list: string[], a: string, b: string): "exact" | "adjacent" | "none" {
  if (a === b) return "exact";
  const ia = list.indexOf(a);
  const ib = list.indexOf(b);
  if (ia === -1 || ib === -1) return "none";
  return Math.abs(ia - ib) === 1 ? "adjacent" : "none";
}

export type Situation = {
  phaseGoal: string;
  trainingAge: string;
  injuryLocations: string[]; // standing resilience regions currently active for this athlete
  daysPerWeek: number;
  equipmentContext: "full_gym" | "limited" | "bodyweight_only";
};

export type CorpusEntry = {
  id: string;
  source_draft_id: string;
  call_type: string;
  situation_tags: {
    phase_goal: string;
    training_age: string;
    injury_individualization: string[];
    days_per_week: number;
    equipment_context: string;
  };
  retired: boolean;
  added_at: string;
};

function scoreEntry(entry: CorpusEntry, situation: Situation): number {
  let score = 0;

  const goalMatch = adjacency(GOAL_PROGRESSION, entry.situation_tags.phase_goal, situation.phaseGoal);
  if (goalMatch === "exact") score += 3;
  else if (goalMatch === "adjacent") score += 1.5;

  const ageMatch = adjacency(AGE_PROGRESSION, entry.situation_tags.training_age, situation.trainingAge);
  if (ageMatch === "exact") score += 3;
  else if (ageMatch === "adjacent") score += 1.5;

  const injuryOverlap = entry.situation_tags.injury_individualization.some((loc) =>
    situation.injuryLocations.includes(loc)
  );
  if (injuryOverlap) score += 2;

  const daysDiff = Math.abs(entry.situation_tags.days_per_week - situation.daysPerWeek);
  if (daysDiff === 0) score += 2;
  else if (daysDiff === 1) score += 1;

  if (entry.situation_tags.equipment_context === situation.equipmentContext) score += 1;

  return score;
}

const MINIMUM_THRESHOLD = 3;
const MAX_ENTRIES = 2;

export async function retrieveCorpusEntries(
  supabase: SupabaseClient,
  callType: "macrocycle_planner" | "phase_builder",
  situation: Situation
): Promise<{ entry: CorpusEntry; score: number }[]> {
  const { data, error } = await supabase
    .from("corpus_entries")
    .select("*")
    .eq("call_type", callType)
    .eq("retired", false);

  if (error) {
    throw new Error(`Failed to load corpus entries: ${error.message}`);
  }

  const scored = (data as CorpusEntry[])
    .map((entry) => ({ entry, score: scoreEntry(entry, situation) }))
    .filter((s) => s.score >= MINIMUM_THRESHOLD)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreak: more recently added wins.
      return new Date(b.entry.added_at).getTime() - new Date(a.entry.added_at).getTime();
    });

  return scored.slice(0, MAX_ENTRIES);
}
