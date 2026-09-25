"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** First-of-month for whatever month `d` falls in, time zeroed to noon UTC to dodge DST edge cases. */
function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
}

function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
}

/** The Sunday on/before the 1st, and the Saturday on/after the last day — a whole number of weeks. */
function calendarGridRange(monthCursor: Date) {
  const first = startOfMonth(monthCursor);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
  return { gridStart, gridEnd };
}

function statusDotClass(status: SessionSummary["status"], date: string) {
  if (status === "completed") return "bg-green-500";
  if (status === "partially_completed") return "bg-amber-500";
  if (status === "skipped") return "bg-slate-400";
  // Not logged: distinguish a missed past day from one still coming up.
  return date < todayDateStr() ? "bg-red-400" : "bg-brand";
}

function statusLabel(status: SessionSummary["status"], date: string) {
  if (status === "completed") return "Logged";
  if (status === "partially_completed") return "Partial";
  if (status === "skipped") return "Skipped";
  return date < todayDateStr() ? "Missed" : "Not logged";
}

export default function LogDashboardPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/log");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [sessionsByDate, setSessionsByDate] = useState<Map<string, SessionSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<SessionSummary | null>(null);

  const { gridStart, gridEnd } = useMemo(() => calendarGridRange(monthCursor), [monthCursor]);

  const loadMonth = useCallback(
    (athleteId: string, start: Date, end: Date) => {
      setLoading(true);
      setLoadError(null);
      fetch(`/api/athletes/${athleteId}/sessions?start=${toDateStr(start)}&end=${toDateStr(end)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          const map = new Map<string, SessionSummary>();
          for (const s of data.sessions as SessionSummary[]) map.set(s.date, s);
          setSessionsByDate(map);
          const mine = map.get(todayDateStr());
          if (mine) setTodaySession(mine);
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    if (!athlete) return;
    loadMonth(athlete.id, gridStart, gridEnd);
  }, [athlete, gridStart, gridEnd, loadMonth]);

  // Today's card should show even when browsing a different month — fetch it
  // once, separately, so paging months doesn't make it flicker away.
  useEffect(() => {
    if (!athlete) return;
    fetch(`/api/athletes/${athlete.id}/sessions?daysBack=0&daysForward=0`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTodaySession((data.sessions as SessionSummary[])[0] ?? null);
      })
      .catch(() => {
        // Non-critical — the calendar grid still shows today either way.
      });
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

  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const currentMonthIndex = monthCursor.getUTCMonth();
  const today = todayDateStr();

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="mb-6 text-2xl font-bold text-brand-dark">Your schedule</h1>

        {loadError && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{loadError}</p>}

        {todaySession && (
          <Link
            href={`/app/log/${todaySession.id}`}
            className="mb-6 flex items-center justify-between rounded-md border border-brand bg-blue-50 px-4 py-3 hover:bg-blue-100"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Today</p>
              <p className="font-medium text-brand-dark">{todaySession.day_label}</p>
              <p className="text-xs text-slate-500">{todaySession.exercise_count} exercises</p>
            </div>
            <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white">
              {todaySession.status ? "View" : "Log workout"}
            </span>
          </Link>
        )}

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, -1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-brand-dark">{monthLabel}</h2>
            <button
              type="button"
              onClick={() => setMonthCursor(startOfMonth(new Date()))}
              className="text-xs text-brand underline"
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className={`rounded-md border border-slate-200 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
              {week.map((day) => {
                const dateStr = toDateStr(day);
                const session = sessionsByDate.get(dateStr);
                const inMonth = day.getUTCMonth() === currentMonthIndex;
                const isToday = dateStr === today;
                const cellContent = (
                  <div
                    className={`flex h-16 flex-col items-center justify-start gap-1 border-r border-slate-100 py-1.5 last:border-r-0 sm:h-20 ${
                      inMonth ? "" : "opacity-30"
                    } ${session ? "cursor-pointer hover:bg-slate-50" : ""}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-brand-dark font-semibold text-white" : "text-slate-600"
                      }`}
                    >
                      {day.getUTCDate()}
                    </span>
                    {session && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusDotClass(session.status, dateStr)}`}
                        title={`${session.day_label} — ${statusLabel(session.status, dateStr)}`}
                      />
                    )}
                  </div>
                );
                return session ? (
                  <Link key={dateStr} href={`/app/log/${session.id}`} title={session.day_label}>
                    {cellContent}
                  </Link>
                ) : (
                  <div key={dateStr}>{cellContent}</div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
          <LegendDot colorClass="bg-brand" label="Not logged" />
          <LegendDot colorClass="bg-green-500" label="Logged" />
          <LegendDot colorClass="bg-amber-500" label="Partial" />
          <LegendDot colorClass="bg-slate-400" label="Skipped" />
          <LegendDot colorClass="bg-red-400" label="Missed" />
        </div>

        {!loading && sessionsByDate.size === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Nothing scheduled this month — your coach hasn&apos;t published a phase for this window, or your plan
            is still being built.
          </p>
        )}
      </main>
    </>
  );
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}
