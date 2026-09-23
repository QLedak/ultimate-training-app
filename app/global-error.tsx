"use client";

// App Router's top-level error boundary — catches rendering errors that
// escape every page/layout, reports them to Sentry (a no-op until
// NEXT_PUBLIC_SENTRY_DSN is set, same as the sentry.*.config.ts files), and
// shows a plain fallback instead of a blank white screen.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Something went wrong.</h1>
          <p className="mt-2 text-sm text-slate-500">
            We&apos;ve been notified. Try again, or come back in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
