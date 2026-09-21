import { NextRequest, NextResponse } from "next/server";

/**
 * A minimal in-memory rate limiter for the handful of unauthenticated POST
 * routes that create accounts (athlete signup, coach signup) — the ones an
 * attacker could otherwise hammer to spam accounts or brute-force the coach
 * setup code, since nothing about them requires being logged in first.
 *
 * This is intentionally simple: a Map keyed by IP, reset per window. It's
 * enough for a single-instance deployment (e.g. one Vercel/Node process
 * during early launch), but it does NOT share state across multiple
 * server instances and resets on every restart/deploy. If this app moves
 * to a multi-instance or serverless-per-request deployment, replace this
 * with a shared store (Upstash Redis is the common choice with Vercel) —
 * that's a "real scale" problem, not a launch blocker.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

// Opportunistic cleanup so the Map doesn't grow forever — cheap to run on
// every check since expired entries are looked up anyway.
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 response if `key` has exceeded `limit` requests within
 * `windowMs`, or null if the request is allowed to proceed.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  if (Math.random() < 0.05) sweep(now); // cheap, infrequent cleanup

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many attempts. Please wait a bit before trying again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }
  bucket.count++;
  return null;
}
