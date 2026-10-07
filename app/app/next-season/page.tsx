"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";
import { ATHLETE_NAV_LINKS } from "../_components/nav-links";

const NAV_LINKS = ATHLETE_NAV_LINKS;

type Tournament = { start_date: string; end_date: string; label: string; is_priority?: boolean };
type Commitment = { day_of_week: string; time: string; label: string };

type SeasonState = {
  stage: "no_plan" | "in_season_plan" | "ending_soon" | "bridge";
  is_bridge: boolean;
  active_season: { label: string; season_end: string | null } | null;
  planned_season:
    | (({
        id: string;
        label: string;
        season_start: string | null;
        season_end: string | null;
        recurring_commitments: Commitment[];
        tournament_weekends: Tournament[];
        skeleton_id: string | null;
        intake_changes: { training_days_per_week?: number; goals?: string };
      }) & { draft_status: "none" | "pending_review" | "approved" | "rejected" })
    | null;
  days_until_final_phase_end: number | null;
  prefill: { training_days_per_week: number | null; goals: string | null; equipment: string[]; active_injuries: number };
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_OPTIONS = [2, 3, 4, 5, 6];
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

/**
 * "Plan next season": the year-over-year entry point. Season dates are the only
 * required input; days/week and goals are prefilled and only sent if the athlete
 * changes them (equipment + injuries have their own screens, linked below).
 */
export default function NextSeasonPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/next-season");
  const [state, setState] = useState<SeasonState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [days, setDays] = useState<number | null>(null);
  const [goals, setGoals] = useState("");

  function load(athleteId: string) {
    fetch(`/api/athletes/${athleteId}/next-season`)
      .then((r) => r.json())
      .then((data: SeasonState & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setState(data);
        const p = data.planned_season;
        setSeasonStart(p?.season_start ?? "");
        setSeasonEnd(p?.season_end ?? "");
        setTournaments(p?.tournament_weekends ?? []);
        setCommitments(p?.recurring_commitments ?? []);
        setDays(p?.intake_changes?.training_days_per_week ?? data.prefill.training_days_per_week);
        setGoals(p?.intake_changes?.goals ?? data.prefill.goals ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    if (athlete) load(athlete.id);
  }, [athlete]);

  function updateTournament(i: number, patch: Partial<Tournament>) {
    setTournaments((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function setPriority(i: number) {
    setTournaments((ts) => ts.map((t, idx) => ({ ...t, is_priority: idx === i ? !t.is_priority : false })));
  }

  async function submit() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/next-season`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_start: seasonStart,
          season_end: seasonEnd,
          tournament_weekends: tournaments.filter((t) => t.start_date),
          recurring_commitments: commitments.filter((c) => c.label || c.time),
          season_calendar_confirmed: true,
          training_days_per_week: days ?? undefined,
          goals,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(data.message);
      load(athlete.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function cancelPlanned() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/next-season`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage("Removed. You'll keep rolling through off-season training blocks until you enter new dates.");
      load(athlete.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

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
  if (!athlete || !state) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
        {(error || sessionLoadError) && <p className="mt-2 text-sm text-red-600">{error ?? sessionLoadError}</p>}
      </main>
    );
  }

  const planned = state.planned_season;
  const approved = !!planned?.skeleton_id;
  const intro =
    state.stage === "bridge"
      ? "Your season has wrapped up. You're in off-season training blocks that keep going until you enter new dates — then your coach builds your next plan from them."
      : state.stage === "ending_soon"
        ? "Your current plan is close to done. Enter next season's dates now and your next plan will be ready to start right after it."
        : "Know your next season's dates already? Enter them and your coach will build a plan that picks up right after your current one.";

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="text-2xl font-bold text-brand-dark">Plan next season</h1>
        <p className="mt-1 text-sm text-slate-500">{intro}</p>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        {planned && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            {approved
              ? `Your ${planned.label} plan is approved and scheduled to start when your current block finishes. Message your coach if any dates change.`
              : planned.draft_status === "pending_review"
                ? `Your ${planned.label} dates are in — your coach is reviewing the plan. You keep training as scheduled meanwhile.`
                : planned.draft_status === "rejected"
                  ? `Your ${planned.label} dates are saved. Your coach is reworking the plan.`
                  : `Your ${planned.label} dates are saved. Your plan is being drafted.`}
          </div>
        )}

        {!approved && (
          <>
            <div className="mt-6 flex gap-3">
              <label className="block flex-1">
                <span className="mb-1 block text-sm font-medium text-slate-700">Season start</span>
                <input type="date" className={inputClass} value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
              </label>
              <label className="block flex-1">
                <span className="mb-1 block text-sm font-medium text-slate-700">Season end</span>
                <input type="date" className={inputClass} value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
              </label>
            </div>

            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Tournaments & league weekends</h2>
              <p className="mb-3 text-xs text-slate-500">
                Check &ldquo;Most important&rdquo; on the one event you most want to peak for. Only one can be checked.
              </p>
              <div className="space-y-3">
                {tournaments.map((t, i) => (
                  <div key={i} className={`space-y-2 rounded-md border p-3 ${t.is_priority ? "border-brand bg-blue-50" : "border-slate-200"}`}>
                    <input placeholder="Name" className={inputClass} value={t.label} onChange={(e) => updateTournament(i, { label: e.target.value })} />
                    <div className="flex gap-2">
                      <input type="date" className={inputClass} value={t.start_date} onChange={(e) => updateTournament(i, { start_date: e.target.value })} />
                      <input type="date" className={inputClass} value={t.end_date} onChange={(e) => updateTournament(i, { end_date: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!t.is_priority} onChange={() => setPriority(i)} /> Most important
                      </label>
                      <button type="button" className="text-sm text-slate-400 underline" onClick={() => setTournaments((ts) => ts.filter((_, idx) => idx !== i))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTournaments((ts) => [...ts, { start_date: "", end_date: "", label: "", is_priority: false }])}
                className="mt-3 text-sm font-medium text-brand underline"
              >
                + Add a tournament
              </button>
            </div>

            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Regular practices / league nights</h2>
              <div className="space-y-2">
                {commitments.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      className={inputClass}
                      value={c.day_of_week}
                      onChange={(e) => setCommitments((cs) => cs.map((x, idx) => (idx === i ? { ...x, day_of_week: e.target.value } : x)))}
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      placeholder="e.g. Team practice"
                      className={inputClass}
                      value={c.label}
                      onChange={(e) => setCommitments((cs) => cs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <button type="button" className="text-sm text-slate-400 underline" onClick={() => setCommitments((cs) => cs.filter((_, idx) => idx !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCommitments((cs) => [...cs, { day_of_week: "Tuesday", time: "", label: "" }])}
                className="mt-3 text-sm font-medium text-brand underline"
              >
                + Add a practice
              </button>
            </div>

            <div className="mt-8 rounded-lg border border-slate-200 p-4">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Anything changed?</h2>
              <p className="mb-3 text-xs text-slate-500">Leave these alone if nothing changed — we only update what you edit.</p>
              <p className="mb-1 text-sm font-medium text-slate-700">Training days per week</p>
              <div className="mb-4 flex gap-2">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`h-10 w-10 rounded-md border text-sm font-medium ${
                      days === d ? "border-brand bg-blue-50 text-brand-dark" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Goals</span>
                <textarea className={inputClass} rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
              </label>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link href="/app/equipment" className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:border-brand hover:text-brand">
                  Equipment changed? →
                </Link>
                <Link href="/app/injuries" className="rounded-md border border-slate-300 px-3 py-2 text-center text-sm text-slate-700 hover:border-brand hover:text-brand">
                  Injury status? →
                </Link>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={submit}
                disabled={saving || !seasonStart || !seasonEnd}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : planned ? "Update my dates" : "Send to my coach"}
              </button>
              {planned && (
                <button type="button" onClick={cancelPlanned} disabled={saving} className="text-sm text-slate-500 underline disabled:opacity-50">
                  Remove these dates
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
