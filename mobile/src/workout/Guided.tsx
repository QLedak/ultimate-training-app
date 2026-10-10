import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { Button, Card, ErrorText, H1, P } from "../components/ui";
import { ExercisePanel } from "./ExercisePanel";
import {
  States, addSet, applyToAllSets, buildFinalPayload, buildSteps, firstUnloggedIndex, initStates, logSet, logSupersetSet,
  removeSet, updateExercise, updateSet, canLogSet,
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
  const [tab, setTab] = useState(0); // which exercise of a superset is showing
  const [selected, setSelected] = useState<Record<string, number | undefined>>({});
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
    return () => { alive = false; };
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <P muted style={{ padding: 20 }}>Loading…</P>
      </SafeAreaView>
    );
  }

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const stepExercises = step.exerciseIndexes.map((i) => exercises[i]);
  const exercise = stepExercises[Math.min(tab, stepExercises.length - 1)];
  const id = exercise.exercise_id;
  const st = states[id];

  const idxFor = (exId: string): number | null => {
    const s = states[exId];
    if (!s) return null;
    return selected[exId] ?? firstUnloggedIndex(s.sets);
  };
  const activeIndex = idxFor(id);
  const showNext = activeIndex == null; // every set logged and none being edited

  function go(delta: number) {
    setRest(null);
    setTab(0);
    scroller.current?.scrollTo({ y: 0, animated: false });
    if (delta > 0 && isLast) setFinishing(true);
    else setStepIndex((i) => Math.max(0, i + delta));
  }

  function logActive() {
    if (activeIndex == null) return;
    // Editing an already-logged set just closes the editor.
    if (st.sets[activeIndex].logged) {
      setSelected((p) => ({ ...p, [id]: undefined }));
      return;
    }
    const result =
      step.kind === "superset"
        ? logSupersetSet(states, stepExercises, exercise, activeIndex, session.week_type)
        : logSet(states, exercise, activeIndex, session.week_type);
    setStates(result.states);
    setSelected((p) => ({ ...p, [id]: undefined }));
    startRest(result.restSeconds, step.kind === "superset" ? stepExercises[0].exercise_id : id);
    if (step.kind === "superset") {
      // Alternate to the next exercise that still has sets to do.
      for (let k = 1; k <= stepExercises.length; k++) {
        const j = (tab + k) % stepExercises.length;
        if (result.states[stepExercises[j].exercise_id].sets.some((s) => !s.logged)) {
          setTab(j);
          break;
        }
      }
    }
  }

  if (finishing) {
    const { exercises: payload, anySkipped } = buildFinalPayload(exercises, states);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
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

  const setLabel = activeIndex != null ? `Set ${activeIndex + 1}/${st.sets.length}` : `${st.sets.length}/${st.sets.length} done`;
  const buttonLabel = showNext ? (isLast ? "Finish workout" : "Next exercise") : activeIndex != null && st.sets[activeIndex].logged ? "Update set" : "Log Set";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Button title="‹ Exit" variant="link" onPress={onExit} />
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "700" }}>
            EXERCISE {stepIndex + 1} OF {steps.length}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {steps.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < stepIndex ? colors.brand : i === stepIndex ? "#F9A869" : colors.cardAlt }} />
          ))}
        </View>
      </View>

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {step.kind === "superset" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {stepExercises.map((e, i) => (
              <Pressable
                key={e.exercise_id}
                onPress={() => setTab(i)}
                style={{ flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: i === tab ? colors.brand : colors.line, backgroundColor: i === tab ? colors.brandBg : colors.card }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.brand }}>{e.circuit_label ?? "Superset"}</Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.text, fontWeight: "600" }}>{e.exercise_name}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {states[e.exercise_id].sets.filter((s) => s.logged).length}/{states[e.exercise_id].sets.length} sets
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ExercisePanel
          key={id}
          exercise={exercise}
          state={st}
          weekType={session.week_type}
          activeIndex={activeIndex}
          restLeft={rest && (rest.exerciseId === id || step.kind === "superset") ? restLeft : null}
          onSkipRest={() => setRest(null)}
          onSelectSet={(i) => setSelected((p) => ({ ...p, [id]: i }))}
          onUpdate={(patch) => setStates((p) => updateExercise(p, id, patch))}
          onUpdateSet={(i, patch) => setStates((p) => updateSet(p, id, i, patch))}
          onAddSet={() => setStates((p) => addSet(p, id))}
          onRemoveSet={(i) => { setSelected((p) => ({ ...p, [id]: undefined })); setStates((p) => removeSet(p, id, i)); }}
          onApplyToAll={() => setStates((p) => applyToAllSets(p, id))}
        />

        {!isLast && steps[stepIndex + 1] ? (
          <Card style={{ backgroundColor: colors.cardAlt }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.faint, letterSpacing: 1 }}>COMING UP NEXT</Text>
            <P>{steps[stepIndex + 1].exerciseIndexes.map((i) => exercises[i].exercise_name).join(" + ")}</P>
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Button title={stepIndex > 0 ? "‹ Previous" : " "} variant="link" disabled={stepIndex === 0} onPress={() => go(-1)} />
          <Button
            title="Skip exercise"
            variant="link"
            onPress={() => {
              setStates((p) => {
                let n = p;
                for (const e of stepExercises) n = updateExercise(n, e.exercise_id, { skipped: true });
                return n;
              });
              go(1);
            }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ minWidth: 112, height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{setLabel}</Text>
          </View>
          <Button
            title={buttonLabel}
            onPress={() => (showNext ? go(1) : logActive())}
            disabled={!showNext && activeIndex != null && !canLogHere(exercise, st.sets[activeIndex])}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function canLogHere(exercise: SessionExercise, set: { weight: string; reps: string; rir: any; logged: boolean }): boolean {
  if (set.logged) return true;
  return canLogSet(exercise.tier, set as any, parseTimedTarget(exercise.prescribed_target ?? "")?.seconds ?? null);
}
