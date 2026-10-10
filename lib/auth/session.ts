import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { headers } from "next/headers";
import { parseBearerToken } from "./bearer";

/**
 * Pass 2 of authorization (see the two-pass plan in middleware.ts): Pass 1
 * gated PAGES behind login. This file is what lets API ROUTES verify not
 * just "is someone logged in" but "does the logged-in person actually own
 * the athlete/draft/session they're asking about" — closing the gap where a
 * route trusted whatever id the client sent in the URL or body.
 *
 * These read the ANON-key session cookie (via getSupabaseServerClient) only
 * to find out who's asking. All actual data reads/writes still go through
 * the service-role client (getSupabaseAdmin), same as before.
 */


/**
 * Who is making this request. Mobile clients send a Supabase access token as
 * "Authorization: Bearer <token>"; the web app uses its session cookie. The
 * bearer token is checked first, and only when it is present: a request with
 * no Authorization header behaves exactly as it always has. Either way the
 * identity is verified with Supabase (auth.getUser), never decoded locally.
 */
export async function getAuthUser(): Promise<{ id: string } | null> {
  let token: string | null = null;
  try {
    token = parseBearerToken(headers().get("authorization"));
  } catch {
    token = null; // called outside a request scope
  }
  if (token) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id };
  }
  const supabaseAuth = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user ? { id: user.id } : null;
}

/** The athlete id linked to the current request's session, or null if
 * there's no session or the session isn't linked to an athlete row. */
export async function getSessionAthleteId(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = getSupabaseAdmin();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return athlete?.id ?? null;
}

/** The coach id linked to the current request's session, or null. */
export async function getSessionCoachId(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = getSupabaseAdmin();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return coach?.id ?? null;
}

export function unauthorized(message = "Not signed in") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "You don't have access to this resource") {
  return NextResponse.json({ error: message }, { status: 403 });
}
