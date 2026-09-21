"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type SessionDetail = {
  session: {
    id: string;
    date: string;
    phase_id: string;
    week_number: number;
    day_label: string;
    week_type: "build" | "deload" | "test";
  };
  session_log: {
    status: "completed" | "partially_completed" | "skipped";
    skip_reason: string | null;
    skip_reason_other_text: string | null;
    overall_notes: string | null;
  } | null;
  exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    cue: string | null;
    tier: 1 | 2 | 3;
    circuit_label: string | null;
    prescribed_target: string | null;
    prescribed_weight_hint: number | null;
    tempo: string | null;
    rest: string | null;
    coach_notes: string | null;
    logged: {
      weight_used: number | null;
      reps_completed: number | null;
      sets_completed: number | null;
      rir: number | null;
      substituted_exercise_id: string | null;
      substitution_reason: string | null;
      load_descriptor: string | null;
      notes: string | null;
    } | null;
    last_time: {
      weight_used: number | null;
      reps_completed: number | null;
      load_descriptor: string | null;
      date: string | null;
    } | null;
  }>;
};

type ExerciseFormState = {
  included: boolean; // whether this row gets submitted at all
  weight: string;
  reps: string;
  sets: string;
  rir: string; // "" | "0".."5"
  loadDescriptor: string;
  notes: string;
  substituted: boolean;
  substitutedExerciseId: string;
  substitutionReason: string;
  isTrueMax: boolean;
};

const SKIP_REASONS = [
  { value: "pain_injury", label: "Pain / injury" },
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "illness", label: "Illness" },
  { value: "no_equipment", label: "No equipment available" },
  { value: "other", label: "Other" },
];

const TIER2_OPTIONS = [
  { value: "", label: "—" },
  { value: "easy", label: "Completed comfortably" },
  { value: "hard", label: "Completed, but it was hard" },
  { value: "failed", label: "Couldn't complete the prescribed dose" },
];

function tier2ToRir(v: string): number | null {
  if (v === "easy") return 4;
  if (v === "hard") return 2;
  if (v === "failed") return 0;
  return null;
}

function rirToTier2(rir: number | null): string {
  if (rir == null) return "";
  if (rir >= 3) return "easy";
  if (rir >= 1) return "hard";
  return "failed";
}

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

function blankExerciseForm(): ExerciseFormState {
  return {
    included: false,
    weight: "",
    reps: "",
    sets: "",
    rir: "",
    loadDescriptor: "",
    notes: "",
    substituted: false,
    substitutedExerciseId: "",
    substitutionReason: "",
    isTrueMax: false,
  };
}

