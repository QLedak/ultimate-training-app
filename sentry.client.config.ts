// Sentry init for the BROWSER. Runs once, on every page load.
//
// This is a no-op — nothing is sent anywhere — until NEXT_PUBLIC_SENTRY_DSN
// is set in .env.local. Create a free Sentry project (sentry.io), grab its
// DSN from Settings > Client Keys, and add it there to turn this on. Safe
// to leave unset in local dev; you'll just get console errors instead of
// Sentry ones, same as before this file existed.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 10% of transactions get performance tracing — plenty to spot a slow
    // route without paying to trace every single request once there's real
    // traffic. Bump this while debugging a specific issue if needed.
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
