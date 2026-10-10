import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { Button, Card, ErrorText, H1, P, ProgressBar } from "../components/ui";
import { SetRow } from "./SetRow";
import {
  States, addSet, applyToAllSets, buildFinalPayload, buildSteps, formatClock, initStates, logSet, logSupersetSet,
  removeSet, updateExercise, updateSet,
} from "./state";
import { clearProgress, loadProgress, saveProgress } from "./storage";
import { parseTimedTarget } from "../shared/parse-prescription";
import { colors } from "../theme";
import type { ExercisePayload, SessionDetail, SessionExercise } from "../types";

type Rest = { endsAt: number; exerciseId: string } | null;

export function Guided({
  sessionId, session, exercises, submitting, submitError, onExit, onFinish,
}: {
  sessionId: string;
  session: SessionDetail["session"];
  exercises: SessionExercise[];
  submitting: boolean;
  submitError: string | null;
  onExit: () => void;
  onFinish: (exercises: ExercisePayload[], status: "completed" | "partially_completed") => void;
}) {
  useKeepAwake();
  const steps = buildSteps(exercises);
  const [states, setStates] = useState<States>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [rest, setRest] = useState<Rest>(null);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    let alive = true;
    loadProgress(sessionId).then((saved) => {
      if (!alive) return;
      setStates(initStates(exercises, saved?.states));
      setStepIndex(Math.min(saved?.stepIndex ?? 0, Math.max(0, steps.length - 1)));
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // One-time hydration on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) saveProgress(sessionId, { stepIndex, states });
  }, [sessionId, stepIndex, states, ready]);

  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [rest]);

  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : null;
  useEffect(() => {
    if (rest && restLeft === 0) setRest(null);
  }, [rest, restLeft]);

  const startRest = useCallback((seconds: number | null, exerciseId: string) => {
    if (seconds == null) return;
    setNow(Date.now());
    setRest({ endsAt: Date.now() + seconds * 1000, exerciseId });
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <P muted style={{ padding: 20 }}>Loading…</P>
      </SafeAreaView>
    );
  }

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const stepExercises = step.exerciseIndexes.map((i) => exercises[i]);

  function go(delta: number) {
    setRest(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
    if (delta > 0 && isLast) setFinishing(true);
    else setStepIndex((i) => Math.max(0, i + delta));
  }

  if (finishing) {
    const { exercises: payload, anySkipped } = buildFinalPayload(exercises, states);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 16, gap: 12 }}>
          <H1>Nice work - that's the workout.</H1>
          <P muted>
            {payload.length} of {exercises.length} exercises logged.
            {anySkipped ? " A few were skipped - that's fine, they'll show as not logged." : ""}
          </P>
          <ErrorText>{submitError}</ErrorText>
          <Button
            title={submitting ? "Saving…" : "Finish & save"}
            loading={submitting}
            onPress={() => onFinish(payload, anySkipped ? "partially_completed" : "completed")}
          />
          <Button title="Keep going" variant="secondary" onPress={() => setFinishing(false)} />
        </View>
      </SafeAreaView>
    );
  }

  const groupIds = stepExercises.map((e) => e.exercise_id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Button title="Exit workout" variant="link" onPress={onExit} />
          <Text style={{ fontSize: 12, color: colors.faint, fontWeight: "600" }}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
        </View>
        <ProgressBar pct={(stepIndex / steps.length) * 100} />
      </View>

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step.kind === "superset" ? (
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand, letterSpacing: 1 }}>SUPERSET - alternate between these</Text>
        ) : null}

        {stepExercises.map((exercise) => {
          const id = exercise.exercise_id;
          const st = states[id];
          return (
            <ExerciseBlock
              key={id}
              exercise={exercise}
              state={st}
              weekType={session.week_type}
              restLeft={rest && rest.exerciseId === id ? restLeft : null}
              onSkipRest={() => setRest(null)}
              onUpdate={(patch) => setStates((p) => updateExercise(p, id, patch))}
              onUpdateSet={(i, patch) => setStates((p) => updateSet(p, id, i, patch))}
              onAddSet={() => setStates((p) => addSet(p, id))}
              onRemoveSet={(i) => setStates((p) => removeSet(p, id, i))}
              onApplyToAll={() => setStates((p) => applyToAllSets(p, id))}
              onLogSet={(i) => {
                const result =
                  step.kind === "superset"
                    ? logSupersetSet(states, stepExercises, exercise, i, session.week_type)
                    : logSet(states, exercise, i, session.week_type);
                setStates(result.states);
                startRest(result.restSeconds, step.kind === "superset" ? groupIds[0] : id);
              }}
            />
          );
        })}

        {!isLast && steps[stepIndex + 1] ? (
          <Card style={{ backgroundColor: colors.bgSoft }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.faint, letterSpacing: 1 }}>COMING UP NEXT</Text>
            <P>{steps[stepIndex + 1].exerciseIndexes.map((i) => exercises[i].exercise_name).join(" + ")}</P>
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
        {stepIndex > 0 ? <Button title="Back" variant="secondary" onPress={() => go(-1)} /> : null}
        <Button
          title="Skip"
          variant="secondary"
          onPress={() => {
            setStates((p) => {
              let n = p;
              for (const e of stepExercises) n = updateExercise(n, e.exercise_id, { skipped: true });
              return n;
            });
            go(1);
          }}
        />
        <Button title={isLast ? "Finish workout" : "Next"} onPress={() => go(1)} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

function ExerciseBlock({
  exercise, state, weekType, restLeft, onSkipRest, onUpdate, onUpdateSet, onAddSet, onRemoveSet, onApplyToAll, onLogSet,
}: {
  exercise: SessionExercise;
  state: States[string];
  weekType: "build" | "deload" | "test";
  restLeft: number | null;
  onSkipRest: () => void;
  onUpdate: (patch: Partial<States[string]>) => void;
  onUpdateSet: (i: number, patch: Partial<States[string]["sets"][number]>) => void;
  onAddSet: () => void;
  onRemoveSet: (i: number) => void;
  onApplyToAll: () => void;
  onLogSet: (i: number) => void;
}) {
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");
  const [showNotes, setShowNotes] = useState(!!state.notes);
  const [showDetails, setShowDetails] = useState(false);
  const swappedAlt = state.substituted ? exercise.alternatives.find((a) => a.exercise_id === state.substitutedExerciseId) : undefined;
  const perDumbbell = swappedAlt ? !!swappedAlt.uses_dumbbells : !!exercise.uses_dumbbells;
  const unlogged = state.sets.filter((s) => !s.logged).length;
  const restAfter = restLeft != null && restLeft > 0 ? state.doneIndex - 1 : -1;

  return (
    <View style={{ gap: 10 }}>
      <View>
        <H1>
          {exercise.circuit_label ? `${exercise.circuit_label}. ` : ""}
          {exercise.exercise_name}
        </H1>
        <P muted>
          Target: {exercise.prescribed_target || "-"}
          {exercise.tempo ? ` · Tempo: ${exercise.tempo}` : ""}
        </P>
        {exercise.last_time && exercise.last_time.weight_used != null ? (
          <P small muted>
            Last time: {exercise.last_time.weight_used} lb{exercise.last_time.reps_completed != null ? ` x ${exercise.last_time.reps_completed}` : ""}
          </P>
        ) : null}
      </View>

      <SwapPicker exercise={exercise} state={state} onUpdate={onUpdate} />

      {(exercise.active_injury_locations?.length ?? 0) > 0 ? (
        <Card tone="amber">
          <P small>
            This one is for your {exercise.active_injury_locations!.map((l) => l.replace(/_/g, " ")).join(", ")}. Not bothering you anymore? Update your injury status on the website.
          </P>
        </Card>
      ) : null}

      {exercise.cue || exercise.coach_notes ? (
        <View>
          <Button title={showDetails ? "Hide cue & coach notes" : "Cue & coach notes"} variant="link" onPress={() => setShowDetails((v) => !v)} />
          {showDetails ? (
            <View style={{ marginTop: 6, gap: 4 }}>
              {exercise.cue ? <P>{exercise.cue}</P> : null}
              {exercise.coach_notes ? <P small muted style={{ fontStyle: "italic" }}>{exercise.coach_notes}</P> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Warmup warmup={exercise.warmup} />

      {unlogged > 1 ? (
        <Button
          title={timed ? "Copy this set's weight & time to every remaining set" : "Copy this set's weight & reps to every remaining set"}
          variant="secondary"
          onPress={onApplyToAll}
        />
      ) : null}

      {state.sets.map((set, i) => (
        <View key={i} style={{ gap: 8 }}>
          <SetRow
            setNumber={i + 1}
            tier={exercise.tier}
            set={set}
            timedSeconds={timed?.seconds ?? null}
            perDumbbell={perDumbbell}
            onChange={(patch) => onUpdateSet(i, patch)}
            onLog={() => onLogSet(i)}
            onRemove={state.sets.length > 1 ? () => onRemoveSet(i) : undefined}
          />
          {i === restAfter ? (
            <Card tone="brand" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand, letterSpacing: 1 }}>RESTING</Text>
                <Text style={{ fontSize: 28, fontWeight: "700", color: colors.brandDark, fontVariant: ["tabular-nums"] }}>{formatClock(restLeft!)}</Text>
              </View>
              <Button title="Skip rest" onPress={onSkipRest} />
            </Card>
          ) : null}
        </View>
      ))}

      {unlogged > 0 ? <Button title="+ Add another set" variant="link" onPress={onAddSet} style={{ alignSelf: "flex-start" }} /> : null}

      {showNotes ? (
        <TextInput
          placeholder="Notes"
          placeholderTextColor={colors.faint}
          value={state.notes}
          onChangeText={(v) => onUpdate({ notes: v })}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, fontSize: 15 }}
        />
      ) : (
        <Button title="+ Add a note" variant="link" onPress={() => setShowNotes(true)} style={{ alignSelf: "flex-start" }} />
      )}

      {weekType === "test" && exercise.tier === 1 ? (
        <Pressable onPress={() => onUpdate({ isTrueMax: !state.isTrueMax })} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.brand, backgroundColor: state.isTrueMax ? colors.brand : "#fff" }} />
          <P small>This was a true 1RM/PR attempt (not an estimate)</P>
        </Pressable>
      ) : null}
    </View>
  );
}

