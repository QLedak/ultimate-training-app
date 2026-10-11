import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../components/ui";
import { formatClock } from "./state";
import { colors } from "../theme";

/**
 * Countdown for timed holds. It is only a guide: it never changes the logged seconds.
 * The "seconds held" box is pre-filled with the prescribed time and stays that way
 * unless the athlete edits it.
 */
export function WorkTimer({ targetSeconds }: { targetSeconds: number }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 200);
    return () => clearInterval(t);
  }, [running]);

  const atTarget = targetSeconds > 0 && elapsed >= targetSeconds;
  const remaining = running ? Math.max(0, targetSeconds - elapsed) : targetSeconds;
  return (
    <View style={box(running && atTarget ? colors.greenBg : colors.card, running && atTarget ? colors.greenLine : colors.line)}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Target: {formatClock(targetSeconds)}</Text>
      <Text style={big}>{formatClock(remaining)}</Text>
      {running && atTarget ? <Text style={{ fontSize: 12, color: colors.green, fontWeight: "700" }}>Time's up</Text> : null}
      <View style={{ alignSelf: "stretch", marginTop: 8 }}>
        {!running ? (
          <Button title="Start timer" onPress={() => setRunning(true)} />
        ) : (
          <Button title={atTarget ? "Done" : "Stop"} variant="dark" onPress={() => setRunning(false)} />
        )}
      </View>
    </View>
  );
}

const big = { fontSize: 40, fontWeight: "800" as const, color: colors.text, fontVariant: ["tabular-nums" as const] };
const box = (bg: string, border: string) => ({
  borderWidth: 1, borderColor: border, backgroundColor: bg, borderRadius: 14, padding: 14, alignItems: "center" as const,
});
