import { SupabaseClient } from "@supabase/supabase-js";
import { scheduleDates } from "./schedule";

/**
 * Purchase modes.
 *  - "free":   pre-launch. Anyone signed in can "buy" any product at no charge (PURCHASES_MODE=free).
 *  - "stripe": real payments. NOT wired yet: when it is, the checkout route creates a pending
 *              purchase and the Stripe webhook calls fulfillPurchase() after payment succeeds.
 *  - "closed": default. Purchases are not open.
 */
export type PurchaseMode = "free" | "stripe" | "closed";
export function purchaseMode(): PurchaseMode {
  const m = (process.env.PURCHASES_MODE ?? "").toLowerCase();
  if (m === "free" || m === "stripe") return m;
  return "closed";
}

/**
 * Marks a purchase paid and copies the product's sessions into the buyer's
 * schedule. Idempotent: running it twice (webhook retries) creates the
 * sessions once. This is the ONLY place that grants access to a program, so
 * the future Stripe webhook just needs to call it after verifying payment.
 */
export async function fulfillPurchase(supabase: SupabaseClient, purchaseId: string): Promise<{ sessionsCreated: number }> {
  const { data: purchase, error } = await supabase.from("purchases").select("*").eq("id", purchaseId).single();
  if (error || !purchase) throw new Error(error?.message ?? "Purchase not found");
  if (!purchase.start_date || !Array.isArray(purchase.weekdays)) throw new Error("Purchase has no schedule.");

  const { data: existing } = await supabase.from("scheduled_sessions").select("id").eq("purchase_id", purchaseId).limit(1);
  if (existing && existing.length > 0) {
    if (purchase.status !== "paid") await supabase.from("purchases").update({ status: "paid", fulfilled_at: new Date().toISOString() }).eq("id", purchaseId);
    return { sessionsCreated: 0 };
  }

  const { data: sessions, error: sErr } = await supabase
    .from("product_sessions")
    .select("week_number, day_index, day_label, week_type, prescribed_exercises")
    .eq("product_id", purchase.product_id)
    .order("week_number", { ascending: true })
    .order("day_index", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  if (!sessions || sessions.length === 0) throw new Error("This product has no sessions.");

  const dates = scheduleDates(purchase.start_date as string, purchase.weekdays as number[], sessions.length);
  const rows = sessions.map((s, i) => ({
    athlete_id: purchase.athlete_id,
    phase_id: null,
    source_draft_id: null,
    purchase_id: purchaseId,
    date: dates[i],
    week_number: s.week_number,
    day_label: s.day_label,
    week_type: s.week_type,
    prescribed_exercises: s.prescribed_exercises,
  }));
  const { error: insErr } = await supabase.from("scheduled_sessions").insert(rows);
  if (insErr) throw new Error(insErr.message);

  const { error: upErr } = await supabase
    .from("purchases")
    .update({ status: "paid", fulfilled_at: new Date().toISOString() })
    .eq("id", purchaseId);
  if (upErr) throw new Error(upErr.message);
  return { sessionsCreated: rows.length };
}
