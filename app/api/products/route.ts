import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";

/** GET /api/products — the public catalog of one-off programs. */
export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("id, title, description, days_per_week, week_count, level, price_cents, currency, equipment, space")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) return dbError("products", error);
  return NextResponse.json({ products: data ?? [] });
}
