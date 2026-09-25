import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { dbError } from "@/lib/api/error-response";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

/**
 * POST /api/coach-signup
 * Body: { name, email, password, setup_code }
 *
 * Creates the (single, for now) coach account. Gated by COACH_SETUP_CODE, a
 * server-only env var — there's no invite system yet, so this is the
 * cheapest guard against a stranger creating themselves a coach account if
 * this ever runs somewhere reachable beyond localhost. If COACH_SETUP_CODE
 * isn't set at all, signup is refused outright rather than silently open.
 *
 * Uses the admin auth API (email_confirm: true) so this works with zero
 * email/SMTP configuration — no confirmation link ever needs to be sent or
 * clicked. The client signs in with signInWithPassword right after this
 * succeeds, which is what actually establishes the browser session.
 */
export async function POST(req: NextRequest) {
  // Stricter than athlete signup — this endpoint is guarding a secret
  // (the setup code), so a low limit matters more than user convenience.
  const limited = await checkRateLimit(`coach-signup:${getClientIp(req)}`, 5, 15 * 60 * 1000);
  if (limited) return limited;

  const { name, email, password, setup_code } = await req.json();

  const expectedCode = process.env.COACH_SETUP_CODE;
  if (!expectedCode) {
    return NextResponse.json(
      { error: "Coach signup isn't configured yet — set COACH_SETUP_CODE in .env.local." },
      { status: 500 }
    );
  }
  if (setup_code !== expectedCode) {
    return NextResponse.json({ error: "Incorrect setup code." }, { status: 403 });
  }
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
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
    return dbError("coach-signup", createError);
  }

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .insert({ auth_user_id: created.user.id, email, name: name || null })
    .select()
    .single();

  if (coachError) {
    return dbError("coach-signup", coachError);
  }

  return NextResponse.json({ coach });
}
