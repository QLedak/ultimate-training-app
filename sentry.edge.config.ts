// Sentry init for the EDGE runtime (middleware.ts). Kept separate from
// sentry.server.config.ts because the edge runtime can't use everything the
// Node SDK does. See sentry.client.config.ts for the DSN/setup note.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
