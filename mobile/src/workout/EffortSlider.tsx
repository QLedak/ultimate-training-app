import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { EFFORT_SCALE, EffortLevel } from "../shared/perceived-effort";
import { colors } from "../theme";

/** "This set felt" - green (very easy) to red (did not complete), six steps. */
export function EffortSlider({ value, onChange }: { value: EffortLevel | ""; onChange: (v: EffortLevel) => void }) {
  const index = EFFORT_SCALE.findIndex((e) => e.value === value);
  const shown = index === -1 ? 2 : index;
  const current = index !== -1 ? EFFORT_SCALE[index] : null;
  const dot = colors.effort[shown];
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>This set felt</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: current ? colors.text : colors.faint }}>{current ? current.shortLabel : "Drag to rate"}</Text>
        </View>
      </View>
      <View style={{ height: 40, justifyContent: "center", marginTop: 6 }}>
        <LinearGradient
          colors={colors.effort as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: 14, right: 14, height: 8, borderRadius: 4 }}
        />
        <Slider
          style={{ height: 40 }}
          minimumValue={0}
          maximumValue={EFFORT_SCALE.length - 1}
          step={1}
          value={shown}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="#FFFFFF"
          onValueChange={(v: number) => {
            const next = EFFORT_SCALE[Math.round(v)].value;
            if (next !== value) onChange(next);
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10, color: colors.faint }}>Very easy</Text>
        <Text style={{ fontSize: 10, color: colors.faint }}>Did not complete</Text>
      </View>
    </View>
  );
}
