"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };
type AthleteRow = {
  id: string;
  email: string;
  name: string | null;
  active_phase: { id: string; phase_number: number; phase_name: string } | null;
  pending_drafts_count: number;
  last_logged_at: string | null;
  has_intake: boolean;
  has_skeleton: boolean;
};

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

function formatLastLogged(iso: string | null) {
  if (!iso) return "Never logged";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Logged today";
  if (days === 1) return "Logged yesterday";
  return `Logged ${days} days ago`;
}

export default function CoachHomePage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [athletes, setAthletes] = useState<AthleteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

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

  const totalPending = athletes?.reduce((sum, a) => sum + a.pending_drafts_count, 0) ?? 0;

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="mb-1 text-2xl font-bold text-brand-dark">
          {coach?.name ? `Hey, ${coach.name.split(" ")[0]}` : "Coach dashboard"}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {athletes ? `${athletes.length} athlete${athletes.length === 1 ? "" : "s"}` : "Loading roster…"}
          {totalPending > 0 && ` · ${totalPending} draft${totalPending === 1 ? "" : "s"} awaiting review`}
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error} — you may be signed in with a non-coach account.
          </p>
        )}
        {generateError && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{generateError}</p>
        )}

        {totalPending > 0 && (
          <Link
            href="/review"
            className="mb-6 block rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:border-amber-400"
          >
            {totalPending} draft{totalPending === 1 ? "" : "s"} waiting in the review queue →
          </Link>
        )}

        {athletes === null && !error && <p className="text-sm text-slate-500">Loading roster…</p>}

        {athletes !== null && athletes.length === 0 && (
          <p className="text-sm text-slate-500">No athletes yet — they&apos;ll show up here once someone completes intake.</p>
        )}

        {athletes !== null && athletes.length > 0 && (
          <div className="space-y-2">
            {athletes.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-brand-dark">{a.name ?? a.email}</p>
                  <p className="text-xs text-slate-500">
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
                <div className="flex items-center gap-2">
                  {a.pending_drafts_count > 0 && (
                    <Link
                      href={`/review?athleteId=${a.id}`}
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      {a.pending_drafts_count} pending
                    </Link>
                  )}
                  {/* Building the season plan (Call 1, the Macrocycle
                      Planner) is coach-triggered by design — it writes a
                      pending_review draft, never auto-publishes. This is the
                      only place that call gets fired from. */}
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
                  {/* A macrocycle approval only marks a phase "active" — it
                      doesn't generate that phase's actual workouts. That's a
                      separate Phase Builder call (Call 2), which has no
                      other trigger in the UI yet, so it lives here: one
                      click per phase, landing straight on its review draft. */}
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
            ))}
          </div>
        )}
      </main>
    </>
  );
}
