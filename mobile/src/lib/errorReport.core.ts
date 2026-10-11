/** Crash report shaping and de-duplication (pure). */
export type ErrorMeta = { platform: string; appVersion: string };

export function buildErrorReport(error: unknown, context: string, meta: ErrorMeta, fatal = false) {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  return {
    message: (e.message || "Unknown error").slice(0, 500),
    stack: (e.stack ?? "").slice(0, 4000),
    context: context.slice(0, 100),
    platform: meta.platform,
    appVersion: meta.appVersion,
    fatal,
  };
}

/** Sends the same error at most once per window, so a render loop can't flood the server. */
export function createDeduper(windowMs = 30000, now: () => number = Date.now) {
  const seen = new Map<string, number>();
  return (key: string): boolean => {
    const t = now();
    const last = seen.get(key);
    if (last !== undefined && t - last < windowMs) return false;
    seen.set(key, t);
    if (seen.size > 50) for (const [k, v] of seen) if (t - v >= windowMs) seen.delete(k);
    return true;
  };
}

/** mailto: link for Help & feedback, with app/device details at the bottom so reports are actionable. */
export function supportMailto(email: string, appVersion: string, platform: string, osVersion: string | number): string {
  const subject = encodeURIComponent("Ultimate Training feedback");
  const body = encodeURIComponent(`\n\n\n---\nApp ${appVersion} · ${platform} ${osVersion}`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
