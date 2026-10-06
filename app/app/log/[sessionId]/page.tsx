"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { parsePrescribedTarget, parseRestSeconds, parseTimedTarget } from "@/lib/pps/parse-prescription";
import { suggestNextWeight } from "@/lib/training/autoregulate";
import { EFFORT_SCALE, EffortLevel, effortToRir, rirToEffort } from "@/lib/training/perceived-effort";
import { isSupersetLabel, supersetGroupKey } from "@/lib/training/display-labels";
import { startRestTimer, clearRestTimer, RestTimerState } from "@/lib/training/rest-timer-store";
import { useRestTimer } from "@/components/training/useRestTimer";

type SetResult = { set_number: number; weight_used: number | null; reps_completed: number | null; rir: number | null };

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
    alternatives: Array<{ exercise_id: string; exercise_name: string; uses_dumbbells?: boolean }>;
    // True when loaded with dumbbells — shows the "per dumbbell" weight hint.
    uses_dumbbells?: boolean;
    // Ramping warmup sets for this lift, lightest to heaviest — attached
    // display-only guidance, never a separately logged set. Empty/absent for
    // anything that isn't a Tier-1 main lift with a fixed working weight.
    warmup: Array<{ sets_reps: string; suggested_weight: number }>;
    logged: {
      weight_used: number | null;
      reps_completed: number | null;
      sets_completed: number | null;
      rir: number | null;
      substituted_exercise_id: string | null;
      substitution_reason: string | null;
      load_descriptor: string | null;
      notes: string | null;
      set_results: SetResult[] | null;
    } | null;
    last_time: {
      weight_used: number | null;
      reps_completed: number | null;
      load_descriptor: string | null;
      date: string | null;
    } | null;
  }>;
};

type ExercisePayload = {
  exercise_id: string;
  substituted_exercise_id?: string | null;
  substitution_reason?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  sets_completed?: number | null;
  rir?: number | null;
  load_descriptor?: string | null;
  notes?: string | null;
  is_true_max?: boolean;
  set_results?: SetResult[];
};

type ExerciseFormState = {
  included: boolean; // whether this row gets submitted at all
  weight: string;
  reps: string;
  sets: string;
  rir: EffortLevel | ""; // set-difficulty slider value; see lib/training/perceived-effort.ts
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

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

function blankExerciseForm(): ExerciseFormState {
  return {
    included: false,
    weight: "",
    reps: "",
    sets: "",
    rir: "moderate",
    loadDescriptor: "",
    notes: "",
    substituted: false,
    substitutedExerciseId: "",
    substitutionReason: "",
    isTrueMax: false,
  };
}

type SubmitPayload = {
  status: "completed" | "partially_completed" | "skipped";
  skip_reason?: string | null;
  skip_reason_other_text?: string | null;
  overall_notes?: string | null;
  exercises: ExercisePayload[];
};

export default function SessionLogPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"overview" | "guided" | "manual">("overview");

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

  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

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
            f.rir = rirToEffort(ex.logged.rir);
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
        setRescheduleDate(d.session.date);
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

  async function handleReschedule() {
    if (!data || !rescheduleDate) return;
    setRescheduleError(null);
    setRescheduleSaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: rescheduleDate }),
      });
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      setData({ ...data, session: { ...data.session, date: resData.session.date } });
      setRescheduling(false);
    } catch (e) {
      setRescheduleError(e instanceof Error ? e.message : String(e));
    } finally {
      setRescheduleSaving(false);
    }
  }

  // Shared by both the manual form and the guided workout — whichever built
  // the payload, submission itself works the same way from here.
  async function submitLog(payload: SubmitPayload) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);
      try {
        localStorage.removeItem(`guided-workout:${sessionId}`);
      } catch {
        // best-effort cleanup only
      }
      clearRestTimer();
      setSaved(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSubmit() {
    if (!data) return;
    setSubmitError(null);

    if (!status) {
      setSubmitError("Let us know how the session went.");
      return;
    }
    if (status === "skipped" && !skipReason) {
      setSubmitError("Please choose a reason.");
      return;
    }
    if (skipReason === "other" && !skipReasonOtherText.trim()) {
      setSubmitError("Please describe the reason.");
      return;
    }

    const exercisesPayload: ExercisePayload[] = [];
    if (status !== "skipped") {
      for (const ex of data.exercises) {
        const f = forms[ex.exercise_id];
        if (!f) continue;

        if (ex.tier === 1) {
          const touched = f.weight || f.reps || f.rir || f.substituted;
          if (!touched) continue;
          if (!f.weight || !f.reps || !f.rir) {
            setSubmitError(`${ex.exercise_name}: weight, reps, and how the set felt are all required for this lift.`);
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
            rir: effortToRir(f.rir),
            load_descriptor: f.loadDescriptor || null,
            notes: f.notes || null,
            is_true_max: f.isTrueMax,
          });
        } else if (ex.tier === 2) {
          if (!f.rir) continue;
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
            rir: effortToRir(f.rir),
            load_descriptor: f.loadDescriptor || null,
            notes: f.notes || null,
          });
        } else {
          if (!f.included) continue;
          exercisesPayload.push({
            exercise_id: ex.exercise_id,
            weight_used: f.weight ? Number(f.weight) : null,
            reps_completed: f.reps ? Number(f.reps) : null,
            notes: f.notes || null,
          });
        }
      }
    }

    await submitLog({
      status,
      skip_reason: skipReason || null,
      skip_reason_other_text: skipReasonOtherText || null,
      overall_notes: overallNotes || null,
      exercises: exercisesPayload,
    });
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{loadError}</p>
        <Link href="/app/log" className="mt-4 inline-block text-sm text-brand underline">
          Back to schedule
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
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

  if (mode === "guided") {
    return (
      <GuidedWorkout
        sessionId={sessionId}
        session={session}
        exercises={exercises}
        onExit={() => setMode("overview")}
        onFinish={(exercisesPayload, finalStatus) =>
          submitLog({ status: finalStatus, exercises: exercisesPayload })
        }
        submitting={submitting}
        submitError={submitError}
      />
    );
  }

  if (mode === "manual") {
    return (
      <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
        <button type="button" onClick={() => setMode("overview")} className="text-xs text-slate-400 underline">
          ← Back
        </button>
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
            onClick={handleManualSubmit}
            disabled={submitting}
            className="w-full rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save log"}
          </button>
        </div>
      </main>
    );
  }

  // mode === "overview"
  const hasProgress = (() => {
    try {
      return !!localStorage.getItem(`guided-workout:${sessionId}`);
    } catch {
      return false;
    }
  })();
  const alreadyLogged = !!data.session_log;

  return (
    <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
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
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm text-slate-500">
          {session.date} · Week {session.week_number}
        </p>
        {!alreadyLogged && !rescheduling && (
          <button type="button" onClick={() => setRescheduling(true)} className="text-xs text-brand underline">
            Move to a different day
          </button>
        )}
      </div>

      {rescheduling && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">New date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className={inputClass}
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
            <button
              type="button"
              onClick={handleReschedule}
              disabled={rescheduleSaving}
              className="shrink-0 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {rescheduleSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRescheduling(false);
                setRescheduleError(null);
                setRescheduleDate(session.date);
              }}
              className="shrink-0 text-sm text-slate-500 underline"
            >
              Cancel
            </button>
          </div>
          {rescheduleError && <p className="mt-2 text-xs text-red-600">{rescheduleError}</p>}
        </div>
      )}

      {alreadyLogged && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Already logged as <strong>{data.session_log!.status.replace("_", " ")}</strong>.
        </p>
      )}

      <div className="mt-6 space-y-2">
        {exercises.map((ex) => (
          <div key={ex.exercise_id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-slate-800">
                {ex.circuit_label ? `${ex.circuit_label}. ` : ""}
                {ex.exercise_name}
              </span>
              <span className="text-xs text-slate-500">{ex.prescribed_target || "—"}</span>
            </div>
            {ex.cue && <p className="mt-1 text-xs text-slate-500">{ex.cue}</p>}
            {ex.warmup && ex.warmup.length > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                + {ex.warmup.length} warmup set{ex.warmup.length === 1 ? "" : "s"}
              </p>
            )}
            {loggedExerciseIds.has(ex.exercise_id) && (
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Logged
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => setMode("guided")}
          className="w-full rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          {hasProgress ? "Resume workout" : alreadyLogged ? "Redo as guided workout" : "Start workout"}
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="w-full rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
        >
          {alreadyLogged ? "Edit log manually" : "Log manually instead"}
        </button>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Guided, step-by-step workout flow
// ---------------------------------------------------------------------------

type GuidedSetState = {
  weight: string;
  reps: string;
  // Holds an EffortLevel value ("very_easy" ... "did_not_complete") from the
  // guided flow's difficulty slider, or "" before the athlete has touched it.
  rir: EffortLevel | "";
  logged: boolean;
  // True when this set's weight was pre-filled by RIR-based autoregulation
  // (see logSet below) rather than typed or carried over from the
  // prescription/last-time hint. Cleared the moment the athlete edits the
  // weight field by hand, so it never masks their own entry as a suggestion.
  autoSuggested?: boolean;
  // True once the athlete typed this set's weight or used "apply to all" —
  // autoregulation never overwrites a weight the athlete chose themselves.
  manualWeight?: boolean;
};

type GuidedExerciseState = {
  sets: GuidedSetState[];
  substituted: boolean;
  substitutedExerciseId: string;
  substitutionReason: string;
  isTrueMax: boolean;
  notes: string;
  loadDescriptor: string;
  skipped: boolean;
  doneIndex: number; // how many sets have been logged
};

type GuidedProgress = {
  exerciseIndex: number;
  states: Record<string, GuidedExerciseState>;
};

function storageKey(sessionId: string) {
  return `guided-workout:${sessionId}`;
}

function saveProgress(sessionId: string, progress: GuidedProgress) {
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(progress));
  } catch {
    // best-effort only — a full-workout state is small, this shouldn't fail,
    // but guided mode still works perfectly well without persistence
  }
}

function loadProgress(sessionId: string): GuidedProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as GuidedProgress) : null;
  } catch {
    return null;
  }
}

