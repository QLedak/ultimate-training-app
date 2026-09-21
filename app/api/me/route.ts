import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

/**
 * GET /api/me
 *
 * Combined role check for the unified login page: tells the caller whether
 * the current session belongs to a coach, an athlete, both (shouldn't
 * normally happen, but favors coach if it does — a coach account is the
 * more privileged one), or neither (signed in but not linked to either
 * table yet, e.g. an athlete mid-intake).
 */
export async function GET() {
  const supabaseAuth = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: coach }, { data: athlete }] = await Promise.all([
    supabase.from("coaches").select("id, email, name").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("athletes").select("id, email, name").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (coach) {
    return NextResponse.json({ role: "coach", coach });
  }
  if (athlete) {
    return NextResponse.json({ role: "athlete", athlete });
  }
  return NextResponse.json({ role: null });
}
