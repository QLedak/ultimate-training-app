"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Shared between the athlete homepage (/app) and the schedule page
 * (/app/log) — pulled out of a single page file so neither has to duplicate
 * this logic, and so the homepage can show them without re-implementing
 * bodyweight/rebuild handling.
 */

type BodyweightEntry = { id: string; date: string; bodyweight_lb: number };

const todayDateStr = () => new Date().toISOString().slice(0, 10);

export function BodyweightWidget({ athleteId }: { athleteId: string }) {
  const [latest, setLatest] = useState<BodyweightEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/athletes/${athleteId}/bodyweight?limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLatest(data.entries[0] ?? null);
      })
      .catch(() => {
        // Non-critical — the widget just shows nothing logged yet.
      });
  }, [athleteId]);

  async function save() {
    setError(null);
    if (!value || Number.isNaN(Number(value))) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/bodyweight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyweight_lb: Number(value) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLatest(data.entry);
      setEditing(false);
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const latestIsToday = latest?.date === todayDateStr();

  return (
    <div className="mb-6 rounded-md border border-slate-200 p-3">
      {!editing ? (
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium text-slate-700">Bodyweight: </span>
            {latest ? (
              <span className="text-slate-600">
                {latest.bodyweight_lb} lb {latestIsToday ? "(today)" : `(as of ${latest.date})`}
              </span>
            ) : (
              <span className="text-slate-400">Not logged yet</span>
            )}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-brand underline">
            {latestIsToday ? "Update" : "Log today's weight"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            autoFocus
            placeholder="Weight (lb)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-400 underline">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const REASON_OPTIONS = [
  { value: "schedule_change", label: "My schedule changed" },
  { value: "injury_pain", label: "I'm dealing with pain or an injury" },
  { value: "other", label: "Something else" },
];

export function RebuildRequestWidget({ athleteId }: { athleteId: string }) {
  const [open, setOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!reasonCategory) {
      setError("Please choose a reason.");
      return;
    }
    if (!detail.trim()) {
      setError("Let your coach know a bit more detail.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/request-rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason_category: reasonCategory, detail: detail.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResultMessage(data.message);
      setOpen(false);
      setReasonCategory("");
      setDetail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (resultMessage) {
    return (
      <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        {resultMessage}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-6 text-sm text-brand underline">
        Something changed? Request a plan update
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-sm font-medium text-slate-700">What&apos;s going on?</p>
      <div className="mb-2 space-y-1">
        {REASON_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="rebuildReason"
              checked={reasonCategory === opt.value}
              onChange={() => setReasonCategory(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <textarea
        placeholder="Tell your coach a bit more (what changed, what hurts, etc.)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        rows={3}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send to my coach"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 underline">
          Cancel
        </button>
      </div>
    </div>
  );
}


type CheckInInjury = { location: string; since?: string; last_check_in?: string; pending_resolution?: unknown };
const CHECK_IN_AFTER_DAYS = 14;

/**
 * Home-screen prompt so nobody stays on isometric-only work for an injury that
 * has stopped bothering them: for every active injury that hasn't been checked
 * in on for two weeks (and isn't already marked better), asks "still bothering
 * you?" with one-tap answers. See app/api/athletes/[id]/injury-status/route.ts
 * for what each answer does (better = finish this phase, strengthening work
 * starts next phase).
 */
export function InjuryCheckInBanner({ athleteId }: { athleteId: string }) {
  const [due, setDue] = useState<CheckInInjury[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/athletes/${athleteId}/injury-status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        const now = Date.now();
        const list = ((data.current_active_injuries ?? []) as CheckInInjury[]).filter((inj) => {
          if (inj.pending_resolution) return false;
          const ref = inj.last_check_in ?? inj.since;
          if (!ref) return true;
          return now - new Date(ref).getTime() > CHECK_IN_AFTER_DAYS * 24 * 60 * 60 * 1000;
        });
        setDue(list);
      })
      .catch(() => {
        // Non-critical prompt — just don't show it.
      });
  }, [athleteId]);

  async function answer(location: string, status: "resolved" | "still_active") {
    setBusy(location);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/injury-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, status }),
      });
      const data = await res.json();
      if (!data.error) {
        setMessage(data.message ?? "Saved.");
        setDue((d) => d.filter((i) => i.location !== location));
      }
    } finally {
      setBusy(null);
    }
  }

  if (due.length === 0 && !message) return null;
  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3">
      {due.map((inj) => (
        <div key={inj.location} className="mb-2 last:mb-0">
          <p className="text-sm text-amber-900">
            Is your <strong>{inj.location.replace(/_/g, " ")}</strong> still bothering you?
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={busy === inj.location}
              onClick={() => answer(inj.location, "still_active")}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Yes, still bothering me
            </button>
            <button
              type="button"
              disabled={busy === inj.location}
              onClick={() => answer(inj.location, "resolved")}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              No, it&apos;s better
            </button>
          </div>
        </div>
      ))}
      {message && <p className="mt-2 text-xs text-amber-900">{message}</p>}
    </div>
  );
}

/**
 * Season-transition prompt on Home: appears ~4 weeks before the final phase of the
 * season plan ends and stays through the off-season bridge, until next-season
 * dates are in. Links to /app/next-season.
 */
export function NextSeasonBanner({ athleteId }: { athleteId: string }) {
  const [info, setInfo] = useState<{ stage: string; planned: boolean; daysLeft: number | null } | null>(null);

  useEffect(() => {
    fetch(`/api/athletes/${athleteId}/next-season`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setInfo({ stage: data.stage, planned: !!data.planned_season, daysLeft: data.days_until_final_phase_end });
      })
      .catch(() => {
        // Non-critical prompt — just don't show it.
      });
  }, [athleteId]);

  if (!info || info.planned || (info.stage !== "ending_soon" && info.stage !== "bridge")) return null;

  const text =
    info.stage === "bridge"
      ? "Your season is wrapped up and you're in off-season training. Got your next season's dates? Enter them and your coach will build your next plan."
      : `Your current plan ends ${info.daysLeft != null && info.daysLeft >= 0 ? `in ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"}` : "soon"}. Enter next season's dates so your next plan is ready to go.`;

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm text-blue-900">{text}</p>
      <Link href="/app/next-season" className="mt-2 inline-block text-sm font-medium text-brand underline">
        Plan next season →
      </Link>
    </div>
  );
}
