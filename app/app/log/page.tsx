"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";

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

function statusBadge(status: SessionSummary["status"]) {
  switch (status) {
    case "completed":
      return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Logged</span>;
    case "partially_completed":
      return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Partial</span>;
    case "skipped":
      return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Skipped</span>;
    default:
      return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Not logged</span>;
  }
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export default function LogDashboardPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/log");
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    setLoadError(null);
    fetch(`/api/athletes/${athlete.id}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSessions(data.sessions);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
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
        <p className="text-sm text-slate-500">Loading your schedule…</p>
        {sessionLoadError && <p className="mt-2 text-sm text-red-600">{sessionLoadError}</p>}
      </main>
    );
  }

  const today = sessions?.filter((s) => isToday(s.date)) ?? [];
  const upcoming = sessions?.filter((s) => s.date > new Date().toISOString().slice(0, 10)) ?? [];
  const past = sessions?.filter((s) => s.date < new Date().toISOString().slice(0, 10)) ?? [];

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="mb-6 text-2xl font-bold text-brand-dark">Your schedule</h1>

        {loadError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{loadError}</p>}

        {sessions === null && !loadError && <p className="text-sm text-slate-500">Loading your sessions…</p>}

        {sessions !== null && sessions.length === 0 && (
          <p className="text-sm text-slate-500">
            Nothing scheduled yet — your coach hasn&apos;t published a phase for this window, or your plan is still
            being built.
          </p>
        )}

        {today.length > 0 && <SessionGroup title="Today" sessions={today} />}
        {past.length > 0 && <SessionGroup title="Recent" sessions={[...past].reverse()} />}
        {upcoming.length > 0 && <SessionGroup title="Coming up" sessions={upcoming} />}
      </main>
    </>
  );
}

function SessionGroup({ title, sessions }: { title: string; sessions: SessionSummary[] }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="space-y-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/app/log/${s.id}`}
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 hover:border-brand"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-brand-dark">{s.day_label}</span>
                {s.week_type !== "build" && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {s.week_type === "deload" ? "Deload" : "Testing"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {s.date} · Week {s.week_number} · {s.exercise_count} exercises
              </p>
            </div>
            {statusBadge(s.status)}
          </Link>
        ))}
      </div>
    </div>
  );
}
