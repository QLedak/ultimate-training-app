import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Field } from "../components/ui";
import { EffortSlider } from "./EffortSlider";
import { WorkTimer } from "./WorkTimer";
import { canLogSet } from "./state";
import { EFFORT_SCALE } from "../shared/perceived-effort";
import { colors } from "../theme";
import type { GuidedSetState } from "../types";

export function SetRow({
  setNumber, tier, set, timedSeconds, perDumbbell, onChange, onLog, onRemove,
}: {
  setNumber: number;
  tier: 1 | 2 | 3;
  set: GuidedSetState;
  timedSeconds: number | null;
  perDumbbell: boolean;
  onChange: (patch: Partial<GuidedSetState>) => void;
  onLog: () => void;
  onRemove?: () => void;
}) {
  // Logged sets collapse to one line; Edit re-opens the fields.
  const [editing, setEditing] = useState(false);
  const locked = set.logged && !editing;
  const canLog = canLogSet(tier, set, timedSeconds);
  const optional = tier === 1 ? "" : " (optional)";
  const weightLabel = perDumbbell ? `Weight PER dumbbell${optional}` : tier === 1 ? "Weight (lb)" : `Weight${optional}`;

  if (locked) {
    const summary =
      timedSeconds != null
        ? `${set.reps}s`
        : [set.weight ? `${set.weight} lb${perDumbbell ? " ea" : ""}` : "", set.reps ? `x ${set.reps}` : ""].filter(Boolean).join(" ") || "Done";
    const eff = tier !== 3 && timedSeconds == null ? EFFORT_SCALE.find((e) => e.value === set.rir)?.shortLabel ?? "" : "";
    return (
      <Card tone="green" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 }}>
        <Text style={{ color: "#166534", fontSize: 14, flexShrink: 1 }}>
          <Text style={{ fontWeight: "700" }}>Set {setNumber} ✓</Text> · {summary}
          {eff ? ` · ${eff}` : ""}
        </Text>
        <Button title="Edit" variant="link" onPress={() => setEditing(true)} />
      </Card>
    );
  }

  const weightInput = (
    <Field label={weightLabel} value={set.weight} onChangeText={(v) => onChange({ weight: v })} keyboardType="decimal-pad" placeholder="0" />
  );

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Set {setNumber}</Text>
        {set.logged ? (
          <Button title="Cancel" variant="link" onPress={() => setEditing(false)} />
        ) : onRemove ? (
          <Button title="Remove" variant="link" onPress={onRemove} />
        ) : null}
      </View>

      {timedSeconds != null ? (
        <View style={{ gap: 8 }}>
          {tier !== 3 ? weightInput : null}
          <WorkTimer
            targetSeconds={timedSeconds}
            recordedSeconds={set.reps}
            onDone={(sec) => onChange({ reps: String(sec) })}
            onClear={() => onChange({ reps: "" })}
          />
          <Field label="...or type seconds held" value={set.reps} onChangeText={(v) => onChange({ reps: v })} keyboardType="number-pad" />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {tier === 2 ? <EffortSlider value={set.rir} onChange={(v) => onChange({ rir: v })} /> : null}
          {tier !== 3 ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {weightInput}
              <Field
                label={tier === 1 ? "Reps" : "Reps (optional)"}
                value={set.reps}
                onChangeText={(v) => onChange({ reps: v })}
                keyboardType="number-pad"
                placeholder="0"
              />
            </View>
          ) : null}
          {perDumbbell ? <Text style={{ fontSize: 11, color: colors.muted }}>Enter the weight of ONE dumbbell, not the total.</Text> : null}
          {tier === 1 ? <EffortSlider value={set.rir} onChange={(v) => onChange({ rir: v })} /> : null}
          {!set.logged && set.autoSuggested ? (
            <Text style={{ fontSize: 12, color: colors.brand }}>Weight adjusted from your last set's effort - edit it if this isn't right.</Text>
          ) : null}
        </View>
      )}

      <Button
        title={editing ? "Save changes" : "Log set"}
        disabled={!canLog}
        onPress={() => (editing ? setEditing(false) : onLog())}
        style={{ marginTop: 6 }}
      />
    </Card>
  );
}
