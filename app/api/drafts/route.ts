import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getSessionCoachId, unauthorized } from "@/lib/auth/session";
import { dbError } from "@/lib/api/error-response";

/**
 * GET /api/drafts?status=pending_review&athleteId=...
 *
 * Lists drafts for the review screen. Since a draft "lineage" accumulates
 * one row per edit version (review-approval-flow-spec.md), this returns
 * only the LATEST version per lineage — older versions are history, viewed
 * via GET /api/drafts/[id] once you're already looking at a lineage.
 *
 * status defaults to "pending_review" (what the coach needs to act on).
 * Pass status=all to see everything (approved + rejected included).
 *
 * IMPORTANT: "latest version per lineage" has to be computed from EVERY
 * version, then filtered by status — not the other way around. A chat edit
 * never changes the status of the version it superseded (see
 * lib/generation/macrocycle.ts / phase.ts's revise* functions — they only
 * insert a new row), so an old v1 can sit at status "pending_review"
 * forever even after v2 was approved. Filtering by status in the query
 * first, then taking the max version among only the SURVIVING rows, would
 * resurface that stale v1 as if it were the lineage's current state —
 * exactly the "old version still sitting in Awaiting Review after a later
 * edit was approved" bug this was written to fix. Fetching everything and
 * reducing to the true latest version first, then filtering, is the only
 * way to get this right.
 */
export async function GET(req: NextRequest) {
  const coachId = await getSessionCoachId();
  if (!coachId) return unauthorized("Coach sign-in required");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending_review";
  const athleteId = searchParams.get("athleteId");

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("program_drafts")
    .select("*, athletes(email, name)")
    .order("created_at", { ascending: false });

  if (athleteId) {
    query = query.eq("athlete_id", athleteId);
  }

  const { data, error } = await query;
  if (error) {
    return dbError("drafts", error);
  }

  // Reduce to the latest version per lineage FIRST, across every status.
  const latestByLineage = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const existing = latestByLineage.get(row.lineage_id);
    if (!existing || row.version > existing.version) {
      latestByLineage.set(row.lineage_id, row);
    }
  }

  // THEN filter by the requested status, so a lineage only shows up under a
  // status if its true latest version is actually in that status.
  const drafts = Array.from(latestByLineage.values())
    .filter((row) => status === "all" || row.status === status)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ drafts });
}
