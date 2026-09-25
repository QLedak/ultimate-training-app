import { checkRateLimit } from "./rate-limit";

/**
 * Circuit breaker for the app's AI generation calls — Macrocycle Planner,
 * Phase Builder, and their chat-edit/reject-and-regenerate/rebuild variants.
 * Every one of these is a real, billed Anthropic API call, and until now
 * none of them were rate-limited at all: an accidental double-click, a
 * retry loop, a buggy client, or a compromised coach/athlete account could
 * otherwise run up real, unbounded cost.
 *
 * This is deliberately generous — a safety net against runaway/accidental
 * spend, not a product-level usage cap — so it should never get in the way
 * of normal review-and-edit iteration (a coach might reasonably send several
 * chat edits while dialing in one draft).
 *
 * Keyed per athlete rather than per IP: the coach reviewing/editing drafts
 * and the athlete requesting a rebuild are different callers hitting the
 * same underlying cost for the same athlete, so that's the meaningful unit
 * to cap. Shares the same limiter as signup (lib/api/rate-limit.ts) — backed
 * by Upstash Redis when configured, so the count is actually shared across
 * Vercel's serverless instances instead of silently resetting per-instance.
 */
const MAX_GENERATIONS_PER_ATHLETE_PER_DAY = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export function checkAiGenerationLimit(athleteId: string) {
  return checkRateLimit(`ai-generation:${athleteId}`, MAX_GENERATIONS_PER_ATHLETE_PER_DAY, WINDOW_MS);
}
