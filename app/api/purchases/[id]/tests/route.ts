import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

type TestDef = { key: string; label: string; unit: string; weeks: number[] };

/**
 * PUT /api/purchases/[id]/tests  { test_key, week_number, value }
 * Records (or corrects) a test result for a purchased program, e.g. the
 * week 1 and week 12 sprint times. Only the buyer can write them, and only
 * for the tests and weeks the product defines.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const athleteId = await getSessionAthleteId();
  if (!athleteId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { test_key?: string; week_number?: number; value?: number };
  const supabase = getSupabaseAdmin();
  const { data: purchase, error } = await supabase
    .from("purchases").select("id, athlete_id, status, products(tests)").eq("id", params.id).maybeSingle();
  if (error) return dbError("purchases/[id]/tests", error);
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (purchase.athlete_id !== athleteId) return forbidden();
  if (purchase.status !== "paid") return NextResponse.json({ error: "Purchase isn't active." }, { status: 400 });

  const product = purchase.products as unknown as { tests: TestDef[] } | null;
  const def = (product?.tests ?? []).find((t) => t.key === body.test_key);
  if (!def) return NextResponse.json({ error: "Unknown test." }, { status: 400 });
  if (!def.weeks.includes(Number(body.week_number))) {
    return NextResponse.json({ error: `This test is recorded in week ${def.weeks.join(" and ")}.` }, { status: 400 });
  }
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) {
    return NextResponse.json({ error: "Enter a valid number." }, { status: 400 });
  }

  const { error: upErr } = await supabase.from("purchase_test_results").upsert(
    { purchase_id: params.id, athlete_id: athleteId, test_key: def.key, week_number: Number(body.week_number), value },
    { onConflict: "purchase_id,test_key,week_number" }
  );
  if (upErr) return dbError("purchases/[id]/tests", upErr);
  return NextResponse.json({ ok: true });
}