function defaultSetCount(exercise: SessionDetail["exercises"][number]): number {
  const parsed = parsePrescribedTarget(exercise.prescribed_target ?? "");
  if (parsed.sets) return parsed.sets;
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");
  if (timed?.sets) return timed.sets;
  return exercise.tier === 3 ? 1 : 3;
}

function blankSet(): GuidedSetState {
  // Difficulty defaults to "moderate" so a set can be logged without ever
  // touching the slider — most sets land there anyway, and the athlete can
  // still drag it before logging if a set felt different.
  return { weight: "", reps: "", rir: "moderate", logged: false, autoSuggested: false };
}

function initExerciseState(exercise: SessionDetail["exercises"][number]): GuidedExerciseState {
  // Resuming a session that already has a per-set breakdown from a previous
  // guided run — start from that instead of blank.
  const priorSets = exercise.logged?.set_results;
  const targetInfo = parsePrescribedTarget(exercise.prescribed_target ?? "");
  const count = priorSets?.length || defaultSetCount(exercise);

  const sets: GuidedSetState[] = [];
  for (let i = 0; i < count; i++) {
    const prior = priorSets?.[i];
    if (prior) {
      sets.push({
        weight: prior.weight_used != null ? String(prior.weight_used) : "",
        reps: prior.reps_completed != null ? String(prior.reps_completed) : "",
        rir: rirToEffort(prior.rir),
        logged: true,
      });
    } else {
      const s = blankSet();
      // Prefill weight from the prescription/last-time hint for every set —
      // most lifts use the same weight across sets, and it's always editable.
      s.weight =
        exercise.prescribed_weight_hint != null
          ? String(exercise.prescribed_weight_hint)
          : exercise.last_time?.weight_used != null
          ? String(exercise.last_time.weight_used)
          : "";
      // Timed holds/intervals (3x30s) must NOT prefill reps: for those sets
      // `reps` stores the seconds actually held, and prefilling the target made
      // the countdown open already at 0:00 and let the set be logged untimed.
      const isTimed = parseTimedTarget(exercise.prescribed_target ?? "") != null;
      s.reps = !isTimed && targetInfo.minReps != null ? String(targetInfo.minReps) : "";
      sets.push(s);
    }
  }

  return {
    sets,
    substituted: !!exercise.logged?.substituted_exercise_id,
    substitutedExerciseId: exercise.logged?.substituted_exercise_id ?? "",
    substitutionReason: exercise.logged?.substitution_reason ?? "",
    isTrueMax: false,
    notes: exercise.logged?.notes ?? "",
    loadDescriptor: exercise.logged?.load_descriptor ?? "",
    skipped: false,
    doneIndex: sets.filter((s) => s.logged).length,
  };
}

// ---------------------------------------------------------------------------
// Superset grouping: consecutive exercises sharing an A1/A2-style
// circuit_label letter (see lib/training/display-labels.ts) are grouped into
// one combined "step" so the guided flow can show/alternate between them
// instead of marching through each exercise in isolation (testing feedback —
// supersets used to stay stuck on the first exercise's screen the whole
// time). Everything else is still a single-exercise step, unchanged.
// ---------------------------------------------------------------------------

