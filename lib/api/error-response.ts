import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Turns an internal (almost always Supabase/Postgres) error into a safe
 * response: the full message is logged server-side so it's still
 * debuggable, but only a generic message reaches the client. Before this,
 * routes across the app returned raw database error text straight to the
 * browser — harmless while it was just us testing, but not something a
 * real user should see (column names, constraint names, query internals).
 *
 * Also reports to Sentry (a no-op until it's configured — see
 * sentry.server.config.ts) so these don't only exist as a console.error
 * line nobody's watching once this is running unattended in production.
 *
 * `context` is a short string identifying where this fired (route path is
 * fine) so the server log — and the Sentry event — stays traceable back to
 * its source.
 */
export function dbError(context: string, error: { message: string }, status = 500) {
  console.error(`[${context}]`, error.message);
  Sentry.captureException(new Error(`[${context}] ${error.message}`));
  return NextResponse.json(
    { error: "Something went wrong on our end. Please try again in a moment." },
    { status }
  );
}
