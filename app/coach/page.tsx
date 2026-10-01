"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };
type ActivePhase = {
  id: string;
  phase_number: number;
  phase_name: string;
  start_date: string;
  end_date: string;
};
type AthleteRow = {
  id: string;
  email: string;
  name: string | null;
  active_phase: ActivePhase | null;
  pending_drafts_count: number;
  last_logged_at: string | null;
  has_intake: boolean;
  has_skeleton: boolean;
  active_injuries_count: number;
};
type DaysChangeRequest = { id: string; athlete_id: string };

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

// Phase-end-date window that counts as "coming up" on the dashboard.
const UPCOMING_PHASE_WINDOW_DAYS = 14;

const SORT_OPTIONS = [
  { value: "attention", label: "Needs attention first" },
  { value: "name", label: "Name (A-Z)" },
  { value: "last_logged", label: "Least recently logged" },
  { value: "phase_end", label: "Phase ending soonest" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function daysUntil(dateStr: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const ms = new Date(dateStr).getTime() - new Date(today).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatLastLogged(iso: string | null) {
  if (!iso) return "Never logged";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Logged today";
  if (days === 1) return "Logged yesterday";
  return `Logged ${days} days ago`;
}

type Flag = {
  key: string;
  label: string;
  className: string;
};

/** Every status badge an athlete currently qualifies for, most-urgent first. */
function computeFlags(a: AthleteRow, hasPendingDaysChange: boolean): Flag[] {
  const flags: Flag[] = [];
  if (a.pending_drafts_count > 0) {
    flags.push({
      key: "pending_review",
      label: `${a.pending_drafts_count} draft${a.pending_drafts_count === 1 ? "" : "s"} awaiting review`,
      className: "bg-amber-100 text-amber-800",
    });
  }
  if (hasPendingDaysChange) {
    flags.push({ key: "days_change", label: "Days/week change requested", className: "bg-purple-100 text-purple-800" });
  }
  if (a.active_injuries_count > 0) {
    flags.push({
      key: "injury",
      label: `${a.active_injuries_count} active injur${a.active_injuries_count === 1 ? "y" : "ies"}`,
      className: "bg-red-100 text-red-700",
    });
  }
  if (a.has_intake && !a.has_skeleton) {
    flags.push({ key: "no_plan", label: "No season plan built", className: "bg-slate-200 text-slate-700" });
  } else if (a.has_skeleton && !a.active_phase && a.pending_drafts_count === 0) {
    flags.push({ key: "between_phases", label: "Between phases", className: "bg-slate-200 text-slate-700" });
  }
  if (a.active_phase) {
    const remaining = daysUntil(a.active_phase.end_date);
    if (remaining < 0) {
      flags.push({ key: "phase_ended", label: "Phase ended", className: "bg-red-100 text-red-700" });
    } else if (remaining <= UPCOMING_PHASE_WINDOW_DAYS) {
      flags.push({
        key: "ending_soon",
        label: remaining === 0 ? "Phase ends today" : `Phase ends in ${remaining}d`,
        className: "bg-blue-100 text-blue-800",
      });
    }
  }
  return flags;
}

function needsAttention(flags: Flag[]) {
  return flags.some((f) => f.key !== "ending_soon");
}

export default function CoachHomePage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [athletes, setAthletes] = useState<AthleteRow[] | null>(null);
  const [pendingDaysChangeIds, setPendingDaysChangeIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("attention");

  async function generatePhaseDraft(athlete: AthleteRow) {
    if (!athlete.active_phase) return;
    setGeneratingId(athlete.id);
    setGenerateError(null);
    try {
      const res = await fetch("/api/phase-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: athlete.id, phaseId: athlete.active_phase.id }),
      });
      const data = await res.json();
      if (data.error) {
        setGenerateError(`${athlete.name ?? athlete.email}: ${data.error}`);
      } else {
        window.location.href = `/review/${data.draft.id}`;
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingId(null);
    }
  }

  async function buildSeasonPlan(athlete: AthleteRow) {
    setGeneratingId(athlete.id);
    setGenerateError(null);
    try {
      const res = await fetch("/api/macrocycle-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: athlete.id }),
      });
      const data = await res.json();
      if (data.error) {
        setGenerateError(`${athlete.name ?? athlete.email}: ${data.error}`);
      } else {
        window.location.href = `/review/${data.draft.id}`;
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingId(null);
    }
  }

  useEffect(() => {
    fetch("/api/me/coach")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCoach(data.coach);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    fetch("/api/coach/athletes")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAthletes(data.athletes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    fetch("/api/coach/days-change-requests?status=pending")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return; // non-critical for the dashboard badges
        const reqs = data.requests as DaysChangeRequest[];
        setPendingDaysChangeIds(new Set(reqs.map((r) => r.athlete_id)));
      })
      .catch(() => {
        // Non-critical — dashboard still works without this badge.
      });
  }, []);

  const totalPending = athletes?.reduce((sum, a) => sum + a.pending_drafts_count, 0) ?? 0;

  const enriched = useMemo(() => {
    if (!athletes) return null;
    return athletes.map((a) => {
      const flags = computeFlags(a, pendingDaysChangeIds.has(a.id));
      return { athlete: a, flags, attention: needsAttention(flags) };
    });
  }, [athletes, pendingDaysChangeIds]);

  const filtered = useMemo(() => {
    if (!enriched) return null;
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      ({ athlete: a }) =>
        (a.name ?? "").toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  function sortRows<T extends { athlete: AthleteRow }>(rows: T[]): T[] {
    const copy = [...rows];
    switch (sort) {
      case "name":
        copy.sort((x, y) => (x.athlete.name ?? x.athlete.email).localeCompare(y.athlete.name ?? y.athlete.email));
        break;
      case "last_logged":
        copy.sort((x, y) => {
          const xt = x.athlete.last_logged_at ? new Date(x.athlete.last_logged_at).getTime() : -Infinity;
          const yt = y.athlete.last_logged_at ? new Date(y.athlete.last_logged_at).getTime() : -Infinity;
          return xt - yt; // stalest first
        });
        break;
      case "phase_end":
        copy.sort((x, y) => {
          const xt = x.athlete.active_phase ? new Date(x.athlete.active_phase.end_date).getTime() : Infinity;
          const yt = y.athlete.active_phase ? new Date(y.athlete.active_phase.end_date).getTime() : Infinity;
          return xt - yt;
        });
        break;
      default:
        break;
    }
    return copy;
  }

  const attentionRows = filtered ? sortRows(filtered.filter((r) => r.attention)) : [];
  const upcomingRows = filtered
    ? sortRows(filtered.filter((r) => !r.attention && r.flags.some((f) => f.key === "ending_soon")))
    : [];
  const restRows = filtered
    ? sortRows(filtered.filter((r) => !r.attention && !r.flags.some((f) => f.key === "ending_soon")))
    : [];

  function AthleteCard({ athlete: a, flags }: { athlete: AthleteRow; flags: Flag[] }) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/coach/athletes/${a.id}/program`} className="font-medium text-brand-dark hover:underline">
              {a.name ?? a.email}
            </Link>
            <Link
              href={`/coach/athletes/${a.id}/profile`}
              className="ml-2 text-xs text-slate-400 underline hover:text-brand"
            >
              Profile
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">
              {a.active_phase
                ? `Phase ${a.active_phase.phase_number}: ${a.active_phase.phase_name}`
                : a.has_skeleton
                  ? "No active phase"
                  : a.has_intake
                    ? "Intake complete — season plan not built yet"
                    : "Intake not started"}
              {" · "}
              {formatLastLogged(a.last_logged_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {a.pending_drafts_count > 0 && (
              <Link
                href={`/review?athleteId=${a.id}`}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
              >
                Review →
              </Link>
            )}
            {a.has_intake && !a.has_skeleton && a.pending_drafts_count === 0 && (
              <button
                type="button"
                onClick={() => buildSeasonPlan(a)}
                disabled={generatingId === a.id}
                className="rounded-full border border-brand px-2 py-0.5 text-xs font-medium text-brand hover:bg-blue-50 disabled:opacity-50"
              >
                {generatingId === a.id ? "Building…" : "Build season plan"}
              </button>
            )}
            {a.active_phase && a.pending_drafts_count === 0 && (
              <button
                type="button"
                onClick={() => generatePhaseDraft(a)}
                disabled={generatingId === a.id}
                className="rounded-full border border-brand px-2 py-0.5 text-xs font-medium text-brand hover:bg-blue-50 disabled:opacity-50"
              >
                {generatingId === a.id ? "Generating…" : "Generate phase draft"}
              </button>
            )}
          </div>
        </div>
        {flags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span key={f.key} className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.className}`}>
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <h1 className="mb-1 text-2xl font-bold text-brand-dark">
          {coach?.name ? `Hey, ${coach.name.split(" ")[0]}` : "Coach dashboard"}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {athletes ? `${athletes.length} athlete${athletes.length === 1 ? "" : "s"}` : "Loading roster…"}
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error} — you may be signed in with a non-coach account.
          </p>
        )}
        {generateError && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{generateError}</p>
        )}

        {enriched && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-brand-dark">{enriched.length}</p>
              <p className="text-xs text-slate-500">Total athletes</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-2xl font-bold text-amber-800">{attentionRows.length}</p>
              <p className="text-xs text-amber-700">Need attention</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-2xl font-bold text-blue-800">{upcomingRows.length}</p>
              <p className="text-xs text-blue-700">Phase change coming up</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-2xl font-bold text-brand-dark">{totalPending}</p>
              <p className="text-xs text-slate-500">Drafts in review queue</p>
            </div>
          </div>
        )}

        {athletes !== null && athletes.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search athletes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortValue)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {athletes === null && !error && <p className="text-sm text-slate-500">Loading roster…</p>}

        {athletes !== null && athletes.length === 0 && (
          <p className="text-sm text-slate-500">No athletes yet — they&apos;ll show up here once someone completes intake.</p>
        )}

        {filtered !== null && athletes !== null && athletes.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-slate-500">No athletes match &ldquo;{search}&rdquo;.</p>
        )}

        {attentionRows.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
              Needs attention ({attentionRows.length})
            </h2>
            <div className="space-y-2">
              {attentionRows.map(({ athlete: a, flags }) => (
                <AthleteCard key={a.id} athlete={a} flags={flags} />
              ))}
            </div>
          </div>
        )}

        {upcomingRows.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
              Upcoming phase changes ({upcomingRows.length})
            </h2>
            <div className="space-y-2">
              {upcomingRows.map(({ athlete: a, flags }) => (
                <AthleteCard key={a.id} athlete={a} flags={flags} />
              ))}
            </div>
          </div>
        )}

        {restRows.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Everyone else ({restRows.length})
            </h2>
            <div className="space-y-2">
              {restRows.map(({ athlete: a, flags }) => (
                <AthleteCard key={a.id} athlete={a} flags={flags} />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
