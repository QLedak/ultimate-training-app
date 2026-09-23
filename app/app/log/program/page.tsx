"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../../_components/useAthleteSession";

const NAV_LINKS = [
  { href: "/app", label: "Home" },
  { href: "/app/log", label: "Schedule" },
  { href: "/app/log/program", label: "Season" },
];

type Phase = {
  id: string;
  phase_number: number;
  phase_name: string;
  goal: string;
  start_date: string;
  end_date: string;
  week_count: number;
  weekly_template_label: string;
  status: "upcoming" | "active" | "completed" | "superseded";
};
type Tournament = { start_date: string; end_date: string; label?: string; is_priority?: boolean };

const GOAL_LABELS: Record<string, string> = {
  gpp_reacclimation: "Reacclimation / base building",
  hypertrophy: "Hypertrophy",
  max_strength: "Max strength",
  power_conversion: "Power conversion",
  peak_taper: "Peak & taper",
  injury_return: "Return from injury",
  testing_block: "Testing block",
};

function statusStyle(status: Phase["status"]) {
  switch (status) {
    case "active":
      return "border-brand bg-blue-50";
    case "completed":
      return "border-slate-200 bg-slate-50 opacity-70";
    case "superseded":
      return "border-slate-200 bg-slate-50 opacity-50 line-through";
    default:
      return "border-slate-200";
  }
}

function statusLabel(status: Phase["status"]) {
  switch (status) {
    case "active":
      return <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">Current</span>;
    case "completed":
      return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Done</span>;
    case "superseded":
      return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">Replaced</span>;
    default:
      return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Upcoming</span>;
  }
}

export default function ProgramOverviewPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/log/program");
  const [phases, setPhases] = useState<Phase[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [season, setSeason] = useState<{ start: string; end: string; confirmed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    fetch(`/api/athletes/${athlete.id}/program`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPhases(data.phases);
        setTournaments(data.tournament_weekends ?? []);
        setSeason(data.season);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [athlete]);

  if (authError === "no-athlete") {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-600">
          You&apos;re logged in, but there&apos;s no athlete profile for this account yet.{" "}
          <Link href="/app/intake" className="text-brand underline">Complete intake</Link>.
        </p>
      </main>
    );
  }

  if (!athlete) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
        {sessionLoadError && <p className="mt-2 text-sm text-red-600">{sessionLoadError}</p>}
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingTournaments = tournaments
    .filter((t) => t.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
      <h1 className="text-2xl font-bold text-brand-dark">Your season</h1>
      {season && (
        <p className="mt-1 text-sm text-slate-500">
          {season.start} → {season.end} {!season.confirmed && "· schedule provisional, will update as it's released"}
        </p>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {phases === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

      {phases !== null && phases.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Your season plan hasn&apos;t been published yet — check back once your coach approves it.
        </p>
      )}

      {phases !== null && phases.length > 0 && (
        <div className="mt-6 space-y-3">
          {phases.map((p) => (
            <div key={p.id} className={`rounded-md border p-3 ${statusStyle(p.status)}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  Phase {p.phase_number}: {p.phase_name}
                </span>
                {statusLabel(p.status)}
              </div>
              <p className="mt-1 text-sm text-slate-600">{GOAL_LABELS[p.goal] ?? p.goal}</p>
              <p className="mt-1 text-xs text-slate-500">
                {p.start_date} → {p.end_date} · {p.week_count} weeks · {p.weekly_template_label}
              </p>
            </div>
          ))}
        </div>
      )}

      {upcomingTournaments.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Upcoming tournaments
          </h2>
          <div className="space-y-2">
            {upcomingTournaments.map((t, i) => (
              <div key={i} className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm">
                <span className="font-medium text-purple-800">{t.label || "Tournament"}</span>{" "}
                <span className="text-purple-600">
                  {t.start_date} → {t.end_date}
                </span>
                {t.is_priority && (
                  <span className="ml-2 rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800">
                    Peaking for this one
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/app/schedule"
        className="mt-8 block rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:border-brand hover:text-brand"
      >
        Edit schedule / add a tournament
      </Link>
      </main>
    </>
  );
}
