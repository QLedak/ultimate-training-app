"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

type Draft = {
  id: string;
  lineage_id: string;
  athlete_id: string;
  phase_id: string | null;
  call_type: "macrocycle_planner" | "phase_builder";
  version: number;
  status: "pending_review" | "approved" | "rejected";
  publish_to_athlete: boolean | null;
  add_to_corpus: boolean | null;
  edit_source: "chat" | "direct_override" | null;
  edit_request: unknown;
  created_at: string;
  athletes: { email: string; name: string | null } | null;
  output: Record<string, unknown>;
};

type VersionSummary = {
  id: string;
  version: number;
  parent_version: number | null;
  edit_source: string | null;
  status: string;
  created_at: string;
};

type ThreadEntry = {
  id: string;
  entry_type: "chat" | "direct_override";
  role: "coach" | "model" | null;
  text: string | null;
  field_path: string | null;
  old_value: unknown;
  new_value: unknown;
  resulting_version: number;
  created_at: string;
};

function Flags({ flags }: { flags?: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
      <h3 className="mb-2 font-semibold text-amber-900">Flags for coach review</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
        {flags.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

function MacrocycleOutput({ output }: { output: Record<string, unknown> }) {
  const phases = (output.phases ?? []) as Array<Record<string, unknown>>;
  return (
    <>
      <Flags flags={output.flags as string[]} />
      <p className="mb-6 whitespace-pre-wrap text-slate-700">{output.rationale as string}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Phase</th>
              <th className="py-2 pr-3">Goal</th>
              <th className="py-2 pr-3">Dates</th>
              <th className="py-2 pr-3">Weeks</th>
              <th className="py-2 pr-3">Template</th>
              <th className="py-2 pr-3">Deload / test</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p.phase_number as number} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">{p.phase_number as number}</td>
                <td className="py-2 pr-3 font-medium">{p.phase_name as string}</td>
                <td className="py-2 pr-3">{p.goal as string}</td>
                <td className="py-2 pr-3">
                  {p.start_date as string} → {p.end_date as string}
                </td>
                <td className="py-2 pr-3">{p.week_count as number}</td>
                <td className="py-2 pr-3">{p.weekly_template_label as string}</td>
                <td className="py-2 pr-3 text-slate-500">{(p.deload_test_note as string) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PhaseBuilderOutput({
  output,
  exerciseNames,
}: {
  output: Record<string, unknown>;
  exerciseNames: Record<string, string>;
}) {
  const weeks = (output.weeks ?? []) as Array<{
    week_number: number;
    week_type: string;
    days: Array<{ day_label: string; date: string; exercises: Array<Record<string, unknown>> }>;
  }>;
  return (
    <>
      <Flags flags={output.coach_review_flags as string[]} />
      <p className="mb-2 whitespace-pre-wrap text-slate-700">{output.rationale as string}</p>
      <div className="mb-6 rounded-md bg-slate-50 p-3 text-sm italic text-slate-600">
        {output.athlete_intro as string}
      </div>
      <div className="space-y-6">
        {weeks.map((week) => (
          <div key={week.week_number}>
            <h4 className="mb-2 font-semibold text-brand-dark">
              Week {week.week_number} · {week.week_type}
            </h4>
            <div className="space-y-3">
              {week.days.map((day, di) => (
                <div key={di} className="rounded-md border border-slate-200 p-3">
                  <div className="mb-1 text-sm font-medium">
                    {day.day_label} — {day.date}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1 pr-2">Exercise</th>
                        <th className="py-1 pr-2">Sets x reps</th>
                        <th className="py-1 pr-2">Tempo</th>
                        <th className="py-1 pr-2">Rest</th>
                        <th className="py-1 pr-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.exercises.map((ex, ei) => (
                        <tr key={ei} className="border-t border-slate-100">
                          <td className="py-1 pr-2">
                            <span>{exerciseNames[ex.exercise_id as string] ?? "Unknown exercise"}</span>
                            <span className="ml-1 font-mono text-slate-400">({ex.exercise_id as string})</span>
                          </td>
                          <td className="py-1 pr-2">{ex.sets_reps as string}</td>
                          <td className="py-1 pr-2">{(ex.tempo as string) ?? "—"}</td>
                          <td className="py-1 pr-2">{(ex.rest as string) ?? "—"}</td>
                          <td className="py-1 pr-2">{(ex.notes as string) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ReviewDetailPage({ params }: { params: { id: string } }) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [chatMessage, setChatMessage] = useState("");
  const [overrideField, setOverrideField] = useState("");
  const [overrideValue, setOverrideValue] = useState("");
  const [publishToAthlete, setPublishToAthlete] = useState(true);
  const [addToCorpus, setAddToCorpus] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/drafts/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setDraft(data.draft);
          setVersions(data.versions);
          setThread(data.thread);
          setExerciseNames(data.exerciseNames ?? {});
        }
      })
      .catch((e) => setError(String(e)));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function submitChatEdit() {
    if (!chatMessage.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft!.id}/chat-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMessage }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setChatMessage("");
        window.location.href = `/review/${data.draft.id}`;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitDirectOverride() {
    if (!overrideField.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let parsedValue: unknown = overrideValue;
      try {
        parsedValue = JSON.parse(overrideValue);
      } catch {
        // not valid JSON — treat as a plain string, which is the common case
      }
      const res = await fetch(`/api/drafts/${draft!.id}/direct-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_path: overrideField, new_value: parsedValue }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        if (data.warning) setError(data.warning);
        setOverrideField("");
        setOverrideValue("");
        window.location.href = `/review/${data.draft.id}`;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitApprove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft!.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish_to_athlete: publishToAthlete, add_to_corpus: addToCorpus }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitReject(regenerate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft!.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else if (data.newDraft) window.location.href = `/review/${data.newDraft.id}`;
      else window.location.href = "/review";
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && !draft) {
    return (
      <>
        <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
        <main className="mx-auto max-w-3xl px-6 pb-16">
          <p className="text-red-600">{error}</p>
          <Link href="/review" className="text-brand underline">
            Back to review queue
          </Link>
        </main>
      </>
    );
  }

  if (!draft) {
    return (
      <>
        <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
        <main className="mx-auto max-w-3xl px-6 pb-16">
          <p className="text-slate-500">Loading…</p>
        </main>
      </>
    );
  }

  const isPending = draft.status === "pending_review";

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-4xl px-6 pb-16">
      <Link href="/review" className="text-sm text-brand underline">
        ← Review queue
      </Link>

      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">
            {draft.call_type === "macrocycle_planner" ? "Macrocycle Planner" : "Phase Builder"} — v{draft.version}
          </h1>
          <p className="text-sm text-slate-500">
            {draft.athletes?.name ?? draft.athletes?.email} · status: {draft.status}
          </p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {draft.call_type === "macrocycle_planner" ? (
        <MacrocycleOutput output={draft.output} />
      ) : (
        <PhaseBuilderOutput output={draft.output} exerciseNames={exerciseNames} />
      )}

      {/* Version history */}
      {versions.length > 1 && (
        <div className="mt-8 border-t border-slate-200 pt-4">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="text-sm font-medium text-brand underline"
          >
            {showHistory ? "Hide" : "Show"} version history ({versions.length} versions)
          </button>
          {showHistory && (
            <ul className="mt-3 space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                  <span>
                    v{v.version} {v.edit_source ? `(${v.edit_source})` : "(original)"} — {v.status}
                  </span>
                  <Link href={`/review/${v.id}`} className="text-brand underline">
                    view
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Review thread */}
      {thread.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-4">
          <h3 className="mb-3 font-semibold text-brand-dark">Review thread</h3>
          <ul className="space-y-2 text-sm">
            {thread.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 p-2">
                {entry.entry_type === "chat" ? (
                  <>
                    <span className="font-medium">{entry.role === "coach" ? "You" : "Model"}:</span>{" "}
                    {entry.text}
                  </>
                ) : (
                  <>
                    <span className="font-medium">Direct override</span> on{" "}
                    <code className="text-xs">{entry.field_path}</code>:{" "}
                    <code className="text-xs">{JSON.stringify(entry.old_value)}</code> →{" "}
                    <code className="text-xs">{JSON.stringify(entry.new_value)}</code>
                  </>
                )}
                <div className="text-xs text-slate-400">
                  v{entry.resulting_version} · {new Date(entry.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPending && (
        <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">
          {/* Chat edit */}
          <div>
            <h3 className="mb-2 font-semibold text-brand-dark">Chat edit</h3>
            <p className="mb-2 text-xs text-slate-500">
              For anything needing judgment — rebalancing a week, changing emphasis, responding to a
              flag. Regenerates the whole draft as a new version.
            </p>
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 p-2 text-sm"
              placeholder="e.g. Push the deload week in Phase 2 back by one week to avoid landing on a tournament weekend."
            />
            <button
              onClick={submitChatEdit}
              disabled={busy || !chatMessage.trim()}
              className="mt-2 rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Send edit
            </button>
          </div>

          {/* Direct override */}
          <div>
            <h3 className="mb-2 font-semibold text-brand-dark">Direct override</h3>
            <p className="mb-2 text-xs text-slate-500">
              For small, obvious tweaks — no model call. Dot-path into the output, e.g.{" "}
              <code>phases.2.week_count</code> or <code>weeks.0.days.1.exercises.0.exercise_id</code>.
            </p>
            <div className="flex gap-2">
              <input
                value={overrideField}
                onChange={(e) => setOverrideField(e.target.value)}
                placeholder="field_path"
                className="flex-1 rounded-md border border-slate-300 p-2 text-sm"
              />
              <input
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder="new value"
                className="flex-1 rounded-md border border-slate-300 p-2 text-sm"
              />
              <button
                onClick={submitDirectOverride}
                disabled={busy || !overrideField.trim()}
                className="rounded-md bg-slate-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Approve / Reject */}
          <div className="flex flex-wrap items-center gap-6 rounded-md border border-slate-200 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishToAthlete}
                onChange={(e) => setPublishToAthlete(e.target.checked)}
              />
              Publish to athlete
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addToCorpus} onChange={(e) => setAddToCorpus(e.target.checked)} />
              Add to self-consistency corpus
            </label>
            <button
              onClick={submitApprove}
              disabled={busy}
              className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => submitReject(true)}
              disabled={busy}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Reject & regenerate
            </button>
            <button
              onClick={() => submitReject(false)}
              disabled={busy}
              className="rounded-md border border-red-600 px-4 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Reject only
            </button>
          </div>
        </div>
      )}

      {!isPending && (
        <div className="mt-8 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
          This draft is <strong>{draft.status}</strong> — no further actions available on this version.
        </div>
      )}
      </main>
    </>
  );
}
