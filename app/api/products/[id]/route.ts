import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/products/[id] — public product page data: details plus an outline
 * of the program (weeks, day names, exercise counts). The actual
 * prescriptions are not exposed until purchase.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, title, description, days_per_week, week_count, level, price_cents, currency, equipment, space, suggested_schedule, tests")
    .eq("id", params.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return dbError("products/[id]", error);
  if (!product) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const { data: sessions, error: sErr } = await supabase
    .from("product_sessions")
    .select("week_number, day_index, day_label, week_type, prescribed_exercises")
    .eq("product_id", params.id)
    .order("week_number")
    .order("day_index");
  if (sErr) return dbError("products/[id]", sErr);

  type OutlineWeek = { week_number: number; week_type: string; days: Array<{ day_label: string; exercise_count: number }> };
  const weeks = new Map<number, OutlineWeek>();
  for (const s of sessions ?? []) {
    const w: OutlineWeek = weeks.get(s.week_number) ?? { week_number: s.week_number, week_type: s.week_type, days: [] };
    w.days.push({ day_label: s.day_label, exercise_count: Array.isArray(s.prescribed_exercises) ? s.prescribed_exercises.length : 0 });
    weeks.set(s.week_number, w);
  }
  return NextResponse.json({ product, outline: Array.from(weeks.values()) });
}