export default function SessionLogPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [status, setStatus] = useState<"completed" | "partially_completed" | "skipped" | "">("");
  const [skipReason, setSkipReason] = useState("");
  const [skipReasonOtherText, setSkipReasonOtherText] = useState("");
  const [overallNotes, setOverallNotes] = useState("");
  const [forms, setForms] = useState<Record<string, ExerciseFormState>>({});
  const [loggedExerciseIds, setLoggedExerciseIds] = useState<Set<string>>(new Set());
  const [unlogError, setUnlogError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d: SessionDetail | { error: string }) => {
        if ("error" in d) throw new Error(d.error);
        setData(d);
        if (d.session_log) {
          setStatus(d.session_log.status);
          setSkipReason(d.session_log.skip_reason ?? "");
          setSkipReasonOtherText(d.session_log.skip_reason_other_text ?? "");
          setOverallNotes(d.session_log.overall_notes ?? "");
        }
        const initialForms: Record<string, ExerciseFormState> = {};
        const loggedIds = new Set<string>();
        for (const ex of d.exercises) {
          const f = blankExerciseForm();
          if (ex.logged) {
            loggedIds.add(ex.exercise_id);
            f.included = true;
            f.weight = ex.logged.weight_used?.toString() ?? "";
            f.reps = ex.logged.reps_completed?.toString() ?? "";
            f.sets = ex.logged.sets_completed?.toString() ?? "";
            f.rir = ex.tier === 2 ? rirToTier2(ex.logged.rir) : ex.logged.rir?.toString() ?? "";
            f.loadDescriptor = ex.logged.load_descriptor ?? "";
            f.notes = ex.logged.notes ?? "";
            f.substituted = !!ex.logged.substituted_exercise_id;
            f.substitutedExerciseId = ex.logged.substituted_exercise_id ?? "";
            f.substitutionReason = ex.logged.substitution_reason ?? "";
          } else if (ex.tier === 1 || ex.tier === 2) {
            // Nothing logged yet for this exercise on this day — pre-fill the
            // weight from today's own prescription first (still fully
            // editable), falling back to what was last actually used if the
            // prescription didn't include a parseable number.
            f.weight =
              ex.prescribed_weight_hint != null
                ? String(ex.prescribed_weight_hint)
                : ex.last_time?.weight_used != null
                ? String(ex.last_time.weight_used)
                : "";
            f.reps = ex.last_time?.reps_completed != null ? String(ex.last_time.reps_completed) : "";
            f.loadDescriptor = ex.last_time?.load_descriptor ?? "";
          }
          initialForms[ex.exercise_id] = f;
        }
        setForms(initialForms);
        setLoggedExerciseIds(loggedIds);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [sessionId]);

  function updateForm(exerciseId: string, patch: Partial<ExerciseFormState>) {
    setForms((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], ...patch } }));
  }

  async function handleUnlog(exerciseId: string) {
    setUnlogError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/log?exerciseId=${encodeURIComponent(exerciseId)}`, {
        method: "DELETE",
      });
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      setLoggedExerciseIds((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      setForms((prev) => ({ ...prev, [exerciseId]: blankExerciseForm() }));
    } catch (e) {
      setUnlogError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit() {
    if (!data) return;
    setSubmitError(null);

    if (!status) {
      setSubmitError("Let us know how the session went.");
      return;
    }
    if ((status === "skipped" || status === "partially_completed") && !skipReason) {
      setSubmitError("Please choose a reason.");
      return;
    }
    if (skipReason === "other" && !skipReasonOtherText.trim()) {
      setSubmitError("Please describe the reason.");
      return;
    }

    const exercisesPayload: Array<Record<string, unknown>> = [];
    if (status !== "skipped") {
      for (const ex of data.exercises) {
        const f = forms[ex.exercise_id];
        if (!f) continue;

        if (ex.tier === 1) {
          // Tier 1 always gets submitted if any data was entered — required
          // fields are enforced by the server too, but we check here first
          // for a faster/clearer error.
          const touched = f.weight || f.reps || f.rir || f.substituted;
          if (!touched) continue;
          if (!f.weight || !f.reps || !f.rir) {
            setSubmitError(`${ex.exercise_name}: weight, reps, and RIR are all required for this lift.`);
            return;
          }
          if (f.substituted && !f.substitutionReason.trim()) {
            setSubmitError(`${ex.exercise_name}: please note why you substituted.`);
            return;
          }
          exercisesPayload.push({
            exercise_id: ex.exercise_id,
            substituted_exercise_id: f.substituted ? f.substitutedExerciseId || null : null,
            substitution_reason: f.substituted ? f.substitutionReason : null,
            weight_used: Number(f.weight),
            reps_completed: Number(f.reps),
            sets_completed: f.sets ? Number(f.sets) : null,
            rir: Number(f.rir),
            load_descriptor: f.loadDescriptor || null,
            notes: f.notes || null,
            is_true_max: f.isTrueMax,
          });
        } else if (ex.tier === 2) {
          if (!f.rir) continue; // "how did it go" left blank = not logged
          if (f.substituted && !f.substitutionReason.trim()) {
            setSubmitError(`${ex.exercise_name}: please note why you substituted.`);
            return;
          }
          exercisesPayload.push({
            exercise_id: ex.exercise_id,
            substituted_exercise_id: f.substituted ? f.substitutedExerciseId || null : null,
            substitution_reason: f.substituted ? f.substitutionReason : null,
            weight_used: f.weight ? Number(f.weight) : null,
            reps_completed: f.reps ? Number(f.reps) : null,
            sets_completed: f.sets ? Number(f.sets) : null,
            rir: tier2ToRir(f.rir),
            load_descriptor: f.loadDescriptor || null,
            notes: f.notes || null,
          });
        } else {
          if (!f.included) continue; // unchecked = untouched, left unlogged
          exercisesPayload.push({
            exercise_id: ex.exercise_id,
            weight_used: f.weight ? Number(f.weight) : null,
            reps_completed: f.reps ? Number(f.reps) : null,
            notes: f.notes || null,
          });
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          skip_reason: skipReason || null,
          skip_reason_other_text: skipReasonOtherText || null,
          overall_notes: overallNotes || null,
          exercises: exercisesPayload,
        }),
      });
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      setSaved(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{loadError}</p>
        <Link href="/app/log" className="mt-4 inline-block text-sm text-brand underline">
          Back to schedule
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (saved) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-dark">Logged.</h1>
        <p className="mt-2 text-slate-600">Nice work. On to the next one.</p>
        <button
          type="button"
          onClick={() => router.push("/app/log")}
          className="mt-6 rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to schedule
        </button>
      </main>
    );
  }

  const { session, exercises } = data;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/app/log" className="text-xs text-slate-400 underline">
        ← Back to schedule
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-brand-dark">{session.day_label}</h1>
        {session.week_type !== "build" && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            {session.week_type === "deload" ? "Deload week" : "Testing week"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {session.date} · Week {session.week_number}
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">How did today go?</span>
          <div className="flex gap-2">
            {[
              { value: "completed", label: "Completed" },
              { value: "partially_completed", label: "Partially completed" },
              { value: "skipped", label: "Skipped" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value as typeof status)}
                className={`rounded-md border px-3 py-2 text-sm ${
                  status === opt.value ? "border-brand bg-blue-50 text-brand" : "border-slate-300 text-slate-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(status === "skipped" || status === "partially_completed") && (
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Why?</span>
            <select className={inputClass} value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {SKIP_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {skipReason === "other" && (
              <input
                className={`${inputClass} mt-2`}
                placeholder="Describe what happened"
                value={skipReasonOtherText}
                onChange={(e) => setSkipReasonOtherText(e.target.value)}
              />
            )}
          </div>
        )}

        {unlogError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{unlogError}</p>}

        {status !== "skipped" && (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <ExerciseRow
                key={ex.exercise_id}
                exercise={ex}
                form={forms[ex.exercise_id] ?? blankExerciseForm()}
                weekType={session.week_type}
                isLogged={loggedExerciseIds.has(ex.exercise_id)}
                onChange={(patch) => updateForm(ex.exercise_id, patch)}
                onUnlog={() => handleUnlog(ex.exercise_id)}
              />
            ))}
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Anything else about today? (optional)</span>
          <textarea
            className={inputClass}
            rows={2}
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
          />
        </div>

        {submitError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{submitError}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save log"}
        </button>
      </div>
    </main>
  );
}

