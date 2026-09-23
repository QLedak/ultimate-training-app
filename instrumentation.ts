// Next.js calls register() once per server instance on cold boot, before any
// request is handled — this is where Sentry now wants its server/edge init
// to happen (see sentry.server.config.ts / sentry.edge.config.ts). We keep
// the actual Sentry.init() calls in those two files and just import the
// right one here based on which runtime booted, per Next's own recommended
// pattern for side-effect imports.
//
// Requires `experimental.instrumentationHook: true` in next.config.js on
// Next.js 14.x (this becomes on-by-default in Next.js 15+).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Lets Sentry capture errors thrown during request handling (route handlers,
// server components, etc.) that Next.js's own instrumentation surfaces —
// separate from and in addition to the dbError()/global-error.tsx reporting
// already wired in.
export const onRequestError = Sentry.captureRequestError;
