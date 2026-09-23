"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { parsePrescribedTarget, parseRestSeconds } from "@/lib/pps/parse-prescription";
import { suggestNextWeight } from "@/lib/training/autoregulate";
import { EFFORT_SCALE, EffortLevel, effortToRir, rirToEffort } from "@/lib/training/perceived-effort";

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
    rir: "",
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
    if ((status === "skipped" || status === "partially_completed") && !skipReason) {
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
      <main className="mx-auto max-w-xl px-6 py-10">
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
  return exercise.tier === 3 ? 1 : 3;
}

function blankSet(): GuidedSetState {
  return { weight: "", reps: "", rir: "", logged: false, autoSuggested: false };
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
      s.reps = targetInfo.minReps != null ? String(targetInfo.minReps) : "";
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
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [states, setStates] = useState<Record<string, GuidedExerciseState>>({});
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const saved = loadProgress(sessionId);
    const initialStates: Record<string, GuidedExerciseState> = {};
    for (const ex of exercises) {
      initialStates[ex.exercise_id] = saved?.states[ex.exercise_id] ?? initExerciseState(ex);
    }
    setStates(initialStates);
    setExerciseIndex(saved?.exerciseIndex ?? 0);
    setInitialized(true);
    // Only ever run once on mount — this is a one-time hydration from
    // localStorage/server data, not something that should re-run on prop churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized) return;
    saveProgress(sessionId, { exerciseIndex, states });
  }, [sessionId, exerciseIndex, states, initialized]);

  // Rest timer countdown
  useEffect(() => {
    if (restSecondsLeft == null) return;
    if (restSecondsLeft <= 0) return;
    const t = setTimeout(() => setRestSecondsLeft((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [restSecondsLeft]);

  if (!initialized) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  const exercise = exercises[exerciseIndex];
  const state = states[exercise.exercise_id];
  const isLastExercise = exerciseIndex === exercises.length - 1;

  function updateExerciseState(patch: Partial<GuidedExerciseState>) {
    setStates((prev) => ({ ...prev, [exercise.exercise_id]: { ...prev[exercise.exercise_id], ...patch } }));
  }

  function updateSet(setIndex: number, patch: Partial<GuidedSetState>) {
    setStates((prev) => {
      const current = prev[exercise.exercise_id];
      const nextSets = current.sets.map((s, i) => {
        if (i !== setIndex) return s;
        const merged = { ...s, ...patch };
        // Typing a weight in by hand overrides any auto-suggestion — once the
        // athlete has touched the field it's their number, not ours.
        if ("weight" in patch && !("autoSuggested" in patch)) merged.autoSuggested = false;
        return merged;
      });
      return { ...prev, [exercise.exercise_id]: { ...current, sets: nextSets } };
    });
  }

  function addSet() {
    updateExerciseState({ sets: [...state.sets, blankSet()] });
  }

  function removeSet(setIndex: number) {
    updateExerciseState({ sets: state.sets.filter((_, i) => i !== setIndex) });
  }

  function logSet(setIndex: number) {
    const loggedSet = state.sets[setIndex];
    updateSet(setIndex, { logged: true });
    updateExerciseState({ doneIndex: Math.max(state.doneIndex, setIndex + 1) });

    const isLastSetOfExercise = setIndex === state.sets.length - 1;
    if (!isLastSetOfExercise) {
      const restSeconds = parseRestSeconds(exercise.rest) ?? 60;
      setRestSecondsLeft(restSeconds);

      // Autoregulate: nudge the next set's weight based on how this one felt.
      // Tier 3 has no RIR at all, and test-week / true-max attempts are
      // chasing a ceiling rather than a target RIR, so both are left alone —
      // the athlete drives the weight directly in those cases.
      const eligible = exercise.tier !== 3 && session.week_type !== "test" && !state.isTrueMax;
      if (eligible) {
        const priorWeight = parseFloat(loggedSet.weight);
        const actualRir = effortToRir(loggedSet.rir);
        if (!Number.isNaN(priorWeight) && priorWeight > 0 && actualRir != null) {
          const suggestion = suggestNextWeight(priorWeight, actualRir);
          const nextSet = state.sets[setIndex + 1];
          if (suggestion && nextSet && !nextSet.logged) {
            updateSet(setIndex + 1, { weight: String(suggestion.weight), autoSuggested: true });
          }
        }
      }
    }
  }

  function goToNextExercise() {
    setRestSecondsLeft(null);
    if (isLastExercise) {
      setFinishing(true);
    } else {
      setExerciseIndex((i) => i + 1);
    }
  }

  function goToPreviousExercise() {
    setRestSecondsLeft(null);
    setExerciseIndex((i) => Math.max(0, i - 1));
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
      <main className="mx-auto max-w-xl px-6 py-10">
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

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onExit} className="text-xs text-slate-400 underline">
          Exit workout
        </button>
        <span className="text-xs font-medium text-slate-400">
          Exercise {exerciseIndex + 1} of {exercises.length}
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${((exerciseIndex + (restSecondsLeft != null ? 0.5 : 0)) / exercises.length) * 100}%` }}
        />
      </div>

      <h1 className="text-2xl font-bold text-brand-dark">
        {exercise.circuit_label ? `${exercise.circuit_label}. ` : ""}
        {exercise.exercise_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Target: {exercise.prescribed_target || "—"}
        {exercise.tempo && ` · Tempo: ${exercise.tempo}`}
      </p>
      {exercise.cue && <p className="mt-2 text-sm text-slate-600">{exercise.cue}</p>}
      {exercise.coach_notes && <p className="mt-1 text-xs italic text-slate-500">{exercise.coach_notes}</p>}
      {exercise.last_time && (
        <p className="mt-2 text-xs text-slate-400">
          Last time ({exercise.last_time.date}): {exercise.last_time.load_descriptor || exercise.last_time.weight_used}
          {exercise.last_time.reps_completed ? ` x ${exercise.last_time.reps_completed}` : ""}
        </p>
      )}

      {restSecondsLeft != null ? (
        <RestTimer
          secondsLeft={restSecondsLeft}
          onTick={setRestSecondsLeft}
          onSkip={() => setRestSecondsLeft(null)}
        />
      ) : (
        <div className="mt-6 space-y-3">
          {state.sets.map((set, i) => (
            <GuidedSetRow
              key={i}
              setNumber={i + 1}
              tier={exercise.tier}
              set={set}
              weekType={session.week_type}
              onChange={(patch) => updateSet(i, patch)}
              onLog={() => logSet(i)}
              onRemove={state.sets.length > 1 ? () => removeSet(i) : undefined}
            />
          ))}

          <button type="button" onClick={addSet} className="text-sm text-brand underline">
            + Add another set
          </button>

          <div className="rounded-md border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={state.substituted}
                onChange={(e) => updateExerciseState({ substituted: e.target.checked })}
              />
              I did something different than prescribed
            </label>
            {state.substituted && (
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="What did you do instead?"
                  className={inputClass}
                  value={state.substitutedExerciseId}
                  onChange={(e) => updateExerciseState({ substitutedExerciseId: e.target.value })}
                />
                <input
                  placeholder="Why?"
                  className={inputClass}
                  value={state.substitutionReason}
                  onChange={(e) => updateExerciseState({ substitutionReason: e.target.value })}
                />
              </div>
            )}
            {session.week_type === "test" && exercise.tier === 1 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={state.isTrueMax}
                  onChange={(e) => updateExerciseState({ isTrueMax: e.target.checked })}
                />
                This was a true 1RM/PR attempt (not an estimate)
              </label>
            )}
          </div>

          <div className="flex gap-2">
            {exerciseIndex > 0 && (
              <button
                type="button"
                onClick={goToPreviousExercise}
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                updateExerciseState({ skipped: true });
                goToNextExercise();
              }}
              className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-slate-400"
            >
              Skip exercise
            </button>
            <button
              type="button"
              onClick={goToNextExercise}
              className="flex-1 rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isLastExercise ? "Finish workout" : "Next exercise →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function RestTimer({
  secondsLeft,
  onTick,
  onSkip,
}: {
  secondsLeft: number;
  onTick: (v: number | null) => void;
  onSkip: () => void;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isDone = secondsLeft <= 0;

  return (
    <div className="mt-6 flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {isDone ? "Rest complete" : "Resting"}
      </span>
      <span className="mt-2 text-5xl font-bold tabular-nums text-brand-dark">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
      <div className="mt-6 flex w-full gap-2">
        <button
          type="button"
          onClick={() => onTick(secondsLeft + 15)}
          className="flex-1 rounded-md border border-slate-300 px-4 py-3.5 text-base font-medium text-slate-600 hover:border-brand hover:text-brand"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-md bg-brand px-5 py-3.5 text-base font-medium text-white hover:bg-blue-700"
        >
          {isDone ? "Continue" : "Skip rest"}
        </button>
      </div>
    </div>
  );
}

/**
 * The guided flow's difficulty input: a slider from "very easy" to "did not
 * complete" (see lib/training/perceived-effort.ts) instead of a numeric RIR
 * pick. The thumb always shows a position — HTML range inputs can't render
 * "unset" — but it defaults to the middle ("Moderate") purely for display;
 * `value` (and therefore validation/canLog) stays "" until the athlete
 * actually drags it, so an untouched slider can't silently log as
 * "Moderate."
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
        className="h-8 w-full accent-brand disabled:opacity-50"
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Very easy</span>
        <span>Did not complete</span>
      </div>
    </div>
  );
}

function GuidedSetRow({
  setNumber,
  tier,
  set,
  weekType,
  onChange,
  onLog,
  onRemove,
}: {
  setNumber: number;
  tier: 1 | 2 | 3;
  set: GuidedSetState;
  weekType: "build" | "deload" | "test";
  onChange: (patch: Partial<GuidedSetState>) => void;
  onLog: () => void;
  onRemove?: () => void;
}) {
  const canLog =
    tier === 1 ? !!(set.weight && set.reps && set.rir) : tier === 2 ? !!set.rir : true; // tier 3: weight/reps optional

  return (
    <div className={`rounded-md border p-3 ${set.logged ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Set {setNumber}</span>
        <div className="flex items-center gap-2">
          {set.logged && <span className="text-xs font-medium text-green-700">Logged</span>}
          {onRemove && !set.logged && (
            <button type="button" onClick={onRemove} className="text-xs text-slate-400 underline">
              Remove
            </button>
          )}
        </div>
      </div>

      {tier === 1 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Weight (lb)"
              className={inputClass}
              value={set.weight}
              disabled={set.logged}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder="Reps"
              className={inputClass}
              value={set.reps}
              disabled={set.logged}
              onChange={(e) => onChange({ reps: e.target.value })}
            />
          </div>
          <EffortSlider value={set.rir} disabled={set.logged} onChange={(v) => onChange({ rir: v })} />
          {!set.logged && set.autoSuggested && (
            <p className="text-xs text-brand">
              Weight adjusted from your last set&apos;s effort — edit it if this isn&apos;t right.
            </p>
          )}
        </div>
      )}

      {tier === 2 && (
        <div className="space-y-2">
          <EffortSlider value={set.rir} disabled={set.logged} onChange={(v) => onChange({ rir: v })} />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Weight/load (optional)"
              className={inputClass}
              value={set.weight}
              disabled={set.logged}
              onChange={(e) => onChange({ weight: e.target.value })}
            />
            <input
              type="number"
              placeholder="Reps (optional)"
              className={inputClass}
              value={set.reps}
              disabled={set.logged}
              onChange={(e) => onChange({ reps: e.target.value })}
            />
          </div>
          {!set.logged && set.autoSuggested && (
            <p className="text-xs text-brand">
              Weight adjusted from your last set&apos;s effort — edit it if this isn&apos;t right.
            </p>
          )}
        </div>
      )}

      {tier === 3 && (
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Weight (optional)"
            className={inputClass}
            value={set.weight}
            disabled={set.logged}
            onChange={(e) => onChange({ weight: e.target.value })}
          />
          <input
            type="number"
            placeholder="Reps (optional)"
            className={inputClass}
            value={set.reps}
            disabled={set.logged}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </div>
      )}

      {weekType === "test" && tier === 1 && null /* true-max checkbox lives at the exercise level, not per set */}

      {!set.logged && (
        <button
          type="button"
          onClick={onLog}
          disabled={!canLog}
          className="mt-3 w-full rounded-md bg-brand px-4 py-3.5 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Log set
        </button>
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
          <EffortSlider value={form.rir} onChange={(v) => onChange({ rir: v })} />
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
