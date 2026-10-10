import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { EFFORT_SCALE, EffortLevel } from "../shared/perceived-effort";
import { colors } from "../theme";

/** "How did that set feel?" - six steps from very easy to did-not-complete. */
export function EffortSlider({ value, onChange }: { value: EffortLevel | ""; onChange: (v: EffortLevel) => void }) {
  const index = EFFORT_SCALE.findIndex((e) => e.value === value);
  const shown = index === -1 ? 2 : index;
  const current = index !== -1 ? EFFORT_SCALE[index] : null;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>How did that set feel?</Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: current ? colors.text : colors.faint }}>
          {current ? current.shortLabel : "Drag to rate"}
        </Text>
      </View>
      <Slider
        style={{ height: 40 }}
        minimumValue={0}
        maximumValue={EFFORT_SCALE.length - 1}
        step={1}
        value={shown}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.brand}
        onValueChange={(v) => {
          const next = EFFORT_SCALE[Math.round(v)].value;
          if (next !== value) onChange(next);
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10, color: colors.faint }}>Very easy</Text>
        <Text style={{ fontSize: 10, color: colors.faint }}>Did not complete</Text>
      </View>
    </View>
  );
}
