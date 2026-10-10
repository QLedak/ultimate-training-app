import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Caps, P } from "../components/ui";
import { NumberBox } from "./NumberBox";
import { EffortSlider } from "./EffortSlider";
import { WorkTimer } from "./WorkTimer";
import { HistorySheet, ReplaceSheet } from "./Sheets";
import { formatClock } from "./state";
import { parseTimedTarget } from "../shared/parse-prescription";
import { EFFORT_SCALE } from "../shared/perceived-effort";
import { colors } from "../theme";
import type { GuidedExerciseState, GuidedSetState, SessionExercise } from "../types";

type Props = {
  exercise: SessionExercise;
  state: GuidedExerciseState;
  weekType: "build" | "deload" | "test";
  /** Set being edited/logged; null when every set is logged and none selected. */
  activeIndex: number | null;
  restLeft: number | null;
  onSkipRest: () => void;
  onSelectSet: (i: number) => void;
  onUpdate: (patch: Partial<GuidedExerciseState>) => void;
  onUpdateSet: (i: number, patch: Partial<GuidedSetState>) => void;
  onAddSet: () => void;
  onRemoveSet: (i: number) => void;
  onApplyToAll: () => void;
};

function setSummary(set: GuidedSetState, timed: boolean, tier: number, perDb: boolean) {
  if (timed) return `${set.reps}s`;
  const parts = [set.weight ? `${set.weight}${perDb ? " ea" : ""}` : "", set.reps ? `×${set.reps}` : ""].filter(Boolean).join(" ");
  const eff = tier !== 3 ? EFFORT_SCALE.find((e) => e.value === set.rir)?.shortLabel : "";
  return [parts || "Done", eff].filter(Boolean).join(" · ");
}

