import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/me/coach — the coach-side counterpart to /api/me/athlete.
 */
export async function GET() {
  const supabaseAuth = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return dbError("me/coach", error);
  }
  if (!coach) {
    return NextResponse.json({ error: "This account isn't a coach account." }, { status: 404 });
  }

  return NextResponse.json({ coach });
}
