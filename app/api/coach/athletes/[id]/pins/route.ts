import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * Coach slot pins: GET lists, PUT upserts {slot_key, exercise_id, note?},
 * DELETE removes by ?slot_key=. A pin forces that exercise into that slot for
 * this athlete in every future phase build (lib/generation/slots/engine.ts)
 * as long as it is eligible (equipment/space/level); otherwise the engine
 * warns and falls back to the rule pick.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getSessionCoachId())) return unauthorized("Coach sign-in required");
  const { data, error } = await getSupabaseAdmin()
    .from("athlete_slot_pins")
    .select("slot_key, exercise_id, note, created_at")
    .eq("athlete_id", params.id)
    .order("slot_key");
  if (error) return dbError("coach/athletes/[id]/pins", error);
  return NextResponse.json({ pins: data ?? [] });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getSessionCoachId())) return unauthorized("Coach sign-in required");
  const body = (await req.json().catch(() => ({}))) as { slot_key?: string; exercise_id?: string; note?: string };
  if (!body.slot_key || !body.exercise_id) {
    return NextResponse.json({ error: "slot_key and exercise_id are required." }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data: ex } = await supabase
    .from("exercise_library")
    .select("exercise_id")
    .eq("exercise_id", body.exercise_id)
    .eq("library_version", 2)
    .eq("is_active", true)
    .maybeSingle();
  if (!ex) return NextResponse.json({ error: "Unknown or inactive exercise." }, { status: 400 });
  const { error } = await supabase
    .from("athlete_slot_pins")
    .upsert(
      { athlete_id: params.id, slot_key: body.slot_key, exercise_id: body.exercise_id, note: body.note ?? null },
      { onConflict: "athlete_id,slot_key" }
    );
  if (error) return dbError("coach/athletes/[id]/pins", error);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getSessionCoachId())) return unauthorized("Coach sign-in required");
  const slotKey = new URL(req.url).searchParams.get("slot_key");
  if (!slotKey) return NextResponse.json({ error: "slot_key is required." }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("athlete_slot_pins")
    .delete()
    .eq("athlete_id", params.id)
    .eq("slot_key", slotKey);
  if (error) return dbError("coach/athletes/[id]/pins", error);
  return NextResponse.json({ ok: true });
}
