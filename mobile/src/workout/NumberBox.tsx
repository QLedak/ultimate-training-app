import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { stepValue } from "./state";
import { colors } from "../theme";

/** Big REPS / POUNDS box: tap the number to type, or use - / + to step. */
export function NumberBox({
  label, value, step, onChange, decimal,
}: { label: string; value: string; step: number; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 10, alignItems: "center" }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        keyboardAppearance="dark"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={colors.faint}
        selectionColor={colors.brand}
        style={{ fontSize: 40, fontWeight: "800", color: colors.text, textAlign: "center", minWidth: 80, paddingVertical: 4 }}
      />
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <Step text="−" onPress={() => onChange(stepValue(value, -step))} />
        <Step text="+" onPress={() => onChange(stepValue(value, step))} />
      </View>
    </View>
  );
}

function Step({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 52, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center",
        backgroundColor: pressed ? colors.line : colors.cardAlt,
      })}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{text}</Text>
    </Pressable>
  );
}