function ExerciseRow({
  exercise,
  form,
  weekType,
  isLogged,
  onChange,
  onUnlog,
}: {
  exercise: SessionDetail["exercises"][number];
  form: ExerciseFormState;
  weekType: "build" | "deload" | "test";
  isLogged: boolean;
  onChange: (patch: Partial<ExerciseFormState>) => void;
  onUnlog: () => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-medium text-slate-800">
          {exercise.circuit_label ? `${exercise.circuit_label}. ` : ""}
          {exercise.exercise_name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Target: {exercise.prescribed_target || "—"}</span>
          {isLogged && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove your logged result for ${exercise.exercise_name}?`)) onUnlog();
              }}
              className="text-xs text-red-500 underline"
            >
              Remove log
            </button>
          )}
        </div>
      </div>
      {exercise.cue && <p className="mb-2 text-xs text-slate-500">{exercise.cue}</p>}
      {exercise.last_time && (exercise.tier === 1 || exercise.tier === 2) && (
        <p className="mb-2 text-xs text-slate-400">
          Last time ({exercise.last_time.date}): {exercise.last_time.load_descriptor || exercise.last_time.weight_used}
          {exercise.last_time.reps_completed ? ` x ${exercise.last_time.reps_completed}` : ""}
        </p>
      )}

      {exercise.tier === 1 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Weight (lb)"
              className={inputClass}
              value={form.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder="Reps"
              className={inputClass}
              value={form.reps}
              onChange={(e) => onChange({ reps: e.target.value })}
            />
            <input
              type="number"
              placeholder="Sets (if < prescribed)"
              className={inputClass}
              value={form.sets}
              onChange={(e) => onChange({ sets: e.target.value })}
            />
          </div>
          <select className={inputClass} value={form.rir} onChange={(e) => onChange({ rir: e.target.value })}>
            <option value="">RIR (reps in reserve)</option>
            <option value="0">0 — failed rep</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5+ — very easy</option>
          </select>
          {weekType === "test" && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.isTrueMax}
                onChange={(e) => onChange({ isTrueMax: e.target.checked })}
              />
              This was a true 1RM/PR attempt (not an estimate)
            </label>
          )}
          <SubstitutionFields form={form} onChange={onChange} />
          <input
            placeholder="Load descriptor (band color, vest, etc — optional)"
            className={inputClass}
            value={form.loadDescriptor}
            onChange={(e) => onChange({ loadDescriptor: e.target.value })}
          />
          <input
            placeholder="Notes (optional)"
            className={inputClass}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      )}

      {exercise.tier === 2 && (
        <div className="space-y-2">
          <select className={inputClass} value={form.rir} onChange={(e) => onChange({ rir: e.target.value })}>
            {TIER2_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Weight/load (optional)"
              className={inputClass}
              value={form.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder="Reps (optional)"
              className={inputClass}
              value={form.reps}
              onChange={(e) => onChange({ reps: e.target.value })}
            />
          </div>
          <SubstitutionFields form={form} onChange={onChange} />
          <input
            placeholder="Notes (optional)"
            className={inputClass}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      )}

      {exercise.tier === 3 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.included} onChange={(e) => onChange({ included: e.target.checked })} />
            Completed
          </label>
          {form.included && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Weight (optional)"
                className={inputClass}
                value={form.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
              />
              <input
                type="number"
                placeholder="Reps (optional)"
                className={inputClass}
                value={form.reps}
                onChange={(e) => onChange({ reps: e.target.value })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubstitutionFields({
  form,
  onChange,
}: {
  form: ExerciseFormState;
  onChange: (patch: Partial<ExerciseFormState>) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={form.substituted} onChange={(e) => onChange({ substituted: e.target.checked })} />
        I did something different than prescribed
      </label>
      {form.substituted && (
        <div className="mt-1 flex gap-2">
          <input
            placeholder="What did you do instead? (exercise name/id)"
            className={inputClass}
            value={form.substitutedExerciseId}
            onChange={(e) => onChange({ substitutedExerciseId: e.target.value })}
          />
          <input
            placeholder="Why?"
            className={inputClass}
            value={form.substitutionReason}
            onChange={(e) => onChange({ substitutionReason: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
