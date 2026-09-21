/**
 * Seeds the Exercise Library table from content/exercise-library/exercise-library.json.
 *
 * Run after applying the migrations in supabase/migrations/, with your
 * .env.local filled in:
 *
 *     npm run seed
 *
 * Re-running this is safe — it upserts on exercise_id, so editing the
 * spreadsheet, re-running scripts/convert_exercise_library.py, then
 * `npm run seed` again is the normal update workflow.
 */
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
import fs from "node:fs";
import { getSupabaseAdmin } from "../lib/db/supabase-admin";

type ExerciseRow = {
  exercise_id: string;
  exercise_name: string;
  priority_tier: "core_50" | "extended";
  movement_pattern: string;
  primary_purpose: string | null;
  equipment_needed: string[];
  equipment_needed_raw: string | null;
  space_requirements: string | null;
  cue: string | null;
  regression: string | null;
  progression: string | null;
  training_age: string;
  season_tag: string | null;
  injury_considerations: string[];
  contrast_pairing_tendon_specific: string | null;
  notes: string | null;
};

async function main() {
  const jsonPath = path.join(
    process.cwd(),
    "content/exercise-library/exercise-library.json"
  );
  const rows: ExerciseRow[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const supabase = getSupabaseAdmin();

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("exercise_library")
      .upsert(batch, { onConflict: "exercise_id" });

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    console.log(`Seeded ${i + batch.length}/${rows.length} exercises`);
  }

  console.log("Exercise library seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
