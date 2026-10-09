/**
 * Seeds one-off programs from content/programs/<id>/program.json into
 * products + product_sessions. Safe to re-run: it upserts, and refuses to
 * change a program's sessions once anyone has bought it (the buyer's copies
 * are already made, but changing the master would make support confusing:
 * bump the id, e.g. accelerate-12wk-v2, instead).
 *
 *     npm run seed:products
 *
 * The list price is set here (cents). 0 = free, which is what the pre-launch
 * "free purchase" mode uses.
 */
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
import fs from "node:fs";
import { getSupabaseAdmin } from "../lib/db/supabase-admin";

const PRICE_CENTS: Record<string, number> = { "accelerate-12wk": 0 };
const DESCRIPTIONS: Record<string, string> = {
  "accelerate-12wk":
    "Twelve weeks, four days a week, built around one goal: getting faster over the first 10 to 20 yards. Foundation, Force, then Velocity blocks combine sprint work, strength, and jumps, with retests in week 12.",
};

type Program = {
  product_id: string; title: string; days_per_week: number; weeks: number; level: string;
  suggested_schedule: string; equipment: string[]; space: string; tests: unknown[];
  weeks_data: Array<{ week_number: number; week_type: string; days: Array<{ day_index: number; day_label: string; exercises: unknown[] }> }>;
};

async function main() {
  const root = path.join(process.cwd(), "content/programs");
  const supabase = getSupabaseAdmin();
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const file = path.join(root, dir.name, "program.json");
    if (!fs.existsSync(file)) continue;
    const p: Program = JSON.parse(fs.readFileSync(file, "utf-8"));

    // Validate every exercise against the active v2 library.
    const ids = Array.from(new Set(p.weeks_data.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => (e as { exercise_id: string }).exercise_id)))));
    const { data: lib, error: libErr } = await supabase
      .from("exercise_library").select("exercise_id").in("exercise_id", ids).eq("library_version", 2).eq("is_active", true);
    if (libErr) throw new Error(libErr.message);
    const have = new Set((lib ?? []).map((r) => r.exercise_id as string));
    const missing = ids.filter((i) => !have.has(i));
    if (missing.length) throw new Error(`${p.product_id}: exercises missing or inactive in the library: ${missing.join(", ")}. Run migration 0017 and npm run seed first.`);

    const { count } = await supabase.from("purchases").select("id", { count: "exact", head: true }).eq("product_id", p.product_id).eq("status", "paid");
    const { data: existing } = await supabase.from("products").select("id").eq("id", p.product_id).maybeSingle();
    if (existing && (count ?? 0) > 0) {
      console.log(`${p.product_id}: has paid purchases; only updating listing details, not sessions.`);
    }

    const { error: prodErr } = await supabase.from("products").upsert({
      id: p.product_id, title: p.title, description: DESCRIPTIONS[p.product_id] ?? null,
      days_per_week: p.days_per_week, week_count: p.weeks, level: p.level,
      price_cents: PRICE_CENTS[p.product_id] ?? 0, equipment: p.equipment, space: p.space,
      suggested_schedule: p.suggested_schedule, tests: p.tests, is_active: true,
    });
    if (prodErr) throw new Error(prodErr.message);

    if (!((count ?? 0) > 0)) {
      const rows = p.weeks_data.flatMap((w) => w.days.map((d) => ({
        product_id: p.product_id, week_number: w.week_number, day_index: d.day_index,
        day_label: d.day_label, week_type: w.week_type, prescribed_exercises: d.exercises,
      })));
      const { error: delErr } = await supabase.from("product_sessions").delete().eq("product_id", p.product_id);
      if (delErr) throw new Error(delErr.message);
      const { error: insErr } = await supabase.from("product_sessions").insert(rows);
      if (insErr) throw new Error(insErr.message);
      console.log(`${p.product_id}: ${rows.length} sessions loaded.`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
