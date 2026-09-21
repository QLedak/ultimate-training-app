"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Athlete = { id: string; email: string; name: string | null };

/**
 * Shared athlete-identification boilerplate for every page under /app
 * (homepage, schedule, season overview): calls GET /api/me/athlete, and
 * either gets the athlete row, learns the session isn't signed in (bounces
 * to /login with a redirectTo back to wherever this was called from), or
 * learns the session IS signed in but has no linked athlete row yet
 * (prompts to finish intake — the caller renders that state itself since
 * the exact wording/CTA differs slightly page to page).
 */
export function useAthleteSession(currentPath: string) {
  const router = useRouter();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [authError, setAuthError] = useState<"unauthenticated" | "no-athlete" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/athlete")
      .then(async (r) => {
        if (r.status === 401) {
          setAuthError("unauthenticated");
          router.push(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
          return null;
        }
        if (r.status === 404) {
          setAuthError("no-athlete");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) throw new Error(data.error);
        setAthlete(data.athlete);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
    // currentPath is fixed per page (a literal), so this only needs to
    // re-run if the router instance itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return { athlete, authError, loadError };
}
