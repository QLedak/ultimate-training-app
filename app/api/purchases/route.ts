import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { fulfillPurchase, purchaseMode } from "@/lib/purchases/fulfill";
import { validateSchedule } from "@/lib/purchases/schedule";

/**
 * POST /api/purchases  { product_id, start_date, weekdays }
 *
 * Starts a purchase of a one-off program for the signed-in athlete.
 *  - PURCHASES_MODE=free (pre-launch): fulfilled immediately at no charge.
 *  - Otherwise: not open. When Stripe is added, this route will create a
 *    pending purchase + Checkout session and return its URL; the webhook
 *    calls fulfillPurchase() once payment succeeds.
 */
export async function POST(req: NextRequest) {
  const athleteId = await getSessionAthleteId();
  if (!athleteId) return unauthorized();

  const mode = purchaseMode();
  if (mode === "closed") return NextResponse.json({ error: "Purchases aren't open yet." }, { status: 503 });
  if (mode === "stripe") return NextResponse.json({ error: "Payments aren't connected yet." }, { status: 501 });

  const body = (await req.json().catch(() => ({}))) as { product_id?: string; start_date?: string; weekdays?: number[] };
  if (!body.product_id) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: product, error: pErr } = await supabase
    .from("products").select("id, price_cents, currency, days_per_week").eq("id", body.product_id).eq("is_active", true).maybeSingle();
  if (pErr) return dbError("purchases", pErr);
  if (!product) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const schedule = validateSchedule(body.start_date, body.weekdays, product.days_per_week as number);
  if (!schedule.ok) return NextResponse.json({ error: schedule.error }, { status: 400 });

  const { data: already } = await supabase
    .from("purchases").select("id").eq("athlete_id", athleteId).eq("product_id", product.id).eq("status", "paid").maybeSingle();
  if (already) return NextResponse.json({ error: "You already own this program." }, { status: 409 });

  const { data: purchase, error: iErr } = await supabase
    .from("purchases")
    .insert({
      athlete_id: athleteId, product_id: product.id, status: "pending", amount_cents: 0, currency: product.currency,
      provider: "free", start_date: schedule.startDate, weekdays: schedule.weekdays,
    })
    .select("id")
    .single();
  if (iErr || !purchase) return dbError("purchases", iErr ?? { message: "insert failed" });

  try {
    const { sessionsCreated } = await fulfillPurchase(supabase, purchase.id as string);
    return NextResponse.json({ purchase_id: purchase.id, sessions_created: sessionsCreated });
  } catch (e) {
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return dbError("purchases", { message: e instanceof Error ? e.message : String(e) });
  }
}
