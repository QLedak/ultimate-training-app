import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { sanitizeClientError } from "@/lib/client-errors";

/**
 * POST /api/client-errors
 * Crash reports from the phone app. Unauthenticated on purpose (a crash can happen before sign-in),
 * so it is rate limited per IP and everything is length-capped. Goes to the server log and Sentry.
 */
export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(`client-errors:${getClientIp(req)}`, 30, 15 * 60 * 1000);
  if (limited) return limited;

  const report = sanitizeClientError(await req.json().catch(() => null));
  if (!report) return NextResponse.json({ error: "message is required" }, { status: 400 });

  console.error(`[mobile-crash] ${report.appVersion} ${report.platform} ${report.context}: ${report.message}`);
  const err = new Error(`[mobile] ${report.message}`);
  if (report.stack) err.stack = report.stack;
  Sentry.captureException(err, {
    tags: { source: "mobile", platform: report.platform, app_version: report.appVersion, fatal: String(report.fatal) },
    extra: { context: report.context },
  });
  return NextResponse.json({ ok: true });
}
