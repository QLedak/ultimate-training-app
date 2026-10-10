import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, ErrorText, H1, H2, Loading, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { prettyDate, todayStr } from "../lib/dates";
import { colors } from "../theme";
import type { PurchaseRow, SessionSummary } from "../types";

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
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    setError(null);
    try {
      const [s, p] = await Promise.all([
        api<{ sessions: SessionSummary[] }>(`/api/athletes/${athlete.id}/sessions?daysBack=7&daysForward=7`),
        api<{ purchases: PurchaseRow[] }>(`/api/athletes/${athlete.id}/purchases`).catch(() => ({ purchases: [] as PurchaseRow[] })),
      ]);
      setSessions(s.sessions);
      setPurchases(p.purchases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (noAthlete) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center", gap: 12 }}>
        <H1>Finish setting up</H1>
        <P muted>Your account doesn't have an athlete profile yet. Complete intake on the website, then pull to refresh here.</P>
        <Button title="Check again" onPress={refreshProfile} />
        <Button title="Sign out" variant="link" onPress={signOut} />
      </SafeAreaView>
    );
  }
  if (profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center", gap: 12 }}>
        <ErrorText>{profileError}</ErrorText>
        <Button title="Try again" onPress={refreshProfile} />
        <Button title="Sign out" variant="link" onPress={signOut} />
      </SafeAreaView>
    );
  }

  const today = todayStr();
  const todays = (sessions ?? []).filter((x) => x.date === today);
  const upcoming = (sessions ?? []).filter((x) => x.date > today && !x.status).slice(0, 3);
  const missed = (sessions ?? []).filter((x) => x.date < today && !x.status).slice(-3);

  return (
    <ScrollView
      style={{ backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <H1>Hey{athlete?.name ? `, ${athlete.name.split(" ")[0]}` : ""}</H1>
      <ErrorText>{error}</ErrorText>
      {sessions === null && !error ? <Loading /> : null}

      {sessions ? (
        <>
          <H2>Today</H2>
          {todays.length === 0 ? (
            <Card><P muted>No workout scheduled today.</P></Card>
          ) : (
            todays.map((x) => <SessionCard key={x.id} s={x} primary onPress={() => navigation.navigate("Session", { sessionId: x.id })} />)
          )}

          {missed.length ? (
            <>
              <H2>Missed</H2>
              {missed.map((x) => <SessionCard key={x.id} s={x} onPress={() => navigation.navigate("Session", { sessionId: x.id })} />)}
            </>
          ) : null}

          {upcoming.length ? (
            <>
              <H2>Coming up</H2>
              {upcoming.map((x) => <SessionCard key={x.id} s={x} onPress={() => navigation.navigate("Session", { sessionId: x.id })} />)}
            </>
          ) : null}
        </>
      ) : null}

      {purchases.length ? (
        <Card>
          <H2>My programs</H2>
          {purchases.map((p) => (
            <View key={p.id}>
              <P>{p.product?.title ?? p.product_id}</P>
              <P small muted>{p.logged_sessions} of {p.total_sessions} workouts logged</P>
            </View>
          ))}
          <Button title="Open My programs" variant="secondary" onPress={() => navigation.navigate("Programs")} />
        </Card>
      ) : null}

      <Button title="Sign out" variant="link" onPress={signOut} style={{ alignSelf: "center", marginTop: 12 }} />
    </ScrollView>
  );
}

export function SessionCard({ s, onPress, primary }: { s: SessionSummary; onPress: () => void; primary?: boolean }) {
  return (
    <Card tone={primary ? "brand" : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.brandDark }}>{s.day_label}</Text>
          <P small muted>
            {prettyDate(s.date)} · Week {s.week_number} · {s.exercise_count} exercises{s.week_type !== "build" ? ` · ${s.week_type}` : ""}
          </P>
        </View>
        <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor(s.status, s.date) }}>{statusLabel(s.status, s.date)}</Text>
      </View>
      <Button title={s.status ? "Open" : primary ? "Start workout" : "View"} variant={primary && !s.status ? "primary" : "secondary"} onPress={onPress} />
    </Card>
  );
}
