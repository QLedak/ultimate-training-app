import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiter for the app's unauthenticated signup routes (athlete signup,
 * coach signup) and the AI-generation circuit breaker (lib/api/
 * ai-generation-limit.ts) — anything that needs a shared count across
 * requests to be meaningful.
 *
 * Backed by Upstash Redis (REST API, so it works from Vercel's serverless
 * functions without a persistent connection) when UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN are set. This app runs on Vercel, where each
 * request can land on a different instance — an in-memory Map's count is
 * only ever local to whichever instance handled it, so it does not actually
 * enforce a shared limit once there's more than one instance running, which
 * defeats the point of a circuit breaker against runaway AI spend.
 *
 * If the Upstash env vars aren't set (e.g. local dev, or before you've
 * created the free Upstash database), this falls back to the same
 * in-memory-Map behavior as before, with a one-time console warning. That
 * keeps local dev working with zero setup, but means the limit is NOT
 * reliably enforced in that mode — set the env vars in Vercel before
 * relying on this for real.
 */

let warnedNoUpstash = false;

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function warnOnce() {
  if (warnedNoUpstash) return;
  warnedNoUpstash = true;
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — falling back to " +
      "an in-memory limiter that does NOT share state across serverless instances. Fine for " +
      "local dev; set these in Vercel before relying on rate limits in production."
  );
}

// ---------------------------------------------------------------------------
// In-memory fallback (unchanged behavior from before Upstash was added)
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (Math.random() < 0.05) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (bucket.count >= limit) {
    return false; // over limit
  }
  bucket.count++;
  return true; // allowed
}

// ---------------------------------------------------------------------------
// Upstash Redis-backed limiter (fixed window, via INCR + EXPIRE over REST)
// ---------------------------------------------------------------------------

async function upstashCommand(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(`${url}/${args.map((a) => encodeURIComponent(String(a))).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Rate-limit checks must never get cached.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { result: unknown };
  return body.result;
}

async function checkRateLimitUpstash(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  // INCR returns the post-increment count; set the TTL only on the first
  // hit in this window so later requests don't keep pushing the window out.
  const count = Number(await upstashCommand(["INCR", redisKey]));
  if (count === 1) {
    await upstashCommand(["EXPIRE", redisKey, windowSeconds]);
  }
  return count <= limit;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 response if `key` has exceeded `limit` requests within
 * `windowMs`, or null if the request is allowed to proceed.
 *
 * If Upstash is configured but unreachable (network blip, bad credentials),
 * this fails OPEN — the request is allowed through with a logged warning,
 * rather than taking the whole app down because a rate limiter's dependency
 * hiccuped. The AI-generation cap is a safety net against runaway spend, not
 * a hard security boundary, so availability wins here.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  let allowed: boolean;

  if (upstashConfigured()) {
    try {
      allowed = await checkRateLimitUpstash(key, limit, windowMs);
    } catch (err) {
      console.error("[rate-limit] Upstash request failed, allowing request through:", err);
      allowed = true;
    }
  } else {
    warnOnce();
    allowed = checkRateLimitInMemory(key, limit, windowMs);
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a bit before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } }
    );
  }
  return null;
}
