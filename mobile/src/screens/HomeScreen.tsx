import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, Caps, ErrorText, H1, H2, Loading, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { addDays, dowShort, prettyDate, startOfWeekStr, todayStr } from "../lib/dates";
import { currentPhaseInfo } from "../lib/phase";
import { workoutIcon } from "../lib/workoutIcons";
import { colors } from "../theme";
import type { Phase, SessionSummary } from "../types";

export function statusLabel(status: SessionSummary["status"], date: string) {
  if (status === "completed") return "Logged";
  if (status === "partially_completed") return "Partial";
  if (status === "skipped") return "Skipped";
  return date < todayStr() ? "Missed" : "Not logged";
}
export function statusColor(status: SessionSummary["status"], date: string) {
  if (status === "completed") return colors.green;
  if (status === "partially_completed") return colors.amber;
  if (status === "skipped") return colors.faint;
  return date < todayStr() ? colors.red : colors.brand;
}

export default function HomeScreen({ navigation }: any) {
  const { athlete, noAthlete, profileError, signOut, refreshProfile } = useAuth();
  const today = todayStr();
  const [weekStart, setWeekStart] = useState(startOfWeekStr(today));
  const [selected, setSelected] = useState(today);
  const [week, setWeek] = useState<SessionSummary[] | null>(null);
  const [missed, setMissed] = useState<SessionSummary[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    setError(null);
    try {
      const [w, m, p] = await Promise.all([
        api<{ sessions: SessionSummary[] }>(`/api/athletes/${athlete.id}/sessions?start=${weekStart}&end=${addDays(weekStart, 6)}`),
        api<{ sessions: SessionSummary[] }>(`/api/athletes/${athlete.id}/sessions?daysBack=7&daysForward=0`),
        api<{ phases: Phase[] }>(`/api/athletes/${athlete.id}/program`).catch(() => ({ phases: [] as Phase[] })),
      ]);
      setWeek(w.sessions);
      setMissed(m.sessions.filter((x) => x.date < todayStr() && !x.status));
      setPhases(p.phases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete, weekStart]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (noAthlete) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 12 }}>
        <H1>Finish setting up</H1>
        <P muted>Your account doesn't have an athlete profile yet. Complete intake on the website, then check again here.</P>
        <Button title="Check again" onPress={refreshProfile} />
        <Button title="Sign out" variant="link" onPress={signOut} />
      </SafeAreaView>
    );
  }
  if (profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 12 }}>
        <ErrorText>{profileError}</ErrorText>
        <Button title="Try again" onPress={refreshProfile} />
        <Button title="Sign out" variant="link" onPress={signOut} />
      </SafeAreaView>
    );
  }

  const info = currentPhaseInfo(phases, today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayList = (week ?? []).filter((x) => x.date === selected);
  const thisWeek = startOfWeekStr(today);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor={colors.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <ErrorText>{error}</ErrorText>

      {info ? (
        <Card>
          <Caps color={colors.brand}>Phase {info.index + 1} of {info.phases.length}</Caps>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{info.active.phase_name}</Text>
          <View style={{ flexDirection: "row", gap: 4, marginVertical: 4 }}>
            {info.phases.map((p, i) => (
              <View key={p.id} style={{ flex: Math.max(1, p.week_count), gap: 4 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i < info.index ? "#8A4A19" : i === info.index ? colors.brand : colors.cardAlt,
                  }}
                />
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Week {info.weekOfPhase} of {info.active.week_count} · ends {prettyDate(info.active.end_date)}
          </Text>
        </Card>
      ) : null}

      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Pressable hitSlop={10} onPress={() => { const w = addDays(weekStart, -7); setWeekStart(w); setSelected(w); setWeek(null); }}>
            <Text style={{ color: colors.brand, fontSize: 22 }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Caps>{weekStart === thisWeek ? "This week" : `${prettyDate(weekStart)} – ${prettyDate(addDays(weekStart, 6))}`}</Caps>
            {weekStart !== thisWeek ? (
              <Button title="Back to this week" variant="link" onPress={() => { setWeekStart(thisWeek); setSelected(today); setWeek(null); }} />
            ) : null}
          </View>
          <Pressable hitSlop={10} onPress={() => { const w = addDays(weekStart, 7); setWeekStart(w); setSelected(w); setWeek(null); }}>
            <Text style={{ color: colors.brand, fontSize: 22 }}>›</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          {days.map((d) => {
            const list = (week ?? []).filter((x) => x.date === d);
            const isSel = d === selected;
            const dot =
              list.length === 0 ? null
              : list.every((x) => x.status === "completed") ? colors.green
              : list.some((x) => x.status) ? colors.amber
              : d < today ? colors.red : colors.brand;
            return (
              <Pressable
                key={d}
                onPress={() => setSelected(d)}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 2,
                  borderColor: isSel ? colors.brand : colors.line,
                  backgroundColor: isSel ? colors.brandBg : colors.card,
                }}
              >
                <Text style={{ fontSize: 11, color: d === today ? colors.brand : colors.muted, fontWeight: "700" }}>{dowShort(d).toUpperCase()}</Text>
                <Text style={{ fontSize: 18, color: colors.text, fontWeight: "800", marginVertical: 2 }}>{Number(d.slice(8))}</Text>
                <View
                  style={{
                    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                    borderWidth: 2, borderColor: dot ?? "transparent", backgroundColor: dot ? colors.bg : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{list.length ? workoutIcon(list[0].day_label).icon : ""}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <H2>{selected === today ? "Today" : prettyDate(selected)}</H2>
      {week === null && !error ? <Loading /> : null}
      {week && dayList.length === 0 ? <Card><P muted>Rest day. Nothing scheduled.</P></Card> : null}
      {dayList.map((x) => (
        <SessionCard key={x.id} s={x} primary={selected === today} onPress={() => navigation.navigate("Session", { sessionId: x.id })} />
      ))}

      {missed.length ? (
        <>
          <H2>Missed</H2>
          {missed.map((x) => <SessionCard key={x.id} s={x} onPress={() => navigation.navigate("Session", { sessionId: x.id })} />)}
        </>
      ) : null}
    </ScrollView>
  );
}

export function SessionCard({ s, onPress, primary }: { s: SessionSummary; onPress: () => void; primary?: boolean }) {
  return (
    <Card tone={primary && !s.status ? "brand" : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 30, marginRight: 10 }}>{workoutIcon(s.day_label).icon}</Text>
        <View style={{ flexShrink: 1, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{s.day_label}</Text>
          <P small muted>
            {prettyDate(s.date)} · Week {s.week_number} · {s.exercise_count} exercises{s.week_type !== "build" ? ` · ${s.week_type}` : ""}
          </P>
        </View>
        <Text style={{ fontSize: 12, fontWeight: "800", color: statusColor(s.status, s.date) }}>{statusLabel(s.status, s.date)}</Text>
      </View>
      <Button title={s.status ? "Open" : primary ? "Start" : "View"} variant={primary && !s.status ? "primary" : "secondary"} onPress={onPress} />
    </Card>
  );
}
