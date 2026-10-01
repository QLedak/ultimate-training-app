"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };
type AthleteRow = { id: string; email: string; name: string | null };

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

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

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

/**
 * Coach-facing "current program" view — the season plan a coach lands on
 * from the dashboard to see what an athlete is actually training on right
 * now, without digging through the review queue's status filter for it.
 * Read-only: the phase list here comes from the athlete's already-APPROVED
 * macrocycle skeleton, and the two links below jump into the full read-only
 * draft detail (/review/[id], which already renders approved drafts fine,
 * just without the approve/edit actions since those require pending_review).
 */
export default function CoachAthleteProgramPage({ params }: { params: { id: string } }) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [athlete, setAthlete] = useState<AthleteRow | null>(null);
  const [phases, setPhases] = useState<Phase[] | null>(null);
  const [skeletonDraftId, setSkeletonDraftId] = useState<string | null>(null);
  const [activePhaseDraftId, setActivePhaseDraftId] = useState<string | null>(null);
  const [season, setSeason] = useState<{ start: string; end: string; confirmed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/coach")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setCoach(data.coach);
      })
      .catch(() => {
        // Non-critical — NavBar just shows without a name.
      });
  }, []);

  useEffect(() => {
    fetch("/api/coach/athletes")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const found = (data.athletes as AthleteRow[]).find((a) => a.id === params.id);
        setAthlete(found ?? { id: params.id, email: "", name: null });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/athletes/${params.id}/program`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPhases(data.phases);
        setSeason(data.season);
        setSkeletonDraftId(data.skeleton_draft_id ?? null);
        setActivePhaseDraftId(data.active_phase_draft_id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id]);

  const activePhase = phases?.find((p) => p.status === "active") ?? null;

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <Link href="/coach" className="text-sm text-brand underline">
          ← Coach dashboard
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-brand-dark">
            {athlete?.name ?? athlete?.email ?? "Athlete"}&apos;s current program
          </h1>
          <Link href={`/coach/athletes/${params.id}/profile`} className="text-sm text-brand underline">
            View profile →
          </Link>
        </div>
        {season && (
          <p className="mt-1 text-sm text-slate-500">
            Season: {season.start} → {season.end}
            {!season.confirmed && " · schedule provisional"}
          </p>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        {phases === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

        {phases !== null && phases.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            No season plan built yet for this athlete — build one from the coach dashboard.
          </p>
        )}

        {skeletonDraftId && (
          <Link
            href={`/review/${skeletonDraftId}`}
            className="mt-4 block rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand"
          >
            View full season plan (all phases, rationale) →
          </Link>
        )}

        {activePhase && (
          <div className="mt-6 rounded-md border border-brand bg-blue-50 p-4">
            <p className="text-sm font-medium text-brand-dark">
              Currently in Phase {activePhase.phase_number}: {activePhase.phase_name}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {GOAL_LABELS[activePhase.goal] ?? activePhase.goal} · {activePhase.start_date} →{" "}
              {activePhase.end_date} · {activePhase.weekly_template_label}
            </p>
            {activePhaseDraftId ? (
              <Link
                href={`/review/${activePhaseDraftId}`}
                className="mt-3 inline-block rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                View this phase's full workouts →
              </Link>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                This phase's workouts haven&apos;t been generated/approved yet.
              </p>
            )}
          </div>
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
      </main>
    </>
  );
}
