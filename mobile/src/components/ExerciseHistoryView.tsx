import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Card, Caps, ErrorText, Loading, P } from "./ui";
import { LineChart } from "./LineChart";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { prettyDate } from "../lib/dates";
import { colors } from "../theme";
import type { ExerciseHistory } from "../types";

/** Chart + PRs + per-session sets for one exercise. Used by the Progress tab and the in-workout sheet. */
export function ExerciseHistoryView({ exerciseId, onLoaded }: { exerciseId: string; onLoaded?: (name: string) => void }) {
  const { athlete } = useAuth();
  const [data, setData] = useState<ExerciseHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    let alive = true;
    api<ExerciseHistory>(`/api/athletes/${athlete.id}/exercise-history/${encodeURIComponent(exerciseId)}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        onLoaded?.(d.exercise_name);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete, exerciseId]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Loading />;
  if (data.entries.length === 0) return <P muted>No logged sets for this exercise yet. Log it once and your history shows up here.</P>;

  const chronological = data.entries.slice().reverse();
  const points = chronological
    .filter((e) => e.best_est_1rm != null)
    .map((e) => ({ label: prettyDate(e.date), value: e.best_est_1rm as number, highlight: e.is_pr }));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Best est. 1RM" value={data.summary.best_est_1rm ? `${Math.round(data.summary.best_est_1rm.value)} lb` : "-"} sub={data.summary.best_est_1rm ? prettyDate(data.summary.best_est_1rm.date) : ""} />
        <Stat
          label="Heaviest set"
          value={data.summary.heaviest ? `${data.summary.heaviest.weight} lb` : "-"}
          sub={data.summary.heaviest ? `${data.summary.heaviest.reps ?? "?"} reps · ${prettyDate(data.summary.heaviest.date)}` : ""}
        />
      </View>

      {points.length >= 2 ? (
        <Card>
          <Caps>Estimated 1RM over time</Caps>
          <LineChart points={points} />
        </Card>
      ) : (
        <P small muted>The chart appears once you've logged this lift in two different workouts.</P>
      )}

      <Caps>History</Caps>
      {data.entries.map((e) => (
        <Card key={e.session_id} style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{prettyDate(e.date)}</Text>
            {e.is_pr ? <Text style={{ color: colors.brand, fontWeight: "800", fontSize: 12 }}>NEW PR</Text> : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            {e.sets.map((s) => `${s.weight ?? "-"}×${s.reps ?? "-"}`).join("  ·  ")}
          </Text>
          {e.best_est_1rm != null ? <Text style={{ color: colors.faint, fontSize: 12 }}>Est. 1RM {Math.round(e.best_est_1rm)} lb</Text> : null}
        </Card>
      ))}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Caps>{label}</Caps>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      {sub ? <Text style={{ color: colors.faint, fontSize: 11 }}>{sub}</Text> : null}
    </Card>
  );
}
