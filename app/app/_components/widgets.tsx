"use client";

import { useEffect, useState } from "react";

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