type Step =
  | { kind: "single"; exerciseIndexes: [number] }
  | { kind: "superset"; exerciseIndexes: number[] };

function buildSteps(exercises: SessionDetail["exercises"]): Step[] {
  const steps: Step[] = [];
  let i = 0;
  while (i < exercises.length) {
    const label = exercises[i].circuit_label;
    if (isSupersetLabel(label)) {
      const key = supersetGroupKey(label);
      const group = [i];
      let j = i + 1;
      while (
        j < exercises.length &&
        isSupersetLabel(exercises[j].circuit_label) &&
        supersetGroupKey(exercises[j].circuit_label as string) === key
      ) {
        group.push(j);
        j++;
      }
      if (group.length > 1) {
        steps.push({ kind: "superset", exerciseIndexes: group });
        i = j;
        continue;
      }
    }
    steps.push({ kind: "single", exerciseIndexes: [i] });
    i++;
  }
  return steps;
}

function GuidedWorkout({
  sessionId,
  session,
  exercises,
  onExit,
  onFinish,
  submitting,
  submitError,
}: {
  sessionId: string;
  session: SessionDetail["session"];
  exercises: SessionDetail["exercises"];
  onExit: () => void;
  onFinish: (exercises: ExercisePayload[], status: "completed" | "partially_completed") => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [states, setStates] = useState<Record<string, GuidedExerciseState>>({});
  const [initialized, setInitialized] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const { state: restState, secondsLeft: restSecondsLeft } = useRestTimer();

  const steps = buildSteps(exercises);

  useEffect(() => {
    const saved = loadProgress(sessionId);
    const initialStates: Record<string, GuidedExerciseState> = {};
    for (const ex of exercises) {
      initialStates[ex.exercise_id] = saved?.states[ex.exercise_id] ?? initExerciseState(ex);
    }
    setStates(initialStates);
    setStepIndex(saved?.exerciseIndex ?? 0);
    setInitialized(true);
    // Only ever run once on mount — this is a one-time hydration from
    // localStorage/server data, not something that should re-run on prop churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized) return;
    saveProgress(sessionId, { exerciseIndex: stepIndex, states });
  }, [sessionId, stepIndex, states, initialized]);

  if (!initialized) {
    return (
      <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  function updateExerciseState(exerciseId: string, patch: Partial<GuidedExerciseState>) {
    setStates((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], ...patch } }));
  }

  function updateSet(exerciseId: string, setIndex: number, patch: Partial<GuidedSetState>) {
    setStates((prev) => {
      const current = prev[exerciseId];
      const nextSets = current.sets.map((s, i) => {
        if (i !== setIndex) return s;
        const merged = { ...s, ...patch };
        // Typing a weight in by hand overrides any auto-suggestion — once the
        // athlete has touched the field it's their number, not ours.
        if ("weight" in patch && !("autoSuggested" in patch)) {
          merged.autoSuggested = false;
          merged.manualWeight = true;
        }
        return merged;
      });
      return { ...prev, [exerciseId]: { ...current, sets: nextSets } };
    });
  }

  function addSet(exerciseId: string) {
    const current = states[exerciseId];
    updateExerciseState(exerciseId, { sets: [...current.sets, blankSet()] });
  }

  function removeSet(exerciseId: string, setIndex: number) {
    const current = states[exerciseId];
    updateExerciseState(exerciseId, { sets: current.sets.filter((_, i) => i !== setIndex) });
  }

  /** Copies the first not-yet-logged set's weight and reps (or, for a timed
   * hold/interval, the recorded seconds) onto every other not-yet-logged set.
   * Already-logged sets are left alone. Copied weights are flagged manual so
   * the effort-based autoregulation in logSet can't silently overwrite them
   * after the next set is logged (that was the "apply to all didn't work"
   * report). Blank fields on the template never erase values on other sets. */
  function applyToAllSets(exerciseId: string) {
    const current = states[exerciseId];
    const template = current.sets.find((s) => !s.logged);
    if (!template) return;
    updateExerciseState(exerciseId, {
      sets: current.sets.map((s) => {
        if (s.logged || s === template) return s;
        return {
          ...s,
          weight: template.weight !== "" ? template.weight : s.weight,
          reps: template.reps !== "" ? template.reps : s.reps,
          autoSuggested: false,
          manualWeight: template.weight !== "" ? true : s.manualWeight,
        };
      }),
    });
  }

  function logSet(exercise: SessionDetail["exercises"][number], setIndex: number, opts?: { skipRest?: boolean }) {
    const exState = states[exercise.exercise_id];
    const loggedSet = exState.sets[setIndex];
    updateSet(exercise.exercise_id, setIndex, { logged: true });
    updateExerciseState(exercise.exercise_id, { doneIndex: Math.max(exState.doneIndex, setIndex + 1) });

    const isLastSetOfExercise = setIndex === exState.sets.length - 1;

    // Autoregulate: nudge the next set's weight based on how this one felt.
    // Tier 3 has no RIR at all, and test-week / true-max attempts are
    // chasing a ceiling rather than a target RIR, so both are left alone —
    // the athlete drives the weight directly in those cases.
    const eligible = exercise.tier !== 3 && session.week_type !== "test" && !exState.isTrueMax;
    if (eligible && !isLastSetOfExercise) {
      const priorWeight = parseFloat(loggedSet.weight);
      const suggestion = !Number.isNaN(priorWeight) && priorWeight > 0 ? suggestNextWeight(priorWeight, loggedSet.rir) : null;
      const nextSet = exState.sets[setIndex + 1];
      if (suggestion && nextSet && !nextSet.logged && !nextSet.manualWeight) {
        updateSet(exercise.exercise_id, setIndex + 1, { weight: String(suggestion.weight), autoSuggested: true });
      }
    }

    if (!opts?.skipRest && !isLastSetOfExercise) {
      const restSeconds = parseRestSeconds(exercise.rest) ?? 60;
      startRestTimer({
        sessionId,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        endsAt: Date.now() + restSeconds * 1000,
      });
    }
  }

  /** Superset-aware version of logSet: only starts the rest timer once every
   * exercise in the group has completed the same number of sets (a full
   * round of the circuit), not after each individual exercise's set — a
   * superset rests as a unit, not per exercise. Assumes a matched set count
   * across the group's exercises, which is how the coach writes these. */
  function logSupersetSet(groupExerciseIds: string[], exercise: SessionDetail["exercises"][number], setIndex: number) {
    logSet(exercise, setIndex, { skipRest: true });

    // Read the post-update doneIndex synchronously isn't possible with
    // setState's async batching, so recompute the same value here directly.
    const updatedDoneIndex = Math.max(states[exercise.exercise_id].doneIndex, setIndex + 1);
    const roundComplete = groupExerciseIds.every((id) => {
      if (id === exercise.exercise_id) return updatedDoneIndex === setIndex + 1;
      return states[id].doneIndex >= setIndex + 1;
    });
    const groupFullyDone = groupExerciseIds.every((id) => {
      const s = states[id];
      const done = id === exercise.exercise_id ? updatedDoneIndex : s.doneIndex;
      return done >= s.sets.length;
    });

    if (roundComplete && !groupFullyDone) {
      const restSeconds = parseRestSeconds(exercise.rest) ?? 60;
      startRestTimer({
        sessionId,
        exerciseId: exercise.exercise_id,
        exerciseName: "Superset",
        endsAt: Date.now() + restSeconds * 1000,
      });
    }
  }

  function goToNextStep() {
    clearRestTimer();
    if (isLastStep) {
      setFinishing(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goToPreviousStep() {
    clearRestTimer();
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function buildFinalPayload(): { exercises: ExercisePayload[]; anySkipped: boolean } {
    const payload: ExercisePayload[] = [];
    let anySkipped = false;
    for (const ex of exercises) {
      const s = states[ex.exercise_id];
      if (!s || s.skipped) {
        if (s?.skipped) anySkipped = true;
        continue;
      }
      const loggedSets = s.sets.filter((set) => set.logged);
      if (loggedSets.length === 0) {
        anySkipped = true;
        continue;
      }
      const setResults: SetResult[] = loggedSets.map((set, i) => ({
        set_number: i + 1,
        weight_used: set.weight ? Number(set.weight) : null,
        reps_completed: set.reps ? Number(set.reps) : null,
        rir: effortToRir(set.rir),
      }));
      payload.push({
        exercise_id: ex.exercise_id,
        substituted_exercise_id: s.substituted ? s.substitutedExerciseId || null : null,
        substitution_reason: s.substituted ? s.substitutionReason : null,
        notes: s.notes || null,
        load_descriptor: s.loadDescriptor || null,
        is_true_max: s.isTrueMax,
        set_results: setResults,
      });
    }
    return { exercises: payload, anySkipped };
  }

  if (finishing) {
    const { exercises: payload, anySkipped } = buildFinalPayload();
    return (
      <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold text-brand-dark">Nice work — that's the workout.</h1>
        <p className="mt-2 text-sm text-slate-600">
          {payload.length} of {exercises.length} exercises logged.
          {anySkipped && " A few were skipped — that's fine, they'll just show as not logged."}
        </p>
        {submitError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{submitError}</p>}
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => onFinish(payload, anySkipped ? "partially_completed" : "completed")}
            disabled={submitting}
            className="w-full rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Finish & save"}
          </button>
          <button
            type="button"
            onClick={() => setFinishing(false)}
            className="w-full rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
          >
            Keep going
          </button>
        </div>
      </main>
    );
  }

  const stepExercises = step.exerciseIndexes.map((i) => exercises[i]);

  return (
    <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onExit} className="text-xs text-slate-400 underline">
          Exit workout
        </button>
        <span className="text-xs font-medium text-slate-400">
          Step {stepIndex + 1} of {steps.length}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(stepIndex / steps.length) * 100}%` }}
        />
      </div>

      {step.kind === "single" ? (
        <SingleExerciseStep
          exercise={stepExercises[0]}
          weekType={session.week_type}
          state={states[stepExercises[0].exercise_id]}
          restState={restState}
          restSecondsLeft={restSecondsLeft}
          onUpdateExercise={(patch) => updateExerciseState(stepExercises[0].exercise_id, patch)}
          onUpdateSet={(i, patch) => updateSet(stepExercises[0].exercise_id, i, patch)}
          onAddSet={() => addSet(stepExercises[0].exercise_id)}
          onRemoveSet={(i) => removeSet(stepExercises[0].exercise_id, i)}
          onApplyToAll={() => applyToAllSets(stepExercises[0].exercise_id)}
          onLogSet={(i) => logSet(stepExercises[0], i)}
        />
      ) : (
        <SupersetStep
          exercises={stepExercises}
          states={states}
          weekType={session.week_type}
          restState={restState}
          restSecondsLeft={restSecondsLeft}
          onUpdateExercise={updateExerciseState}
          onUpdateSet={updateSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onApplyToAll={applyToAllSets}
          onLogSet={(exercise, i) =>
            logSupersetSet(
              stepExercises.map((e) => e.exercise_id),
              exercise,
              i
            )
          }
        />
      )}

      <div className="mt-4 flex gap-2">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goToPreviousStep}
            className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            for (const ex of stepExercises) updateExerciseState(ex.exercise_id, { skipped: true });
            goToNextStep();
          }}
          className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-slate-400"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={goToNextStep}
          className="flex-1 rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          {isLastStep ? "Finish workout" : "Next →"}
        </button>
      </div>

      {!isLastStep && steps[stepIndex + 1] && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Coming up next</p>
          <p className="text-sm font-medium text-slate-700">
            {steps[stepIndex + 1].exerciseIndexes
              .map((i) => exercises[i].exercise_name)
              .join(" + ")}
          </p>
        </div>
      )}
    </main>
  );
}

function RestBanner({ secondsLeft, onSkip }: { secondsLeft: number; onSkip: () => void }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-brand bg-blue-50 px-4 py-3">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">Resting</span>
        <p className="text-2xl font-bold tabular-nums text-brand-dark">
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
      >
        Skip rest
      </button>
    </div>
  );
}

/**
 * The guided flow's difficulty input: a slider from "very easy" to "did not
 * complete" (see lib/training/perceived-effort.ts) instead of a numeric RIR
 * pick. Every set starts pre-set to "Moderate" (see blankSet/blankExerciseForm)
 * so a set can be logged without ever touching the slider — the athlete only
 * needs to drag it when a set actually felt different from that.
 */
function EffortSlider({
  value,
  onChange,
  disabled,
}: {
  value: EffortLevel | "";
  onChange: (v: EffortLevel) => void;
  disabled?: boolean;
}) {
  const index = EFFORT_SCALE.findIndex((e) => e.value === value);
  const displayIndex = index === -1 ? 2 : index;
  const current = index !== -1 ? EFFORT_SCALE[index] : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500">How did that set feel?</span>
        <span className={current ? "font-medium text-slate-700" : "italic text-slate-400"}>
          {current ? current.shortLabel : "Drag to rate"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={EFFORT_SCALE.length - 1}
        step={1}
        value={displayIndex}
        disabled={disabled}
        onChange={(e) => onChange(EFFORT_SCALE[Number(e.target.value)].value)}
        // h-8 (rather than the browser's thin default track) gives the
        // slider a bigger touch target — this gets dragged mid-set, often
        // one-handed, so it needs to be easy to grab without looking closely.
        className="h-7 w-full accent-brand disabled:opacity-50"
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Very easy</span>
        <span>Did not complete</span>
      </div>
    </div>
  );
}

/** Counts DOWN from the target time for a timed exercise (plank hold, wall
 * sit, interval). Every set starts at the full target and only begins counting
 * when Start is pressed. Stopping records the whole seconds actually held into
 * `onDone` — the caller stores that in the set's `reps` field (the schema has
 * no duration column). Past the target the display sits at 0:00 and "Time's
 * up" shows while the real elapsed time keeps counting so a long hold is still
 * logged accurately.
 *
 * `recordedSeconds` is the set's saved value (set.reps). When it is filled —
 * after Stop, or after "apply to all" copied a time onto this set — the timer
 * shows that recorded time with a Redo button instead of a fresh countdown, so
 * it always agrees with the set's data. Local/in-page state only. */
function WorkTimer({
  targetSeconds,
  recordedSeconds,
  onDone,
  onClear,
}: {
  targetSeconds: number;
  recordedSeconds: string;
  onDone: (seconds: number) => void;
  onClear: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsed(0);
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 200);
    return () => clearInterval(interval);
  }, [running]);

  const fmt = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

  if (!running && recordedSeconds !== "") {
    const rec = Number(recordedSeconds);
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-2 text-center">
        <p className="text-xs text-slate-500">Recorded (target {fmt(targetSeconds)})</p>
        <p className="text-2xl font-bold tabular-nums text-brand-dark">{fmt(Number.isFinite(rec) ? rec : 0)}</p>
        <button type="button" onClick={onClear} className="mt-1 text-xs text-brand underline">
          Redo timer
        </button>
      </div>
    );
  }

  const atTarget = targetSeconds > 0 && elapsed >= targetSeconds;
  const remaining = running ? Math.max(0, targetSeconds - elapsed) : targetSeconds;

  return (
    <div className={`rounded-md border p-2 text-center ${atTarget ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
      <p className="text-xs text-slate-500">Target: {fmt(targetSeconds)}</p>
      <p className="text-3xl font-bold tabular-nums text-brand-dark">{fmt(remaining)}</p>
      {atTarget && <p className="text-xs font-medium text-green-700">Time&apos;s up — stop when ready</p>}
      {running && !atTarget && <p className="text-xs text-slate-400">{fmt(elapsed)} elapsed</p>}
      <div className="mt-2 flex gap-2">
        {!running ? (
          <button
            type="button"
            onClick={() => setRunning(true)}
            className="flex-1 rounded-md bg-brand px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Start timer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              onDone(Math.max(1, elapsed));
            }}
            className="flex-1 rounded-md bg-brand-dark px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function effortLabel(v: EffortLevel | ""): string {
  return EFFORT_SCALE.find((e) => e.value === v)?.shortLabel ?? "";
}

function GuidedSetRow({
  setNumber,
  tier,
  set,
  weekType,
  timedSeconds,
  perDumbbell,
  onChange,
  onLog,
  onRemove,
}: {
  setNumber: number;
  tier: 1 | 2 | 3;
  set: GuidedSetState;
  weekType: "build" | "deload" | "test";
  timedSeconds: number | null;
  perDumbbell: boolean;
  onChange: (patch: Partial<GuidedSetState>) => void;
  onLog: () => void;
  onRemove?: () => void;
}) {
  // Logged sets collapse to a one-line summary (compact on mobile) with an
  // Edit button that temporarily re-opens the fields. `set.logged` never
  // changes while editing and the final payload reads current field values,
  // so an edit takes effect without extra plumbing.
  const [editing, setEditing] = useState(false);
  const locked = set.logged && !editing;
  const canLog = timedSeconds != null ? !!set.reps : tier === 1 ? !!(set.weight && set.reps && set.rir) : tier === 2 ? !!set.rir : true;
  const optional = tier === 1 ? "" : " (optional)";
  const weightPlaceholder = perDumbbell
    ? `Weight PER dumbbell${optional}`
    : tier === 1
    ? "Weight (lb)"
    : `Weight${optional}`;
  const perDbHint = perDumbbell ? (
    <p className="text-[11px] leading-tight text-slate-500">
      Enter the weight of <strong>one</strong> dumbbell — not the combined total.
    </p>
  ) : null;

  if (locked) {
    const summary =
      timedSeconds != null
        ? `${set.reps}s`
        : [set.weight ? `${set.weight} lb${perDumbbell ? " ea" : ""}` : "", set.reps ? `× ${set.reps}` : ""]
            .filter(Boolean)
            .join(" ") || "Done";
    const eff = tier !== 3 && timedSeconds == null ? effortLabel(set.rir) : "";
    return (
      <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-3 py-2">
        <span className="text-sm text-green-800">
          <span className="font-semibold">Set {setNumber} ✓</span> · {summary}
          {eff && <span className="text-green-700"> · {eff}</span>}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-brand underline">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 p-2.5 sm:p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Set {setNumber}</span>
        <div className="flex items-center gap-2">
          {set.logged && (
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-brand underline">
              Cancel
            </button>
          )}
          {onRemove && !set.logged && (
            <button type="button" onClick={onRemove} className="text-xs text-slate-400 underline">
              Remove
            </button>
          )}
        </div>
      </div>

      {timedSeconds != null ? (
        <div className="space-y-2">
          {tier !== 3 && (
            <>
              <input
                type="number"
                inputMode="decimal"
                placeholder={perDumbbell ? "Weight PER dumbbell (optional)" : "Weight/load (optional)"}
                className={inputClass}
                value={set.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
              />
              {perDbHint}
            </>
          )}
          <WorkTimer
            targetSeconds={timedSeconds}
            recordedSeconds={set.reps}
            onDone={(seconds) => onChange({ reps: String(seconds) })}
            onClear={() => onChange({ reps: "" })}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="…or type seconds held"
            className={inputClass}
            value={set.reps}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </div>
      ) : (
        <>
          {tier === 1 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={weightPlaceholder}
                  className={inputClass}
                  value={set.weight}
                  onChange={(e) => onChange({ weight: e.target.value })}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Reps"
                  className={inputClass}
                  value={set.reps}
                  onChange={(e) => onChange({ reps: e.target.value })}
                />
              </div>
              {perDbHint}
              <EffortSlider value={set.rir} onChange={(v) => onChange({ rir: v })} />
              {!set.logged && set.autoSuggested && (
                <p className="text-xs text-brand">
                  Weight adjusted from your last set&apos;s effort — edit it if this isn&apos;t right.
                </p>
              )}
            </div>
          )}

          {tier === 2 && (
            <div className="space-y-2">
              <EffortSlider value={set.rir} onChange={(v) => onChange({ rir: v })} />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={weightPlaceholder}
                  className={inputClass}
                  value={set.weight}
                  onChange={(e) => onChange({ weight: e.target.value })}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Reps (optional)"
                  className={inputClass}
                  value={set.reps}
                  onChange={(e) => onChange({ reps: e.target.value })}
                />
              </div>
              {perDbHint}
              {!set.logged && set.autoSuggested && (
                <p className="text-xs text-brand">
                  Weight adjusted from your last set&apos;s effort — edit it if this isn&apos;t right.
                </p>
              )}
            </div>
          )}

          {tier === 3 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={weightPlaceholder}
                  className={inputClass}
                  value={set.weight}
                  onChange={(e) => onChange({ weight: e.target.value })}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Reps (optional)"
                  className={inputClass}
                  value={set.reps}
                  onChange={(e) => onChange({ reps: e.target.value })}
                />
              </div>
              {perDbHint}
            </div>
          )}
        </>
      )}

      {weekType === "test" && tier === 1 && null /* true-max checkbox lives at the exercise level, not per set */}

      <button
        type="button"
        onClick={() => {
          if (editing) {
            setEditing(false);
          } else {
            onLog();
          }
        }}
        disabled={!canLog}
        className="mt-2.5 w-full rounded-md bg-brand px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {editing ? "Save changes" : "Log set"}
      </button>
    </div>
  );
}

/** The shared "header + sets list + apply-to-all + substitution" body used by
 * both a single-exercise step and each exercise inside a superset step. */
function ExerciseGuidedBody({
  exercise,
  state,
  weekType,
  restState,
  restSecondsLeft,
  onUpdateExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onApplyToAll,
  onLogSet,
}: {
  exercise: SessionDetail["exercises"][number];
  state: GuidedExerciseState;
  weekType: "build" | "deload" | "test";
  restState: RestTimerState | null;
  restSecondsLeft: number | null;
  onUpdateExercise: (patch: Partial<GuidedExerciseState>) => void;
  onUpdateSet: (setIndex: number, patch: Partial<GuidedSetState>) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onApplyToAll: () => void;
  onLogSet: (setIndex: number) => void;
}) {
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");
  const [showNotes, setShowNotes] = useState(!!state.notes);
  // If the athlete swapped to a listed alternative, use THAT exercise's
  // equipment to decide whether the per-dumbbell hint applies.
  const swappedAlt = state.substituted
    ? exercise.alternatives.find((a) => a.exercise_id === state.substitutedExerciseId)
    : undefined;
  const perDumbbell = swappedAlt ? !!swappedAlt.uses_dumbbells : !!exercise.uses_dumbbells;
  const hasUnloggedSets = state.sets.some((s) => !s.logged);
  const multipleUnlogged = state.sets.filter((s) => !s.logged).length > 1;

  // The rest timer belongs right under whichever set just triggered it — the
  // most recently logged one (doneIndex - 1) — rather than pinned above the
  // whole exercise the way it used to be, so it reads as "resting after
  // THIS set" instead of a disconnected banner at the top of the page.
  const restActiveHere =
    restState != null &&
    restState.exerciseId === exercise.exercise_id &&
    restSecondsLeft != null &&
    restSecondsLeft > 0;
  const restAfterSetIndex = restActiveHere ? state.doneIndex - 1 : -1;

  return (
    <div className="space-y-2 sm:space-y-3">
      {multipleUnlogged && (
        <button
          type="button"
          onClick={onApplyToAll}
          className="w-full rounded-md border border-dashed border-brand px-3 py-2 text-xs font-medium text-brand hover:bg-blue-50"
        >
          {timed ? "Copy this set's weight & time to every remaining set" : "Copy this set's weight & reps to every remaining set"}
        </button>
      )}

      <input
        placeholder="Band color / load note (optional, e.g. red band)"
        className={inputClass}
        value={state.loadDescriptor}
        onChange={(e) => onUpdateExercise({ loadDescriptor: e.target.value })}
      />

      {state.sets.map((set, i) => (
        <div key={i}>
          <GuidedSetRow
            setNumber={i + 1}
            tier={exercise.tier}
            set={set}
            weekType={weekType}
            timedSeconds={timed?.seconds ?? null}
            perDumbbell={perDumbbell}
            onChange={(patch) => onUpdateSet(i, patch)}
            onLog={() => onLogSet(i)}
            onRemove={state.sets.length > 1 ? () => onRemoveSet(i) : undefined}
          />
          {i === restAfterSetIndex && (
            <div className="mt-3">
              <RestBanner secondsLeft={restSecondsLeft!} onSkip={() => clearRestTimer()} />
            </div>
          )}
        </div>
      ))}

      {hasUnloggedSets && (
        <button type="button" onClick={onAddSet} className="text-sm text-brand underline">
          + Add another set
        </button>
      )}

      {showNotes ? (
        <input
          placeholder="Notes (optional)"
          className={inputClass}
          value={state.notes}
          onChange={(e) => onUpdateExercise({ notes: e.target.value })}
        />
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="text-xs text-slate-500 underline">
          + Add a note
        </button>
      )}

      <div>
        {weekType === "test" && exercise.tier === 1 && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={state.isTrueMax}
              onChange={(e) => onUpdateExercise({ isTrueMax: e.target.checked })}
            />
            This was a true 1RM/PR attempt (not an estimate)
          </label>
        )}
      </div>
    </div>
  );
}

// Ramping warmup sets, lightest to heaviest, clearly marked as NOT working
// sets. Purely informational — local-only "done" checkboxes, never logged to
// the database (that's the whole point: a warmup never gets its own
// exercise_id row, so it can't pollute logged_exercises or the per-exercise_id
// state the weight-progression history and logging UI depend on).
function WarmupChecklist({ warmup }: { warmup: Array<{ sets_reps: string; suggested_weight: number }> }) {
  const [done, setDone] = useState<boolean[]>(() => warmup.map(() => false));

  if (!warmup || warmup.length === 0) return null;

  return (
    <details className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-amber-700">
        Warmup sets ({warmup.length}) — not working sets
      </summary>
      <ul className="mt-2 space-y-1">
        {warmup.map((w, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={done[i] ?? false}
              onChange={(e) =>
                setDone((prev) => {
                  const next = [...prev];
                  next[i] = e.target.checked;
                  return next;
                })
              }
            />
            <span className={done[i] ? "line-through opacity-60" : ""}>
              {w.sets_reps} @ {w.suggested_weight} lb
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Swap picker shown right under the prescribed exercise's name at the top of
 * the step: a dropdown whose first option is "keep the prescribed exercise"
 * and whose other options are same-movement-pattern alternatives from the
 * library, plus "Something else" for free text. Choosing anything other than
 * the prescribed exercise marks the exercise as substituted (what gets logged
 * and sent to the server); a short "why" box appears underneath. */
function SwapPicker({
  exercise,
  state,
  onUpdateExercise,
}: {
  exercise: SessionDetail["exercises"][number];
  state: GuidedExerciseState;
  onUpdateExercise: (patch: Partial<GuidedExerciseState>) => void;
}) {
  const OTHER = "__other__";
  const isKnown = exercise.alternatives.some((a) => a.exercise_id === state.substitutedExerciseId);
  const selectValue = !state.substituted ? "" : isKnown ? state.substitutedExerciseId : OTHER;

  return (
    <div
      className={`mt-2 rounded-md border px-2.5 py-2 ${
        state.substituted ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Swap this exercise
      </label>
      <select
        className={inputClass}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onUpdateExercise({ substituted: false, substitutedExerciseId: "", substitutionReason: "" });
          else if (v === OTHER) onUpdateExercise({ substituted: true, substitutedExerciseId: "" });
          else onUpdateExercise({ substituted: true, substitutedExerciseId: v });
        }}
      >
        <option value="">Keep as prescribed: {exercise.exercise_name}</option>
        {exercise.alternatives.map((a) => (
          <option key={a.exercise_id} value={a.exercise_id}>
            Do instead: {a.exercise_name}
          </option>
        ))}
        <option value={OTHER}>Do something else (type it in)</option>
      </select>
      {state.substituted && (
        <div className="mt-2 space-y-2">
          {selectValue === OTHER && (
            <input
              placeholder="What exercise did you do instead?"
              className={inputClass}
              value={state.substitutedExerciseId}
              onChange={(e) => onUpdateExercise({ substitutedExerciseId: e.target.value })}
            />
          )}
          <input
            placeholder="Why? (no equipment, different gym, etc.)"
            className={inputClass}
            value={state.substitutionReason}
            onChange={(e) => onUpdateExercise({ substitutionReason: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function ExerciseHeader({
  exercise,
  state,
  onUpdateExercise,
}: {
  exercise: SessionDetail["exercises"][number];
  state: GuidedExerciseState;
  onUpdateExercise: (patch: Partial<GuidedExerciseState>) => void;
}) {
  const hasDetails = !!(exercise.cue || exercise.coach_notes);
  return (
    <div className="min-w-0 flex-1">
      <h1 className="text-xl font-bold leading-tight text-brand-dark sm:text-2xl">
        {exercise.circuit_label ? `${exercise.circuit_label}. ` : ""}
        {exercise.exercise_name}
      </h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Target: {exercise.prescribed_target || "—"}
        {exercise.tempo && ` · Tempo: ${exercise.tempo}`}
      </p>
      <SwapPicker exercise={exercise} state={state} onUpdateExercise={onUpdateExercise} />
      {hasDetails && (
        <details className="mt-2 text-sm text-slate-600">
          <summary className="cursor-pointer text-xs font-medium text-brand">Cue &amp; coach notes</summary>
          {exercise.cue && <p className="mt-1">{exercise.cue}</p>}
          {exercise.coach_notes && <p className="mt-1 text-xs italic text-slate-500">{exercise.coach_notes}</p>}
        </details>
      )}
      {exercise.last_time && (
        <p className="mt-1.5 text-xs text-slate-400">
          Last time ({exercise.last_time.date}): {exercise.last_time.load_descriptor || exercise.last_time.weight_used}
          {exercise.last_time.reps_completed ? ` x ${exercise.last_time.reps_completed}` : ""}
        </p>
      )}
      <WarmupChecklist warmup={exercise.warmup} />
    </div>
  );
}

function SingleExerciseStep({
  exercise,
  weekType,
  state,
  restState,
  restSecondsLeft,
  onUpdateExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onApplyToAll,
  onLogSet,
}: {
  exercise: SessionDetail["exercises"][number];
  weekType: "build" | "deload" | "test";
  state: GuidedExerciseState;
  restState: RestTimerState | null;
  restSecondsLeft: number | null;
  onUpdateExercise: (patch: Partial<GuidedExerciseState>) => void;
  onUpdateSet: (setIndex: number, patch: Partial<GuidedSetState>) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onApplyToAll: () => void;
  onLogSet: (setIndex: number) => void;
}) {
  return (
    <div>
      <ExerciseHeader exercise={exercise} state={state} onUpdateExercise={onUpdateExercise} />
      <div className="mt-3 sm:mt-6">
        <ExerciseGuidedBody
          exercise={exercise}
          state={state}
          weekType={weekType}
          restState={restState}
          restSecondsLeft={restSecondsLeft}
          onUpdateExercise={onUpdateExercise}
          onUpdateSet={onUpdateSet}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
          onApplyToAll={onApplyToAll}
          onLogSet={onLogSet}
        />
      </div>
    </div>
  );
}

/**
 * Shows every exercise in the superset at once (per testing feedback's
 * "simultaneous" option) with whichever one is next due — the exercise with
 * the fewest sets logged so far, ties going to the earlier one in the group —
 * expanded for logging, and the rest shown collapsed. Logging a set
 * re-evaluates "next due" immediately, so the expanded card naturally
 * alternates back and forth between the group's exercises each time.
 */
function SupersetStep({
  exercises,
  states,
  weekType,
  restState,
  restSecondsLeft,
  onUpdateExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onApplyToAll,
  onLogSet,
}: {
  exercises: SessionDetail["exercises"];
  states: Record<string, GuidedExerciseState>;
  weekType: "build" | "deload" | "test";
  restState: RestTimerState | null;
  restSecondsLeft: number | null;
  onUpdateExercise: (exerciseId: string, patch: Partial<GuidedExerciseState>) => void;
  onUpdateSet: (exerciseId: string, setIndex: number, patch: Partial<GuidedSetState>) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onApplyToAll: (exerciseId: string) => void;
  onLogSet: (exercise: SessionDetail["exercises"][number], setIndex: number) => void;
}) {
  let activeExercise = exercises[0];
  let lowestDoneIndex = Infinity;
  for (const ex of exercises) {
    const done = states[ex.exercise_id].doneIndex;
    if (done < lowestDoneIndex) {
      lowestDoneIndex = done;
      activeExercise = ex;
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-purple-600">
        Superset {exercises[0].circuit_label ? supersetGroupKey(exercises[0].circuit_label) : ""}
      </p>
      <div className="space-y-4">
        {exercises.map((ex) => {
          const state = states[ex.exercise_id];
          const isActive = ex.exercise_id === activeExercise.exercise_id;
          const allLogged = state.doneIndex >= state.sets.length;
          return (
            <div
              key={ex.exercise_id}
              className={`rounded-lg border p-3 sm:p-4 ${
                isActive ? "border-brand bg-blue-50/40" : allLogged ? "border-green-200 bg-green-50" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <ExerciseHeader
                  exercise={ex}
                  state={state}
                  onUpdateExercise={(patch) => onUpdateExercise(ex.exercise_id, patch)}
                />
                {isActive && !allLogged && (
                  <span className="ml-2 shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">
                    Up next
                  </span>
                )}
                {allLogged && (
                  <span className="ml-2 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Done
                  </span>
                )}
              </div>

              {isActive && !allLogged ? (
                <div className="mt-3">
                  <ExerciseGuidedBody
                    exercise={ex}
                    state={state}
                    weekType={weekType}
                    // Not wired to restState/restSecondsLeft here: a superset's
                    // rest timer is started once per completed ROUND (every
                    // exercise in the group reaching the same set count), keyed
                    // on whichever exercise's set happened to finish the round
                    // (see logSupersetSet) -- not necessarily the exercise
                    // that's "active" for the NEXT round, which is recalculated
                    // right above by lowest doneIndex. Showing it per-card here
                    // would attach it to the wrong exercise (or not render at
                    // all once the triggering exercise is no longer the active
                    // one). The group-level banner below the card stack is the
                    // correct "underneath the set that was just logged"
                    // placement for a superset as a unit.
                    restState={null}
                    restSecondsLeft={null}
                    onUpdateExercise={(patch) => onUpdateExercise(ex.exercise_id, patch)}
                    onUpdateSet={(i, patch) => onUpdateSet(ex.exercise_id, i, patch)}
                    onAddSet={() => onAddSet(ex.exercise_id)}
                    onRemoveSet={(i) => onRemoveSet(ex.exercise_id, i)}
                    onApplyToAll={() => onApplyToAll(ex.exercise_id)}
                    onLogSet={(i) => onLogSet(ex, i)}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {state.doneIndex} of {state.sets.length} sets logged
                </p>
              )}
            </div>
          );
        })}
      </div>

      {restState &&
        restSecondsLeft != null &&
        restSecondsLeft > 0 &&
        exercises.some((ex) => ex.exercise_id === restState.exerciseId) && (
          <div className="mt-4">
            <RestBanner secondsLeft={restSecondsLeft} onSkip={() => clearRestTimer()} />
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual (original) logging form — unchanged, kept as the "edit"/fallback path
// ---------------------------------------------------------------------------

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
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");

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
      <WarmupChecklist warmup={exercise.warmup} />

      {exercise.tier === 1 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={exercise.uses_dumbbells ? "Weight PER dumbbell (lb)" : "Weight (lb)"}
              className={inputClass}
              value={form.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder={timed ? "Seconds held" : "Reps"}
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
          <EffortSlider value={form.rir} onChange={(v) => onChange({ rir: v })} />
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
          <SubstitutionFields alternatives={exercise.alternatives} form={form} onChange={onChange} />
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
          <EffortSlider value={form.rir} onChange={(v) => onChange({ rir: v })} />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={exercise.uses_dumbbells ? "Weight PER dumbbell (optional)" : "Weight/load (optional)"}
              className={inputClass}
              value={form.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder={timed ? "Seconds held (optional)" : "Reps (optional)"}
              className={inputClass}
              value={form.reps}
              onChange={(e) => onChange({ reps: e.target.value })}
            />
          </div>
          <SubstitutionFields alternatives={exercise.alternatives} form={form} onChange={onChange} />
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
                placeholder={exercise.uses_dumbbells ? "Weight PER dumbbell (optional)" : "Weight (optional)"}
                className={inputClass}
                value={form.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
              />
              <input
                type="number"
                placeholder={timed ? "Seconds held (optional)" : "Reps (optional)"}
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

/**
 * The substitution picker shared by both the guided flow and the manual
 * form: a dropdown of exercise-library alternatives that share this
 * exercise's movement_pattern (see /api/sessions/[id]'s `alternatives`
 * field) — e.g. a Barbell Bench Press swap offers DB Bench, Incline DB
 * Press, Cable Chest Press, etc., never a pullup or a squat. Picking "
 * Something else" falls back to free text, for a substitution that isn't in
 * the library at all (a different gym's weird machine, a band setup, etc.).
 * This also fixes a real correctness gap the old free-text-only field had:
 * downstream code (app/api/sessions/[id]/log/route.ts, lib/pps/compile.ts)
 * already looks `substituted_exercise_id` up in the exercise_library table
 * to derive its logging tier — a free-typed name almost never matched a
 * real exercise_id, so that lookup was quietly failing most of the time.
 * Picking from this list always stores a real exercise_id when one applies.
 */
function AlternativeExerciseSelect({
  alternatives,
  value,
  onChange,
}: {
  alternatives: Array<{ exercise_id: string; exercise_name: string }>;
  value: string;
  onChange: (exerciseId: string) => void;
}) {
  const OTHER = "__other__";
  const isKnownAlternative = alternatives.some((a) => a.exercise_id === value);
  const [otherSelected, setOtherSelected] = useState(value !== "" && !isKnownAlternative);
  const selectValue = otherSelected ? OTHER : value;

  return (
    <div className="space-y-2">
      <select
        className={inputClass}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOtherSelected(true);
            onChange("");
          } else {
            setOtherSelected(false);
            onChange(v);
          }
        }}
      >
        <option value="">What did you do instead?</option>
        {alternatives.map((a) => (
          <option key={a.exercise_id} value={a.exercise_id}>
            {a.exercise_name}
          </option>
        ))}
        <option value={OTHER}>Something else (type it in)</option>
      </select>
      {otherSelected && (
        <input
          placeholder="What exercise did you do instead?"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {alternatives.length === 0 && !otherSelected && (
        <p className="text-xs text-slate-400">
          No listed alternatives for this exercise — pick &quot;Something else&quot; to describe what you did.
        </p>
      )}
    </div>
  );
}

function SubstitutionFields({
  alternatives,
  form,
  onChange,
}: {
  alternatives: Array<{ exercise_id: string; exercise_name: string }>;
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
        <div className="mt-1 space-y-2">
          <AlternativeExerciseSelect
            alternatives={alternatives}
            value={form.substitutedExerciseId}
            onChange={(v) => onChange({ substitutedExerciseId: v })}
          />
          <input
            placeholder="Why? (no equipment, different gym, etc.)"
            className={inputClass}
            value={form.substitutionReason}
            onChange={(e) => onChange({ substitutionReason: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
