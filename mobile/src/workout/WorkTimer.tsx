import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../components/ui";
import { formatClock } from "./state";
import { colors } from "../theme";

const SIDES = ["Left side", "Right side"];

/**
 * Countdown for timed holds. It is only a guide: it never changes the logged seconds.
 * With perSide, it runs once for each side (left, then right) at the same target.
 */
export function WorkTimer({ targetSeconds, perSide = false }: { targetSeconds: number; perSide?: boolean }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [side, setSide] = useState(0);
  const [finished, setFinished] = useState(false);
  const sides = perSide ? 2 : 1;

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 200);
    return () => clearInterval(t);
  }, [running]);

  // New target (swapped exercise or edited time) resets the run.
  useEffect(() => {
    setRunning(false); setSide(0); setFinished(false); setElapsed(0);
  }, [targetSeconds, perSide]);

  const atTarget = targetSeconds > 0 && elapsed >= targetSeconds;
  const remaining = running ? Math.max(0, targetSeconds - elapsed) : targetSeconds;
  const lastSide = side >= sides - 1;

  function stop() {
    setRunning(false);
    setElapsed(0);
    if (lastSide) setFinished(true);
    else setSide((x) => x + 1); // next press starts the other side
  }

  return (
    <View style={box(running && atTarget ? colors.greenBg : colors.card, running && atTarget ? colors.greenLine : colors.line)}>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        Target: {formatClock(targetSeconds)}{perSide ? " each side" : ""}
      </Text>
      {perSide ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          {SIDES.map((name, i) => (
            <View
              key={name}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
                borderColor: i === side && !finished ? colors.brand : i < side || finished ? colors.greenLine : colors.line,
                backgroundColor: i === side && !finished ? colors.brandBg : "transparent",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: i < side || finished ? colors.green : colors.text }}>
                {name}{i < side || finished ? " ✓" : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={big}>{formatClock(remaining)}</Text>
      {running && atTarget ? <Text style={{ fontSize: 12, color: colors.green, fontWeight: "700" }}>Time's up</Text> : null}
      <View style={{ alignSelf: "stretch", marginTop: 8, gap: 8 }}>
        {finished ? (
          <Button title="Run again" variant="secondary" onPress={() => { setSide(0); setFinished(false); setRunning(true); }} />
        ) : !running ? (
          <Button title={perSide ? `Start ${SIDES[side].toLowerCase()}` : "Start timer"} onPress={() => setRunning(true)} />
        ) : (
          <Button title={atTarget || !perSide ? (atTarget ? "Done" : "Stop") : "Stop this side"} variant="dark" onPress={stop} />
        )}
      </View>
    </View>
  );
}

const big = { fontSize: 40, fontWeight: "800" as const, color: colors.text, fontVariant: ["tabular-nums" as const] };
const box = (bg: string, border: string) => ({
  borderWidth: 1, borderColor: border, backgroundColor: bg, borderRadius: 14, padding: 14, alignItems: "center" as const,
});
