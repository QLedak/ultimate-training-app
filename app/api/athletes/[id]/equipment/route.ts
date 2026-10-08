import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionAthleteId, unauthorized, forbidden } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";
import { validateEquipment, SPACE_VALUES, MODALITY_VALUES } from "@/lib/training/equipment-options";

/**
 * GET/PATCH /api/athletes/[id]/equipment
 *
 * The post-intake equipment editor. Reads/writes current_athlete_state.equipment
 * — the field the Phase Builder and the library pre-filter actually read
 * (lib/generation/phase.ts, lib/prompts/phase-builder.ts). athlete_intake.equipment
 * is left untouched as the historical baseline.
 *
 * Changes only affect FUTURE generation: sessions already approved/scheduled
 * are not rewritten. The response says whether the athlete has an active phase
 * so the UI can offer a one-tap rebuild (via the existing request-rebuild path,
 * which still goes through coach review).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const supabase = getSupabaseAdmin();
  const { data: state, error } = await supabase
    .from("current_athlete_state")
    .select("equipment, available_space, conditioning_modality, updated_at")
    .eq("athlete_id", params.id)
    .maybeSingle();
  if (error) return dbError("athletes/[id]/equipment", error);
  if (!state) return NextResponse.json({ error: "Complete intake first." }, { status: 404 });

  return NextResponse.json({
    equipment: (state.equipment as string[]) ?? [],
    available_space: state.available_space,
    conditioning_modality: state.conditioning_modality,
    updated_at: state.updated_at,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionAthleteId = await getSessionAthleteId();
  if (!sessionAthleteId) return unauthorized();
  if (sessionAthleteId !== params.id) return forbidden();

  const body = await req.json().catch(() => ({}));
  const checked = validateEquipment((body as { equipment?: unknown }).equipment);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { available_space, conditioning_modality } = body as {
    available_space?: string;
    conditioning_modality?: string;
  };
  if (available_space !== undefined && !SPACE_VALUES.includes(available_space)) {
    return NextResponse.json({ error: "Unknown space option." }, { status: 400 });
  }
  if (conditioning_modality !== undefined && !MODALITY_VALUES.includes(conditioning_modality)) {
    return NextResponse.json({ error: "Unknown conditioning option." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from("current_athlete_state")
    .update({
      equipment: checked.value,
      ...(available_space !== undefined ? { available_space } : {}),
      ...(conditioning_modality !== undefined ? { conditioning_modality } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("athlete_id", params.id)
    .select("equipment, updated_at")
    .maybeSingle();
  if (error) return dbError("athletes/[id]/equipment", error);
  if (!updated) return NextResponse.json({ error: "Complete intake first." }, { status: 404 });

  // Is there an active phase whose remaining weeks could be rebuilt?
  let hasActivePhase = false;
  const { data: skeleton } = await supabase
    .from("macrocycle_skeletons")
    .select("id")
    .eq("athlete_id", params.id)
    .eq("is_active", true)
    .maybeSingle();
  if (skeleton) {
    const { data: activePhase } = await supabase
      .from("macrocycle_phases")
      .select("id")
      .eq("skeleton_id", skeleton.id)
      .eq("status", "active")
      .maybeSingle();
    hasActivePhase = !!activePhase;
  }

  return NextResponse.json({
    equipment: updated.equipment,
    updated_at: updated.updated_at,
    has_active_phase: hasActivePhase,
    message: hasActivePhase
      ? "Saved. Your next training block will use this equipment. Sessions already scheduled aren't changed unless you rebuild your current phase."
      : "Saved. Your next training block will use this equipment.",
  });
}
