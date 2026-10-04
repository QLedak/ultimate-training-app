"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";

const NAV_LINKS = [
  { href: "/app", label: "Home" },
  { href: "/app/log", label: "Schedule" },
  { href: "/app/log/program", label: "Overview" },
  { href: "/app/injuries", label: "Injuries" },
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

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
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

/** The Sunday on/before `d`, noon UTC (same DST-dodge as startOfMonth). */
function startOfWeek(d: Date) {
  const noon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
  noon.setUTCDate(noon.getUTCDate() - noon.getUTCDay());
  return noon;
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

// ---------------------------------------------------------------------------
// Workout-type icons — testing feedback: the calendar's small status dots
// didn't say anything about what kind of workout a day actually was, just
// whether it had been logged. day_label is the one per-day descriptive field
// scheduled_sessions has (see workout-logging-schema-spec.md); it's free
// text written by the Phase Builder, following a fixed six-day-type naming
// convention in the common case ("Lower Body Strength", "Hypertrophy Day",
// etc.) but with real variation — legacy "Lower A"/"Upper B" day-letter
// labels, late-phase sport-specific renames ("Speed", "Reactive/Plyo"), and
// "GAME"/"Rest" days. Matching on keywords rather than an exact enum covers
// all of those without needing a new schema field. Order matters: first
// match wins, most-specific first (so e.g. "Lower Body Strength" doesn't
// fall through to a generic default before "lower" is checked).
// ---------------------------------------------------------------------------
const WORKOUT_ICON_RULES: { match: RegExp; icon: string; title: string }[] = [
  { match: /hypertrophy/i, icon: "🏋️", title: "Hypertrophy" },
  { match: /game|tournament/i, icon: "🥏", title: "Game" },
  { match: /\brest\b/i, icon: "😴", title: "Rest" },
  { match: /upper/i, icon: "💪", title: "Upper body" },
  { match: /lower/i, icon: "🦵", title: "Lower body" },
  { match: /impulse/i, icon: "💥", title: "Impulse" },
  { match: /speed|plyo|reactive/i, icon: "🏃", title: "Speed / plyo" },
  { match: /energy/i, icon: "🔥", title: "Energy system" },
  { match: /athlete/i, icon: "⚡", title: "Athlete day" },
];

function workoutIcon(dayLabel: string): { icon: string; title: string } {
  for (const rule of WORKOUT_ICON_RULES) {
    if (rule.match.test(dayLabel)) return { icon: rule.icon, title: rule.title };
  }
  return { icon: "🏋️", title: dayLabel };
}

export default function LogDashboardPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/log");
  const [view, setView] = useState<"week" | "month">("month");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [sessionsByDate, setSessionsByDate] = useState<Map<string, SessionSummary[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<SessionSummary | null>(null);

  // Drag-and-drop reschedule — testing feedback asked to be able to drag a
  // workout onto a different day instead of only using the date-picker form
  // on that workout's own page. Native HTML5 drag/drop (desktop-only; touch
  // drag isn't part of this), wired to the same PATCH reschedule endpoint
  // the per-session page already uses, so all of its own rules (max 6-day
  // shift, can't move a logged day, must stay inside the phase's date
  // range) still apply — a drop that violates one just surfaces that
  // endpoint's error message instead of silently failing.
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (view === "week") {
      return { start: weekCursor, end: addDays(weekCursor, 6) };
    }
    const { gridStart, gridEnd } = calendarGridRange(monthCursor);
    return { start: gridStart, end: gridEnd };
  }, [view, weekCursor, monthCursor]);

  const loadRange = useCallback((athleteId: string, start: Date, end: Date) => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/athletes/${athleteId}/sessions?start=${toDateStr(start)}&end=${toDateStr(end)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        // Grouped into a list per date now, not one session per date — the
        // app allows multiple scheduled sessions on the same day (testing
        // feedback; see migration 0011), so a single-session Map would
        // silently drop every extra one.
        const map = new Map<string, SessionSummary[]>();
        for (const s of data.sessions as SessionSummary[]) {
          const list = map.get(s.date) ?? [];
          list.push(s);
          map.set(s.date, list);
        }
        setSessionsByDate(map);
        const mine = map.get(todayDateStr());
        if (mine && mine.length > 0) setTodaySession(mine[0]);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!athlete) return;
    loadRange(athlete.id, rangeStart, rangeEnd);
  }, [athlete, rangeStart, rangeEnd, loadRange]);

  // Today's card should show even when browsing a different week/month —
  // fetch it once, separately, so paging around doesn't make it flicker away.
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

  async function handleDrop(targetDate: string) {
    setDropTargetDate(null);
    const sessionId = dragSessionId;
    setDragSessionId(null);
    if (!sessionId || !athlete) return;

    setRescheduleError(null);
    setRescheduling(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadRange(athlete.id, rangeStart, rangeEnd);
    } catch (e) {
      setRescheduleError(e instanceof Error ? e.message : String(e));
    } finally {
      setRescheduling(false);
    }
  }

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

  const today = todayDateStr();

  const rangeLabel =
    view === "week"
      ? (() => {
          const end = addDays(weekCursor, 6);
          const sameMonth = weekCursor.getUTCMonth() === end.getUTCMonth();
          const startLabel = weekCursor.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
          const endLabel = end.toLocaleDateString(undefined, {
            month: sameMonth ? undefined : "short",
            day: "numeric",
            year: end.getUTCFullYear() !== weekCursor.getUTCFullYear() ? "numeric" : undefined,
            timeZone: "UTC",
          });
          return `${startLabel} – ${endLabel}`;
        })()
      : monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  function goToToday() {
    setWeekCursor(startOfWeek(new Date()));
    setMonthCursor(startOfMonth(new Date()));
  }

  function goPrev() {
    if (view === "week") setWeekCursor((w) => addDays(w, -7));
    else setMonthCursor((m) => addMonths(m, -1));
  }

  function goNext() {
    if (view === "week") setWeekCursor((w) => addDays(w, 7));
    else setMonthCursor((m) => addMonths(m, 1));
  }

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-dark">Your schedule</h1>
          <div className="flex rounded-md border border-slate-300 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-sm px-3 py-1 ${view === "week" ? "bg-brand text-white" : "text-slate-500"}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`rounded-sm px-3 py-1 ${view === "month" ? "bg-brand text-white" : "text-slate-500"}`}
            >
              Month
            </button>
          </div>
        </div>

        {loadError && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{loadError}</p>}
        {rescheduleError && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{rescheduleError}</p>
        )}

        {todaySession && (
          <Link
            href={`/app/log/${todaySession.id}`}
            className="mb-6 flex items-center justify-between rounded-md border border-brand bg-blue-50 px-4 py-3 hover:bg-blue-100"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Today</p>
              <p className="font-medium text-brand-dark">
                {workoutIcon(todaySession.day_label).icon} {todaySession.day_label}
              </p>
              <p className="text-xs text-slate-500">{todaySession.exercise_count} exercises</p>
            </div>
            <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white">
              {todaySession.status ? "View" : "Log workout"}
            </span>
          </Link>
        )}

        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={goPrev} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Previous">
            ←
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-brand-dark">{rangeLabel}</h2>
            <button type="button" onClick={goToToday} className="text-xs text-brand underline">
              Today
            </button>
          </div>
          <button type="button" onClick={goNext} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Next">
            →
          </button>
        </div>

        {view === "week" ? (
          <WeekView
            weekStart={weekCursor}
            sessionsByDate={sessionsByDate}
            today={today}
            loading={loading}
            dragSessionId={dragSessionId}
            dropTargetDate={dropTargetDate}
            onDragStart={setDragSessionId}
            onDragEnd={() => setDragSessionId(null)}
            onDragOverDate={setDropTargetDate}
            onDrop={handleDrop}
          />
        ) : (
          <MonthView
            monthCursor={monthCursor}
            sessionsByDate={sessionsByDate}
            today={today}
            loading={loading}
            dragSessionId={dragSessionId}
            dropTargetDate={dropTargetDate}
            onDragStart={setDragSessionId}
            onDragEnd={() => setDragSessionId(null)}
            onDragOverDate={setDropTargetDate}
            onDrop={handleDrop}
          />
        )}

        {rescheduling && <p className="mt-2 text-xs text-slate-400">Moving workout…</p>}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
          <LegendDot colorClass="bg-brand" label="Not logged" />
          <LegendDot colorClass="bg-green-500" label="Logged" />
          <LegendDot colorClass="bg-amber-500" label="Partial" />
          <LegendDot colorClass="bg-slate-400" label="Skipped" />
          <LegendDot colorClass="bg-red-400" label="Missed" />
        </div>
        <p className="mt-2 text-xs text-slate-400">Drag a workout onto another day to reschedule it.</p>

        {!loading && sessionsByDate.size === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Nothing scheduled this {view} — your coach hasn&apos;t published a phase for this window, or your plan
            is still being built.
          </p>
        )}
      </main>
    </>
  );
}

