import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { runDailyPhaseTransitionCheck } from "@/lib/generation/phase-transitions";

/**
 * GET /api/cron/phase-transitions
 *
 * Fired once a day by Vercel Cron (see vercel.json) -- this is the
 * previously-missing automation from data-architecture-spec.md Step 6/7(a):
 * phases transition and their next chunk gets generated without a human
 * having to notice and click a button. See lib/generation/phase-transitions.ts
 * for the actual logic; this route is just the scheduled entry point.
 *
 * Protected by CRON_SECRET: when set, Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests, so this
 * checks that header matches. If CRON_SECRET isn't set (e.g. not yet
 * configured), the check is skipped rather than locking the route entirely --
 * not ideal for production, but this endpoint doesn't take a request body an
 * attacker could control, and the per-athlete AI generation limit still caps
 * worst-case cost either way.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  try {
    const actions = await runDailyPhaseTransitionCheck(supabase);
    return NextResponse.json({ ok: true, actions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Phase transition check failed" },
      { status: 500 }
    );
  }
}
