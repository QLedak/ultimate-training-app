import React, { useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from "react-native";
import { colors } from "../theme";

const ITEM = 44;
const VISIBLE = 5;

import { splitSeconds } from "./TimePicker.logic";

function Wheel({ count, value, label, onChange }: { count: number; value: number; label: string; onChange: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    // Position the wheel on the current value (also when it changes from outside).
    ref.current?.scrollTo({ y: value * ITEM, animated: false });
  }, [value]);

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== value) onChange(i);
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={{ height: ITEM * VISIBLE, width: "100%" }}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: pad }}
          onMomentumScrollEnd={settle}
          contentOffset={{ x: 0, y: value * ITEM }}
          nestedScrollEnabled
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ height: ITEM, alignItems: "center", justifyContent: "center" }}>
              <Text
                style={{
                  fontSize: i === value ? 28 : 20,
                  fontWeight: i === value ? "800" : "500",
                  color: i === value ? colors.text : colors.faint,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {String(i).padStart(2, "0")}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <Text style={{ position: "absolute", right: 14, top: pad + 14, fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

/**
 * Clock-app style time wheels (minutes : seconds). Reads and writes whole seconds as a string,
 * the same shape the set's "reps" field already uses for timed work.
 */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (seconds: string) => void; label: string }) {
  const { m, s } = splitSeconds(value);
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 14, paddingTop: 10, paddingBottom: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, letterSpacing: 1, textAlign: "center" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", position: "relative" }}>
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 12, right: 12, top: ITEM * 2, height: ITEM, borderRadius: 10, backgroundColor: colors.brandBg, borderWidth: 1, borderColor: colors.brand }}
        />
        <Wheel count={60} value={m} label="min" onChange={(v) => onChange(String(v * 60 + s))} />
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text }}>:</Text>
        <Wheel count={60} value={s} label="sec" onChange={(v) => onChange(String(m * 60 + v))} />
      </View>
    </View>
  );
}
