import React, { useState } from "react";
import { Text, View } from "react-native";
import { colors } from "../theme";

export type ChartPoint = { label: string; value: number; highlight?: boolean };

/** Small dependency-free line chart (dots + straight segments). */
export function LineChart({ points, height = 170, unit = "lb" }: { points: ChartPoint[]; height?: number; unit?: string }) {
  const [w, setW] = useState(0);
  if (points.length === 0) return null;

  const padL = 44, padR = 12, padT = 12, padB = 24;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) { max += 5; min -= 5; }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;

  const innerW = Math.max(0, w - padL - padR);
  const innerH = height - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * innerH;

  const ticks = [max, (max + min) / 2, min];

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <>
          {ticks.map((t, i) => (
            <View key={i} style={{ position: "absolute", left: 0, right: 0, top: y(t) - 8 }}>
              <Text style={{ color: colors.faint, fontSize: 10, width: padL - 6, textAlign: "right" }}>{Math.round(t)}</Text>
              <View style={{ position: "absolute", left: padL, right: padR, top: 8, height: 1, backgroundColor: colors.line, opacity: 0.6 }} />
            </View>
          ))}
          {points.slice(1).map((p, i) => {
            const x1 = x(i), y1 = y(points[i].value), x2 = x(i + 1), y2 = y(p.value);
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            return (
              <View
                key={`s${i}`}
                style={{
                  position: "absolute",
                  left: (x1 + x2) / 2 - len / 2,
                  top: (y1 + y2) / 2 - 1.5,
                  width: len,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brand,
                  transform: [{ rotate: `${angle}rad` }],
                }}
              />
            );
          })}
          {points.map((p, i) => (
            <View
              key={`d${i}`}
              style={{
                position: "absolute",
                left: x(i) - (p.highlight ? 6 : 4),
                top: y(p.value) - (p.highlight ? 6 : 4),
                width: p.highlight ? 12 : 8,
                height: p.highlight ? 12 : 8,
                borderRadius: 6,
                backgroundColor: p.highlight ? colors.text : colors.brand,
                borderWidth: p.highlight ? 3 : 0,
                borderColor: colors.brand,
              }}
            />
          ))}
          <Text style={{ position: "absolute", left: padL, bottom: 0, color: colors.faint, fontSize: 10 }}>{points[0].label}</Text>
          <Text style={{ position: "absolute", right: padR, bottom: 0, color: colors.faint, fontSize: 10 }}>{points[points.length - 1].label}</Text>
          <Text style={{ position: "absolute", right: padR, top: -2, color: colors.faint, fontSize: 10 }}>est. 1RM ({unit})</Text>
        </>
      ) : null}
    </View>
  );
}
