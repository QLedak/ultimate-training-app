"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "./_components/useAthleteSession";
import { BodyweightWidget, RebuildRequestWidget } from "./_components/widgets";

const NAV_LINKS = [
  { href: "/app", label: "Home" },
  { href: "/app/log", label: "Schedule" },
  { href: "/app/log/program", label: "Season" },
];

type SessionSummary = {
  id: string;
  date: string;
  week_number: number;
  day_label: string;
  week_type: "build" | "deload" | "test";
  exercise_count: number;
  status: "completed" | "partially_completed" | "skipped" | null;
};

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AthleteHomePage() {
  const { athlete, authError, loadError } = useAthleteSession("/app");
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    fetch(`/api/athletes/${athlete.id}/sessions?daysBack=7&daysForward=7`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSessions(data.sessions);
      })
      .catch((e) => setSessionsError(e instanceof Error ? e.message : String(e)));
  }, [athlete]);

  if (authError === "no-athlete") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-bold text-brand-dark">Finish setting up</h1>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;re logged in, but we don&apos;t have an athlete profile for this account yet.
        </p>
        <Link
          href="/app/intake"
          className="mt-4 rounded-md bg-brand px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          Complete intake
        </Link>
      </main>
    );
  }

  if (!athlete) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
        {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
      </main>
    );
  }

  const today = todayDateStr();
  const todaysSession = sessions?.find((s) => s.date === today) ?? null;
  const nextSession = sessions?.find((s) => s.date > today) ?? null;

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="text-2xl font-bold text-brand-dark">
          {athlete.name ? `Hey, ${athlete.name.split(" ")[0]}` : "Welcome back"}
        </h1>
        <p className="mb-6 text-sm text-slate-500">{athlete.email}</p>

        {sessionsError && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{sessionsError}</p>}

        {sessions === null && !sessionsError && <p className="mb-6 text-sm text-slate-500">Loading today&apos;s plan…</p>}

        {sessions !== null && (
          <div className="mb-6 rounded-lg border border-slate-200 p-4">
            {todaysSession ? (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-brand">Today</span>
                <div className="mt-1 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-dark">{todaysSession.day_label}</p>
                    <p className="text-xs text-slate-500">
                      Week {todaysSession.week_number} · {todaysSession.exercise_count} exercises
                      {todaysSession.status && ` · ${todaysSession.status.replace("_", " ")}`}
                    </p>
                  </div>
                  <Link
                    href={`/app/log/${todaysSession.id}`}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {todaysSession.status ? "View" : "Log it"}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Today</span>
                <p className="mt-1 text-sm text-slate-600">
                  Nothing scheduled today.{" "}
                  {nextSession && (
                    <>
                      Next up: {nextSession.day_label} on {nextSession.date}.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <BodyweightWidget athleteId={athlete.id} />
        <RebuildRequestWidget athleteId={athlete.id} />

        <div className="mt-2 grid grid-cols-2 gap-3">
          <Link
            href="/app/log"
            className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-medium text-brand-dark hover:border-brand"
          >
            Full schedule
          </Link>
          <Link
            href="/app/log/program"
            className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-medium text-brand-dark hover:border-brand"
          >
            Season overview
          </Link>
        </div>
      </main>
    </>
  );
}
