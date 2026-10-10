import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, H2 } from "../components/ui";
import { ExerciseHistoryView } from "../components/ExerciseHistoryView";
import { colors } from "../theme";
import type { GuidedExerciseState, SessionExercise } from "../types";

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
          <H2>{title}</H2>
          <Button title="Close" variant="link" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function HistorySheet({ visible, exerciseId, name, onClose }: { visible: boolean; exerciseId: string; name: string; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={name} onClose={onClose}>
      {visible ? <ExerciseHistoryView exerciseId={exerciseId} /> : null}
    </Sheet>
  );
}

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt } as const;

export function ReplaceSheet({
  visible, exercise, state, onUpdate, onClose,
}: { visible: boolean; exercise: SessionExercise; state: GuidedExerciseState; onUpdate: (patch: Partial<GuidedExerciseState>) => void; onClose: () => void }) {
  const known = exercise.alternatives.some((a) => a.exercise_id === state.substitutedExerciseId);
  const [other, setOther] = useState(state.substituted && !known);

  return (
    <Sheet visible={visible} title="Replace exercise" onClose={onClose}>
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
      {state.substituted ? (
        <Card>
          {other ? (
            <TextInput
              placeholder="What exercise did you do instead?"
              placeholderTextColor={colors.faint}
              keyboardAppearance="dark"
              value={state.substitutedExerciseId}
              onChangeText={(v) => onUpdate({ substitutedExerciseId: v })}
              style={inputStyle}
            />
          ) : null}
          <TextInput
            placeholder="Why? (no equipment, different gym, etc.)"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            value={state.substitutionReason}
            onChangeText={(v) => onUpdate({ substitutionReason: v })}
            style={inputStyle}
          />
        </Card>
      ) : null}
      <Button title="Done" onPress={onClose} />
    </Sheet>
  );
}

function Choice({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandBg : colors.card }}
    >
      <Text style={{ fontSize: 15, color: colors.text }}>{text}</Text>
    </Pressable>
  );
}
