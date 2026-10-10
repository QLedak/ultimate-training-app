import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, ErrorText, H2, Loading, P } from "../components/ui";
import { statusColor, statusLabel } from "./HomeScreen";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { addDays, dowShort, prettyDate, startOfWeekStr, todayStr } from "../lib/dates";
import { colors } from "../theme";
import type { SessionSummary } from "../types";

export default function ScheduleScreen({ navigation }: any) {
  const { athlete } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeekStr(todayStr()));
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    setError(null);
    try {
      const d = await api<{ sessions: SessionSummary[] }>(
        `/api/athletes/${athlete.id}/sessions?start=${weekStart}&end=${addDays(weekStart, 6)}`
      );
      setSessions(d.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete, weekStart]);

  useEffect(() => { setSessions(null); }, [weekStart]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayStr();

  return (
    <ScrollView
      style={{ backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Button title="‹ Prev" variant="secondary" onPress={() => setWeekStart(addDays(weekStart, -7))} />
        <View style={{ alignItems: "center" }}>
          <H2>{prettyDate(weekStart)} - {prettyDate(addDays(weekStart, 6))}</H2>
          {weekStart !== startOfWeekStr(today) ? <Button title="This week" variant="link" onPress={() => setWeekStart(startOfWeekStr(today))} /> : null}
        </View>
        <Button title="Next ›" variant="secondary" onPress={() => setWeekStart(addDays(weekStart, 7))} />
      </View>

      <ErrorText>{error}</ErrorText>
      {sessions === null && !error ? <Loading /> : null}

      {sessions
        ? days.map((d) => {
            const list = sessions.filter((s) => s.date === d);
            return (
              <View key={d} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 48, alignItems: "center", paddingTop: 10 }}>
                  <Text style={{ fontSize: 12, color: d === today ? colors.brand : colors.muted, fontWeight: "700" }}>{dowShort(d)}</Text>
                  <Text style={{ fontSize: 18, color: d === today ? colors.brand : colors.text, fontWeight: "700" }}>{Number(d.slice(8))}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {list.length === 0 ? (
                    <Card style={{ paddingVertical: 12, backgroundColor: colors.bgSoft }}><P small muted>Rest</P></Card>
                  ) : (
                    list.map((s) => (
                      <Pressable key={s.id} onPress={() => navigation.navigate("Session", { sessionId: s.id })}>
                        <Card tone={d === today ? "brand" : undefined} style={{ paddingVertical: 10 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.brandDark, flexShrink: 1 }}>{s.day_label}</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor(s.status, s.date) }}>{statusLabel(s.status, s.date)}</Text>
                          </View>
                          <P small muted>Week {s.week_number} · {s.exercise_count} exercises{s.week_type !== "build" ? ` · ${s.week_type}` : ""}</P>
                        </Card>
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            );
          })
        : null}
      <P small muted style={{ marginTop: 8 }}>Tap a workout to open it. To move it to another day, open it and choose Reschedule.</P>
    </ScrollView>
  );
}
