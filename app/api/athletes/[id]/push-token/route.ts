import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { isExpoPushToken } from "@/lib/push/expo";

/**
 * POST   /api/athletes/[id]/push-token  { token, platform }  — register this phone for coach-update pushes
 * DELETE /api/athletes/[id]/push-token  { token }            — stop pushes to this phone (sign out / opt out)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const body = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  if (!isExpoPushToken(body.token)) return NextResponse.json({ error: "A valid push token is required." }, { status: 400 });

  // Upsert on the token: a phone that signs into a different account moves the token to that account.
  const { error } = await getSupabaseAdmin()
    .from("push_tokens")
    .upsert(
      { athlete_id: params.id, token: body.token, platform: typeof body.platform === "string" ? body.platform.slice(0, 20) : null, last_seen_at: new Date().toISOString() },
      { onConflict: "token" }
    );
  if (error) return dbError("push-token", error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof body.token !== "string") return NextResponse.json({ error: "token is required." }, { status: 400 });

  const { error } = await getSupabaseAdmin().from("push_tokens").delete().eq("athlete_id", params.id).eq("token", body.token);
  if (error) return dbError("push-token", error);
  return NextResponse.json({ ok: true });
}
