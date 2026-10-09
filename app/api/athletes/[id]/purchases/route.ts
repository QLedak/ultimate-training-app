import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/athletes/[id]/purchases
 * The athlete's purchased programs with progress, test results, and whether
 * they also have a coached (subscription) program — i.e. have done intake.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  const [{ data: purchases, error }, { data: intake }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, product_id, start_date, weekdays, fulfilled_at, products(title, week_count, days_per_week, tests)")
      .eq("athlete_id", params.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
    supabase.from("athlete_intake").select("id").eq("athlete_id", params.id).limit(1).maybeSingle(),
  ]);
  if (error) return dbError("athletes/[id]/purchases", error);

  const out = [];
  for (const p of purchases ?? []) {
    const { data: sessions } = await supabase
      .from("scheduled_sessions")
      .select("id, date, week_number, day_label, week_type")
      .eq("purchase_id", p.id)
      .order("date", { ascending: true });
    const ids = (sessions ?? []).map((s) => s.id as string);
    const { data: logs } = ids.length
      ? await supabase.from("session_logs").select("session_id").in("session_id", ids)
      : { data: [] };
    const logged = new Set((logs ?? []).map((l) => l.session_id as string));
    const { data: tests } = await supabase
      .from("purchase_test_results")
      .select("test_key, week_number, value")
      .eq("purchase_id", p.id);
    const today = new Date().toISOString().slice(0, 10);
    const next = (sessions ?? []).find((s) => !logged.has(s.id as string) && (s.date as string) >= today)
      ?? (sessions ?? []).find((s) => !logged.has(s.id as string));
    out.push({
      id: p.id,
      product_id: p.product_id,
      product: p.products,
      start_date: p.start_date,
      total_sessions: ids.length,
      logged_sessions: ids.filter((id) => logged.has(id)).length,
      next_session: next ?? null,
      end_date: sessions && sessions.length ? sessions[sessions.length - 1].date : null,
      tests: tests ?? [],
    });
  }
  return NextResponse.json({ purchases: out, has_coached_program: !!intake });
}
