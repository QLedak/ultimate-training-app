import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../components/ui";
import { formatClock } from "./state";
import { colors } from "../theme";

/** Countdown for timed holds. Stopping records the seconds held into the set's reps field. */
export function WorkTimer({
  targetSeconds, recordedSeconds, onDone, onClear,
}: { targetSeconds: number; recordedSeconds: string; onDone: (s: number) => void; onClear: () => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 200);
    return () => clearInterval(t);
  }, [running]);

  if (!running && recordedSeconds !== "") {
    const rec = Number(recordedSeconds);
    return (
      <View style={box(colors.greenBg, colors.greenLine)}>
        <Text style={{ fontSize: 12, color: colors.muted }}>Recorded (target {formatClock(targetSeconds)})</Text>
        <Text style={big}>{formatClock(Number.isFinite(rec) ? rec : 0)}</Text>
        <Button title="Redo timer" variant="link" onPress={onClear} />
      </View>
    );
  }

  const atTarget = targetSeconds > 0 && elapsed >= targetSeconds;
  const remaining = running ? Math.max(0, targetSeconds - elapsed) : targetSeconds;
  return (
    <View style={box(atTarget ? colors.greenBg : colors.card, atTarget ? colors.greenLine : colors.line)}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Target: {formatClock(targetSeconds)}</Text>
      <Text style={big}>{formatClock(remaining)}</Text>
      {atTarget ? <Text style={{ fontSize: 12, color: colors.green, fontWeight: "700" }}>Time's up - stop when ready</Text> : null}
      {running && !atTarget ? <Text style={{ fontSize: 12, color: colors.faint }}>{formatClock(elapsed)} elapsed</Text> : null}
      <View style={{ alignSelf: "stretch", marginTop: 8 }}>
        {!running ? (
          <Button title="Start timer" onPress={() => setRunning(true)} />
        ) : (
          <Button title="Stop" variant="dark" onPress={() => { setRunning(false); onDone(Math.max(1, elapsed)); }} />
        )}
      </View>
    </View>
  );
}

const big = { fontSize: 40, fontWeight: "800" as const, color: colors.text, fontVariant: ["tabular-nums" as const] };
const box = (bg: string, border: string) => ({
  borderWidth: 1, borderColor: border, backgroundColor: bg, borderRadius: 14, padding: 14, alignItems: "center" as const,
});
