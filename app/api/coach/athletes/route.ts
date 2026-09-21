import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/coach/athletes
 *
 * The coach homepage's roster: every athlete, each annotated with their
 * active phase (if any), how many drafts are waiting on review, and when
 * they last logged a session — enough for a coach to see at a glance who
 * needs attention without opening each athlete individually.
 *
 * Done as one query per athlete rather than a single joined query — the
 * roster is expected to be small (one coach's athletes), and this keeps
 * each piece (active phase / pending drafts / last logged) simple to read
 * and to change independently later.
 */
export async function GET() {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const supabase = getSupabaseAdmin();

  const { data: athletes, error: athletesError } = await supabase
    .from("athletes")
    .select("id, email, name")
    .order("name", { ascending: true, nullsFirst: false });
  if (athletesError) return dbError("coach/athletes", athletesError);

  const roster = await Promise.all(
    (athletes ?? []).map(async (athlete) => {
      const [{ data: skeleton }, { data: pendingDrafts }] = await Promise.all([
        supabase
          .from("macrocycle_skeletons")
          .select("id")
          .eq("athlete_id", athlete.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("program_drafts")
          .select("id")
          .eq("athlete_id", athlete.id)
          .eq("status", "pending_review"),
      ]);

      let activePhase: { id: string; phase_number: number; phase_name: string } | null = null;
      if (skeleton) {
        const { data: phase } = await supabase
          .from("macrocycle_phases")
          .select("id, phase_number, phase_name")
          .eq("skeleton_id", skeleton.id)
          .eq("status", "active")
          .maybeSingle();
        activePhase = phase ?? null;
      }

      const { data: lastLog } = await supabase
        .from("session_logs")
        .select("logged_at, scheduled_sessions!inner(athlete_id)")
        .eq("scheduled_sessions.athlete_id", athlete.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastLoggedAt = lastLog?.logged_at ?? null;

      return {
        id: athlete.id,
        email: athlete.email,
        name: athlete.name,
        active_phase: activePhase,
        pending_drafts_count: pendingDrafts?.length ?? 0,
        last_logged_at: lastLoggedAt,
      };
    })
  );

  return NextResponse.json({ athletes: roster });
}