function Warmup({ warmup }: { warmup: SessionExercise["warmup"] }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<boolean[]>([]);
  if (!warmup || warmup.length === 0) return null;
  return (
    <Card tone="amber">
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.amber, letterSpacing: 1 }}>
          WARMUP SETS ({warmup.length}) - NOT WORKING SETS  {open ? "▲" : "▼"}
        </Text>
      </Pressable>
      {open
        ? warmup.map((w, i) => (
            <Pressable key={i} onPress={() => setDone((d) => { const n = [...d]; n[i] = !n[i]; return n; })} style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 4 }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.amber, backgroundColor: done[i] ? colors.amber : "#fff" }} />
              <Text style={{ fontSize: 15, color: "#78350F", textDecorationLine: done[i] ? "line-through" : "none" }}>
                {w.sets_reps} @ {w.suggested_weight} lb
              </Text>
            </Pressable>
          ))
        : null}
    </Card>
  );
}

function SwapPicker({
  exercise, state, onUpdate,
}: { exercise: SessionExercise; state: States[string]; onUpdate: (patch: Partial<States[string]>) => void }) {
  const [open, setOpen] = useState(false);
  const known = exercise.alternatives.some((a) => a.exercise_id === state.substitutedExerciseId);
  const [other, setOther] = useState(state.substituted && !known);
  const label = !state.substituted
    ? "Swap this exercise"
    : `Doing instead: ${known ? exercise.alternatives.find((a) => a.exercise_id === state.substitutedExerciseId)!.exercise_name : state.substitutedExerciseId || "something else"}`;

  return (
    <Card tone={state.substituted ? "amber" : undefined} style={{ gap: 6 }}>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{label}  {open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 6 }}>
          <Choice
            text={`Keep as prescribed: ${exercise.exercise_name}`}
            selected={!state.substituted}
            onPress={() => { setOther(false); onUpdate({ substituted: false, substitutedExerciseId: "", substitutionReason: "" }); }}
          />
          {exercise.alternatives.map((a) => (
            <Choice
              key={a.exercise_id}
              text={`Do instead: ${a.exercise_name}`}
              selected={state.substituted && state.substitutedExerciseId === a.exercise_id}
              onPress={() => { setOther(false); onUpdate({ substituted: true, substitutedExerciseId: a.exercise_id }); }}
            />
          ))}
          <Choice
            text="Do something else (type it in)"
            selected={state.substituted && other}
            onPress={() => { setOther(true); onUpdate({ substituted: true, substitutedExerciseId: "" }); }}
          />
        </View>
      ) : null}
      {state.substituted ? (
        <View style={{ gap: 6 }}>
          {other ? (
            <TextInput
              placeholder="What exercise did you do instead?"
              placeholderTextColor={colors.faint}
              value={state.substitutedExerciseId}
              onChangeText={(v) => onUpdate({ substitutedExerciseId: v })}
              style={inputStyle}
            />
          ) : null}
          <TextInput
            placeholder="Why? (no equipment, different gym, etc.)"
            placeholderTextColor={colors.faint}
            value={state.substitutionReason}
            onChangeText={(v) => onUpdate({ substitutionReason: v })}
            style={inputStyle}
          />
        </View>
      ) : null}
    </Card>
  );
}

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: "#fff" } as const;

function Choice({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandBg : "#fff" }}
    >
      <Text style={{ fontSize: 14, color: colors.text }}>{text}</Text>
    </Pressable>
  );
}
