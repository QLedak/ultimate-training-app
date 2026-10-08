"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

type DraftSummary = {
  id: string;
  lineage_id: string;
  athlete_id: string;
  call_type: "macrocycle_planner" | "phase_builder";
  version: number;
  status: string;
  created_at: string;
  athletes: { email: string; name: string | null } | null;
  output: { flags?: string[]; coach_review_flags?: string[] };
};

const CALL_TYPE_LABEL: Record<string, string> = {
  macrocycle_planner: "Macrocycle Planner (Call 1)",
  phase_builder: "Phase Builder (Call 2)",
};

type DaysChangeRequest = {
  id: string;
  athlete_id: string;
  current_days_per_week: number;
  requested_days_per_week: number;
  note: string | null;
  status: string;
  requested_at: string;
  athletes: { name: string | null; email: string } | null;
};

export default function ReviewListPage() {
  return (
    <Suspense fallback={null}>
      <ReviewList />
    </Suspense>
  );
}

function ReviewList() {
  const searchParams = useSearchParams();
  const athleteId = searchParams.get("athleteId");

  const [coach, setCoach] = useState<Coach | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending_review");

  const [daysRequests, setDaysRequests] = useState<DaysChangeRequest[] | null>(null);
  const [daysActionError, setDaysActionError] = useState<string | null>(null);
  const [daysActionBusyId, setDaysActionBusyId] = useState<string | null>(null);
  const [daysResultNote, setDaysResultNote] = useState<string | null>(null);

  function loadDaysRequests() {
    fetch("/api/coach/days-change-requests")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setDaysRequests(data.requests);
      })
      .catch((e) => setDaysActionError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    loadDaysRequests();
  }, []);

  async function handleApproveDaysRequest(id: string) {
    setDaysActionBusyId(id);
    setDaysActionError(null);
    setDaysResultNote(null);
    try {
      const res = await fetch(`/api/coach/days-change-requests/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDaysResultNote(data.note ?? "Approved — new draft(s) are in the queue below.");
      loadDaysRequests();
    } catch (e) {
      setDaysActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setDaysActionBusyId(null);
    }
  }

  async function handleDeclineDaysRequest(id: string) {
    setDaysActionBusyId(id);
    setDaysActionError(null);
    setDaysResultNote(null);
    try {
      const res = await fetch(`/api/coach/days-change-requests/${id}/decline`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadDaysRequests();
    } catch (e) {
      setDaysActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setDaysActionBusyId(null);
    }
  }

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
    setDrafts(null);
    const params = new URLSearchParams({ status: statusFilter });
    if (athleteId) params.set("athleteId", athleteId);
    fetch(`/api/drafts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDrafts(data.drafts);
      })
      .catch((e) => setError(String(e)));
  }, [statusFilter, athleteId]);

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-4xl px-6 pb-16">
      {daysRequests && daysRequests.filter((r) => r.status === "pending").length > 0 && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
            Training days/week change requests
          </h2>
          {daysActionError && <p className="mb-3 text-sm text-red-600">{daysActionError}</p>}
          {daysResultNote && <p className="mb-3 text-sm text-amber-900">{daysResultNote}</p>}
          <ul className="space-y-3">
            {daysRequests
              .filter((r) => r.status === "pending")
              .map((r) => (
                <li key={r.id} className="rounded-md border border-amber-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-brand-dark">
                      {r.athletes?.name ?? r.athletes?.email ?? r.athlete_id}
                    </span>
                    <span className="text-sm text-slate-600">
                      {r.current_days_per_week} → <span className="font-semibold">{r.requested_days_per_week}</span> days/week
                    </span>
                  </div>
                  {r.note && <p className="mt-1 text-sm italic text-slate-500">&ldquo;{r.note}&rdquo;</p>}
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleApproveDaysRequest(r.id)}
                      disabled={daysActionBusyId === r.id}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {daysActionBusyId === r.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineDaysRequest(r.id)}
                      disabled={daysActionBusyId === r.id}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-dark">
          Review queue{athleteId && drafts?.[0]?.athletes ? ` — ${drafts[0].athletes.name ?? drafts[0].athletes.email}` : ""}
        </h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!error && drafts === null && <p className="text-slate-500">Loading…</p>}
      {drafts && drafts.length === 0 && (
        <p className="text-slate-500">No drafts with status &ldquo;{statusFilter}&rdquo;.</p>
      )}

      <ul className="space-y-3">
        {drafts?.map((draft) => {
          const flags = draft.output?.flags ?? draft.output?.coach_review_flags ?? [];
          return (
            <li key={draft.id}>
              <Link
                href={`/review/${draft.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-brand hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand-dark">
                    {CALL_TYPE_LABEL[draft.call_type] ?? draft.call_type}
                  </span>
                  <span className="text-xs text-slate-500">v{draft.version}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {draft.athletes?.name ?? draft.athletes?.email ?? draft.athlete_id}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(draft.created_at).toLocaleString()} · status: {draft.status}
                </div>
                {flags.length > 0 && (
                  <div className="mt-2 text-xs text-amber-700">
                    {flags.length} flag{flags.length === 1 ? "" : "s"} for review
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      </main>
    </>
  );
}
