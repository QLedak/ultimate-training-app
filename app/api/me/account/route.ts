import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";
import { validateDeleteRequest } from "@/lib/account/delete";

/**
 * DELETE /api/me/account   { confirm: "DELETE" }
 *
 * Permanently deletes the signed-in athlete's account: the athletes row (which
 * cascades to intake, plans, sessions, logs, purchases and the rest) and then
 * the login itself. Required for App Store review. Coach logins are refused.
 *
 * Safe to retry: if the athlete data is already gone, the login is still removed.
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const check = validateDeleteRequest(await req.json().catch(() => null));
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: coach, error: coachErr } = await supabase.from("coaches").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (coachErr) return dbError("me/account", coachErr);
  if (coach) {
    return NextResponse.json({ error: "Coach accounts can't be deleted here." }, { status: 403 });
  }

  // Athlete data first: deleting the login first would only null the link, leaving the data behind.
  const { error: athleteErr } = await supabase.from("athletes").delete().eq("auth_user_id", user.id);
  if (athleteErr) return dbError("me/account", athleteErr);

  const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
  if (authErr) return dbError("me/account", authErr);

  return NextResponse.json({ deleted: true });
}