type DragProps = {
  dragSessionId: string | null;
  dropTargetDate: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverDate: (date: string | null) => void;
  onDrop: (date: string) => void;
};

/** One draggable workout chip — shared by the week and month views. */
function SessionChip({
  session,
  dragSessionId,
  onDragStart,
  onDragEnd,
  compact,
}: {
  session: SessionSummary;
  compact?: boolean;
} & Pick<DragProps, "dragSessionId" | "onDragStart" | "onDragEnd">) {
  const { icon, title } = workoutIcon(session.day_label);
  const dragging = dragSessionId === session.id;
  return (
    <Link
      href={`/app/log/${session.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", session.id);
        onDragStart(session.id);
      }}
      onDragEnd={onDragEnd}
      title={`${session.day_label} — ${statusLabel(session.status, session.date)}`}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:border-brand ${
        dragging ? "opacity-40" : ""
      } ${compact ? "" : "border-slate-200"}`}
    >
      <span aria-hidden>{icon}</span>
      {!compact && (
        <span className="flex-1 truncate font-medium text-slate-700" title={title}>
          {session.day_label}
        </span>
      )}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(session.status, session.date)}`} />
    </Link>
  );
}

function WeekView({
  weekStart,
  sessionsByDate,
  today,
  loading,
  ...dragProps
}: {
  weekStart: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  today: string;
  loading: boolean;
} & DragProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
      {days.map((day) => {
        const dateStr = toDateStr(day);
        const sessions = sessionsByDate.get(dateStr) ?? [];
        const isToday = dateStr === today;
        const isDropTarget = dragProps.dropTargetDate === dateStr;
        return (
          <div
            key={dateStr}
            onDragOver={(e) => {
              e.preventDefault();
              dragProps.onDragOverDate(dateStr);
            }}
            onDragLeave={() => dragProps.onDragOverDate(null)}
            onDrop={(e) => {
              e.preventDefault();
              dragProps.onDrop(dateStr);
            }}
            className={`flex items-start gap-3 rounded-md border p-2.5 ${
              isDropTarget ? "border-brand bg-blue-50" : "border-slate-200"
            }`}
          >
            <div className="flex w-14 shrink-0 flex-col items-center pt-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {WEEKDAY_LABELS[day.getUTCDay()]}
              </span>
              <span
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-brand-dark font-semibold text-white" : "text-slate-700"
                }`}
              >
                {day.getUTCDate()}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              {sessions.length === 0 ? (
                <span className="text-xs text-slate-400">—</span>
              ) : (
                sessions.map((s) => (
                  <SessionChip
                    key={s.id}
                    session={s}
                    dragSessionId={dragProps.dragSessionId}
                    onDragStart={dragProps.onDragStart}
                    onDragEnd={dragProps.onDragEnd}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  monthCursor,
  sessionsByDate,
  today,
  loading,
  ...dragProps
}: {
  monthCursor: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  today: string;
  loading: boolean;
} & DragProps) {
  const { gridStart, gridEnd } = calendarGridRange(monthCursor);
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const currentMonthIndex = monthCursor.getUTCMonth();
  const MAX_SHOWN = 3;

  return (
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
            const sessions = sessionsByDate.get(dateStr) ?? [];
            const inMonth = day.getUTCMonth() === currentMonthIndex;
            const isToday = dateStr === today;
            const isDropTarget = dragProps.dropTargetDate === dateStr;
            const shown = sessions.slice(0, MAX_SHOWN);
            const overflow = sessions.length - shown.length;

            return (
              <div
                key={dateStr}
                onDragOver={(e) => {
                  e.preventDefault();
                  dragProps.onDragOverDate(dateStr);
                }}
                onDragLeave={() => dragProps.onDragOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  dragProps.onDrop(dateStr);
                }}
                className={`flex h-20 flex-col items-center gap-1 border-r border-slate-100 py-1.5 last:border-r-0 sm:h-24 ${
                  inMonth ? "" : "opacity-30"
                } ${isDropTarget ? "bg-blue-50" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-brand-dark font-semibold text-white" : "text-slate-600"
                  }`}
                >
                  {day.getUTCDate()}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-0.5 px-0.5">
                  {shown.map((s) => (
                    <SessionChip
                      key={s.id}
                      session={s}
                      compact
                      dragSessionId={dragProps.dragSessionId}
                      onDragStart={dragProps.onDragStart}
                      onDragEnd={dragProps.onDragEnd}
                    />
                  ))}
                  {overflow > 0 && <span className="text-[10px] text-slate-400">+{overflow}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
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
