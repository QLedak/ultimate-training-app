import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/me/athlete
 *
 * Returns the athletes row linked to the CURRENT SESSION's user — the
 * replacement for the old "enter your email" identification flow. Every
 * athlete-facing page (/app/log and its sub-pages) calls this on load
 * instead of trusting a client-supplied athleteId.
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
  const { data: athlete, error } = await supabase
    .from("athletes")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return dbError("me/athlete", error);
  }
  if (!athlete) {
    return NextResponse.json(
      { error: "This account isn't linked to an athlete profile yet — finish intake first." },
      { status: 404 }
    );
  }

  return NextResponse.json({ athlete });
}
