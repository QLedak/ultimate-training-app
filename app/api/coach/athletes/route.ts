import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { getSeasonState } from "@/lib/seasons/state";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/coach/athletes
 *
 * The coach homepage's roster: every athlete, each annotated with their
 * active phase (if any, including its date range so the dashboard can flag
 * upcoming phase transitions), how many drafts are waiting on review, how
 * many injuries they've self-reported as currently active, and when they
 * last logged a session — enough for a coach to see at a glance who needs
 * attention without opening each athlete individually.
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
      const [{ data: skeleton }, { data: draftRows }, { data: intake }, { data: state }] =
        await Promise.all([
          supabase
            .from("macrocycle_skeletons")
            .select("id")
            .eq("athlete_id", athlete.id)
            .eq("is_active", true)
            .maybeSingle(),
          // All draft rows (every version, every status) for this athlete —
          // NOT pre-filtered to status=pending_review. A chat edit never
          // changes the status of the version it superseded (only inserts a
          // new row), so an old v1 can sit at "pending_review" forever even
          // after v2 was approved. Counting rows by status directly would
          // double-count that stale v1 as a second pending draft; the fix
          // (matching /api/drafts's own fix for the same bug) is to reduce
          // to the latest version PER LINEAGE first, then count only those
          // whose true latest version is still pending_review.
          supabase
            .from("program_drafts")
            .select("id, lineage_id, version, status")
            .eq("athlete_id", athlete.id),
          supabase
            .from("athlete_intake")
            .select("id")
            .eq("athlete_id", athlete.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("current_athlete_state")
            .select("current_active_injuries")
            .eq("athlete_id", athlete.id)
            .maybeSingle(),
        ]);

      const latestByLineage = new Map<string, { version: number; status: string }>();
      for (const row of draftRows ?? []) {
        const existing = latestByLineage.get(row.lineage_id);
        if (!existing || row.version > existing.version) {
          latestByLineage.set(row.lineage_id, { version: row.version, status: row.status });
        }
      }
      const pendingDraftsCount = [...latestByLineage.values()].filter(
        (v) => v.status === "pending_review"
      ).length;

      let activePhase: {
        id: string;
        phase_number: number;
        phase_name: string;
        start_date: string;
        end_date: string;
      } | null = null;
      if (skeleton) {
        const { data: phase } = await supabase
          .from("macrocycle_phases")
          .select("id, phase_number, phase_name, start_date, end_date")
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

      const seasonState = await getSeasonState(supabase, athlete.id);
      const lastLoggedAt = lastLog?.logged_at ?? null;
      const activeInjuries = (state?.current_active_injuries as unknown[] | null) ?? [];

      return {
        id: athlete.id,
        email: athlete.email,
        name: athlete.name,
        active_phase: activePhase,
        pending_drafts_count: pendingDraftsCount,
        last_logged_at: lastLoggedAt,
        has_intake: Boolean(intake),
        has_skeleton: Boolean(skeleton),
        season_stage: seasonState.stage,
        next_season: seasonState.planned_season
          ? {
              label: seasonState.planned_season.label,
              season_start: seasonState.planned_season.season_start,
              draft_status: seasonState.planned_season.draft_status,
              approved: !!seasonState.planned_season.skeleton_id,
            }
          : null,
        active_injuries_count: activeInjuries.length,
      };
    })
  );

  return NextResponse.json({ athletes: roster });
}