export function ExercisePanel(p: Props) {
  const { exercise, state } = p;
  const timed = parseTimedTarget(exercise.prescribed_target ?? "");
  const [showDetails, setShowDetails] = useState(false);
  const [showNotes, setShowNotes] = useState(!!state.notes);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const swappedAlt = state.substituted ? exercise.alternatives.find((a) => a.exercise_id === state.substitutedExerciseId) : undefined;
  const perDumbbell = swappedAlt ? !!swappedAlt.uses_dumbbells : !!exercise.uses_dumbbells;
  const effectiveId = state.substituted && state.substitutedExerciseId && swappedAlt ? swappedAlt.exercise_id : exercise.exercise_id;
  const effectiveName = swappedAlt ? swappedAlt.exercise_name : exercise.exercise_name;

  const set = p.activeIndex != null ? state.sets[p.activeIndex] : null;
  const unlogged = state.sets.filter((s) => !s.logged).length;
  const restAfter = p.restLeft != null && p.restLeft > 0 ? state.doneIndex - 1 : -1;

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>
          {exercise.circuit_label ? `${exercise.circuit_label}. ` : ""}
          {state.substituted && state.substitutedExerciseId ? effectiveName : exercise.exercise_name}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
          Target: {exercise.prescribed_target || "-"}
          {exercise.tempo ? ` · Tempo ${exercise.tempo}` : ""}
          {exercise.rest ? ` · Rest ${exercise.rest}` : ""}
        </Text>
        {state.substituted && state.substitutedExerciseId ? (
          <Text style={{ fontSize: 12, color: colors.amber, marginTop: 2 }}>Replacing: {exercise.exercise_name}</Text>
        ) : null}
        {exercise.last_time?.weight_used != null ? (
          <Text style={{ fontSize: 12, color: colors.faint, marginTop: 2 }}>
            Last time: {exercise.last_time.weight_used} lb{exercise.last_time.reps_completed != null ? ` × ${exercise.last_time.reps_completed}` : ""}
          </Text>
        ) : null}
      </View>

      {(exercise.active_injury_locations?.length ?? 0) > 0 ? (
        <Card tone="amber">
          <P small>
            This one is for your {exercise.active_injury_locations!.map((l) => l.replace(/_/g, " ")).join(", ")}. Not bothering you anymore? Update your injury status on the website.
          </P>
        </Card>
      ) : null}

      {exercise.warmup?.length ? <Warmup warmup={exercise.warmup} /> : null}

      {/* Set chips */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {state.sets.map((s, i) => {
          const active = p.activeIndex === i;
          return (
            <Pressable
              key={i}
              onPress={() => p.onSelectSet(i)}
              style={{
                minWidth: 44, paddingHorizontal: 12, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? colors.brand : s.logged ? colors.greenLine : colors.line,
                backgroundColor: active ? colors.brandBg : s.logged ? colors.greenBg : colors.card,
              }}
            >
              <Text style={{ color: s.logged ? colors.green : colors.text, fontWeight: "700" }}>{s.logged ? `${i + 1} ✓` : i + 1}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={p.onAddSet}
          style={{ minWidth: 44, paddingHorizontal: 12, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" }}
        >
          <Text style={{ color: colors.brand, fontWeight: "700" }}>+ Set</Text>
        </Pressable>
      </View>

      {/* Rest timer */}
      {restAfter >= 0 ? (
        <Card tone="brand" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Caps color={colors.brand}>Resting</Caps>
            <Text style={{ fontSize: 34, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>{formatClock(p.restLeft!)}</Text>
          </View>
          <Button title="Skip rest" onPress={p.onSkipRest} />
        </Card>
      ) : null}

      {/* Active set inputs */}
      {set == null ? (
        <Card tone="green">
          <P>All {state.sets.length} sets logged ✓</P>
          <P small muted>Tap a set above to edit it, or move on.</P>
        </Card>
      ) : exercise.tier === 3 && timed == null ? (
        <Card>
          <P muted>Do the work as prescribed, then tap Log Set.</P>
        </Card>
      ) : timed != null ? (
        <View style={{ gap: 10 }}>
          {exercise.tier !== 3 ? (
            <View style={{ flexDirection: "row" }}>
              <NumberBox label={perDumbbell ? "POUNDS EACH" : "POUNDS (OPT.)"} value={set.weight} step={5} decimal onChange={(v) => p.onUpdateSet(p.activeIndex!, { weight: v })} />
            </View>
          ) : null}
          <WorkTimer
            targetSeconds={timed.seconds}
            recordedSeconds={set.reps}
            onDone={(sec) => p.onUpdateSet(p.activeIndex!, { reps: String(sec) })}
            onClear={() => p.onUpdateSet(p.activeIndex!, { reps: "" })}
          />
          <View style={{ flexDirection: "row" }}>
            <NumberBox label="SECONDS HELD" value={set.reps} step={5} onChange={(v) => p.onUpdateSet(p.activeIndex!, { reps: v })} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <NumberBox label="REPS" value={set.reps} step={1} onChange={(v) => p.onUpdateSet(p.activeIndex!, { reps: v })} />
            <NumberBox
              label={perDumbbell ? "POUNDS EACH" : exercise.tier === 1 ? "POUNDS" : "POUNDS (OPT.)"}
              value={set.weight}
              step={5}
              decimal
              onChange={(v) => p.onUpdateSet(p.activeIndex!, { weight: v })}
            />
          </View>
          {perDumbbell ? <Text style={{ fontSize: 11, color: colors.muted }}>Enter the weight of ONE dumbbell, not the total.</Text> : null}
          <EffortSlider value={set.rir} onChange={(v) => p.onUpdateSet(p.activeIndex!, { rir: v })} />
          {!set.logged && set.autoSuggested ? (
            <Text style={{ fontSize: 12, color: colors.brand }}>Weight adjusted from your last set's effort - change it if this isn't right.</Text>
          ) : null}
        </View>
      )}

      {set && !set.logged && unlogged > 1 ? (
        <Button
          title={timed ? "Copy weight & time to remaining sets" : "Copy weight & reps to remaining sets"}
          variant="secondary"
          onPress={p.onApplyToAll}
        />
      ) : null}
      {set && !set.logged && state.sets.length > 1 ? (
        <Button title="Remove this set" variant="link" onPress={() => p.onRemoveSet(p.activeIndex!)} style={{ alignSelf: "flex-start" }} />
      ) : null}

      {/* Rows */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4 }}>
        <Row text="View history" onPress={() => setHistoryOpen(true)} />
        <Row text="Replace exercise" onPress={() => setReplaceOpen(true)} />
        {exercise.cue || exercise.coach_notes ? <Row text="Cue & coach notes" onPress={() => setShowDetails((v) => !v)} open={showDetails} /> : null}
        {showDetails ? (
          <View style={{ paddingVertical: 8, gap: 4 }}>
            {exercise.cue ? <P>{exercise.cue}</P> : null}
            {exercise.coach_notes ? <P small muted style={{ fontStyle: "italic" }}>{exercise.coach_notes}</P> : null}
          </View>
        ) : null}
        <Row text="Add a note" onPress={() => setShowNotes((v) => !v)} open={showNotes} />
        {showNotes ? (
          <TextInput
            placeholder="Notes"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            value={state.notes}
            onChangeText={(v) => p.onUpdate({ notes: v })}
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt, marginVertical: 8 }}
          />
        ) : null}
      </View>

      {p.weekType === "test" && exercise.tier === 1 ? (
        <Pressable onPress={() => p.onUpdate({ isTrueMax: !state.isTrueMax })} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: state.isTrueMax ? colors.brand : "transparent" }} />
          <P small>This was a true 1RM/PR attempt (not an estimate)</P>
        </Pressable>
      ) : null}

      <HistorySheet visible={historyOpen} exerciseId={effectiveId} name={effectiveName} onClose={() => setHistoryOpen(false)} />
      <ReplaceSheet visible={replaceOpen} exercise={exercise} state={state} onUpdate={p.onUpdate} onClose={() => setReplaceOpen(false)} />
    </View>
  );
}

function Row({ text, onPress, open }: { text: string; onPress: () => void; open?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>{text}</Text>
      <Text style={{ color: colors.muted, fontSize: 18 }}>{open ? "⌃" : "›"}</Text>
    </Pressable>
  );
}

function Warmup({ warmup }: { warmup: SessionExercise["warmup"] }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<boolean[]>([]);
  return (
    <Card tone="amber">
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Caps color={colors.amber}>Warm-up sets ({warmup.length}) · not working sets {open ? "▲" : "▼"}</Caps>
      </Pressable>
      {open
        ? warmup.map((w, i) => (
            <Pressable key={i} onPress={() => setDone((d) => { const n = [...d]; n[i] = !n[i]; return n; })} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}>
              <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.amber, backgroundColor: done[i] ? colors.amber : "transparent" }} />
              <Text style={{ fontSize: 15, color: colors.text, textDecorationLine: done[i] ? "line-through" : "none" }}>
                {w.sets_reps} @ {w.suggested_weight} lb
              </Text>
            </Pressable>
          ))
        : null}
    </Card>
  );
}
