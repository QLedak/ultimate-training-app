/**
 * Seeds the Exercise Library table from content/exercise-library/exercise-library.json
 * (the v2 library produced by scripts/convert_exercise_library.py).
 *
 * Run after applying the migrations in supabase/migrations/ (through 0017), with
 * your .env.local filled in:
 *
 *     npm run seed
 *
 * Re-running this is safe — it upserts on exercise_id, so editing the
 * workbook, re-running scripts/convert_exercise_library.py, then
 * `npm run seed` again is the normal update workflow. v2 rows that disappear
 * from the workbook are marked inactive (never deleted: history may reference them).
 */
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
import fs from "node:fs";
import { getSupabaseAdmin } from "../lib/db/supabase-admin";

type ExerciseRow = {
  exercise_id: string;
  exercise_name: string;
  library_version: number;
  is_active: boolean;
  [column: string]: unknown;
};

async function main() {
  const jsonPath = path.join(process.cwd(), "content/exercise-library/exercise-library.json");
  const rows: ExerciseRow[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const ids = rows.map((r) => r.exercise_id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate exercise_id in exercise-library.json");
  if (rows.some((r) => r.library_version !== 2)) throw new Error("Seed expects library_version = 2 on every row.");

  const supabase = getSupabaseAdmin();

  // Guard: the legacy-rename migration must have run, or v2 CN-/CR-/RS- ids would overwrite v1 rows.
  const { data: clash, error: clashError } = await supabase
    .from("exercise_library")
    .select("exercise_id")
    .eq("library_version", 1)
    .or("exercise_id.like.CN-%,exercise_id.like.CR-%,exercise_id.like.RS-%")
    .limit(1);
  if (clashError) throw new Error(`Could not check for legacy rows (was migration 0017 applied?): ${clashError.message}`);
  if (clash && clash.length > 0) {
    throw new Error("Legacy CN-/CR-/RS- rows still exist. Apply supabase/migrations/0017_exercise_library_v2.sql first.");
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("exercise_library").upsert(batch, { onConflict: "exercise_id" });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    console.log(`Seeded ${i + batch.length}/${rows.length} exercises`);
  }

  // Retire v2 rows that are no longer in the workbook.
  const { data: existing, error: listError } = await supabase
    .from("exercise_library")
    .select("exercise_id")
    .eq("library_version", 2);
  if (listError) throw new Error(listError.message);
  const stale = (existing ?? []).map((r) => r.exercise_id as string).filter((id) => !ids.includes(id));
  if (stale.length > 0) {
    const { error } = await supabase.from("exercise_library").update({ is_active: false }).in("exercise_id", stale);
    if (error) throw new Error(error.message);
    console.log(`Marked ${stale.length} removed v2 rows inactive: ${stale.join(", ")}`);
  }

  console.log("Exercise library seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
