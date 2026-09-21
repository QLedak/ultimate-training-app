import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

/**
 * POST /api/athletes
 * Body: { email: string, name?: string, password: string }
 *
 * The athlete signup step, fired from Screen 0 of the intake wizard. Creates
 * a real Supabase Auth account (admin API, email_confirm: true — no
 * SMTP/confirmation-link setup needed) and links it to the athletes row via
 * auth_user_id, then upserts the athletes row itself (upsert rather than
 * insert so re-submitting intake with the same email during testing doesn't
 * hit the unique constraint on athletes.email — though re-running this with
 * an email that already has an auth account now fails at the auth step
 * below, by design: a second real signup for the same email should not be
 * silently allowed).
 *
 * This used to also have a GET ?email=... lookup for a passwordless "enter
 * your email" identification screen — removed once real login existed,
 * since unauthenticated lookup-by-email would otherwise let anyone view any
 * athlete's data just by knowing their email. Use GET /api/me/athlete
 * (session-based) instead.
 */
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(`athlete-signup:${getClientIp(req)}`, 8, 15 * 60 * 1000);
  if (limited) return limited;

  const { email, name, password } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.status === 422 || /already.*registered/i.test(createError.message)) {
      return NextResponse.json(
        { error: "An account with this email already exists — log in instead." },
        { status: 409 }
      );
    }
    return dbError("athletes", createError);
  }

  const { data: athlete, error } = await supabase
    .from("athletes")
    .upsert({ email, name: name || null, auth_user_id: created.user.id }, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    return dbError("athletes", error);
  }

  return NextResponse.json({ athlete });
}
