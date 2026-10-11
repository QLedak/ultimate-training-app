import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
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
  const user = await getAuthUser();

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

  // Additive: lets the mobile app tell "account, no intake yet" from "intake done".
  const { count, error: intakeErr } = await supabase
    .from("athlete_intake")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", athlete.id);
  if (intakeErr) {
    return dbError("me/athlete", intakeErr);
  }

  return NextResponse.json({ athlete, has_intake: (count ?? 0) > 0 });
}
