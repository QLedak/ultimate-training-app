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

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (athleteId) {
    query = query.eq("athlete_id", athleteId);
  }

  const { data, error } = await query;
  if (error) {
    return dbError("drafts", error);
  }

  // Keep only the latest version per lineage.
  const latestByLineage = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const existing = latestByLineage.get(row.lineage_id);
    if (!existing || row.version > existing.version) {
      latestByLineage.set(row.lineage_id, row);
    }
  }

  const drafts = Array.from(latestByLineage.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ drafts });
}
