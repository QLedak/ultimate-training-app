import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, H1, P, Screen } from "../components/ui";
import { RebuildRequestCard } from "../components/RebuildRequestCard";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { prettyDate } from "../lib/dates";
import { injuryLabel } from "../lib/injuries";
import { isGameLabel, normalizeCommitments, normalizeTournaments } from "../lib/schedule.core";
import { colors } from "../theme";

function Row({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Ionicons name={icon as any} size={24} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

type Summary = { season: string; days: string; equipment: string; injuries: string };

/** "My info": everything the athlete can update, with a one-line status on each, plus plan-update requests. */
export default function AccountScreen({ navigation }: any) {
  const { athlete, signOut } = useAuth();
  const [sum, setSum] = useState<Partial<Summary>>({});

  useFocusEffect(
    useCallback(() => {
      if (!athlete) return;
      const id = athlete.id;
      // Each line loads on its own and quietly stays generic if it fails.
      api<any>(`/api/athletes/${id}/schedule`)
        .then((d) => {
          const t = normalizeTournaments(d.tournament_weekends);
          const games = normalizeCommitments(d.recurring_commitments).filter((c) => isGameLabel(c.label));
          const next = t.filter((x) => x.start_date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
          const bits = [
            d.season_over ? "Season ended" : d.season_end ? `Season ends ${prettyDate(d.season_end)}` : "",
            games.length ? `${games.length} game night${games.length === 1 ? "" : "s"}` : "",
            next ? `Next: ${next.label || "tournament"}, ${prettyDate(next.start_date)}` : "",
          ].filter(Boolean);
          setSum((s) => ({ ...s, season: bits.join(" · ") || "Dates, tournaments, game nights" }));
        })
        .catch(() => {});
      api<any>(`/api/athletes/${id}/days-change-request`)
        .then((d) => setSum((s) => ({ ...s, days: d.pending_request ? `${d.current_days_per_week} days a week · change pending` : `${d.current_days_per_week ?? "?"} days a week` })))
        .catch(() => {});
      api<any>(`/api/athletes/${id}/equipment`)
        .then((d) => setSum((s) => ({ ...s, equipment: `${(d.equipment ?? []).length} item${(d.equipment ?? []).length === 1 ? "" : "s"} selected` })))
        .catch(() => {});
      api<any>(`/api/athletes/${id}/injury-status`)
        .then((d) => {
          const list: Array<{ location: string }> = d.current_active_injuries ?? [];
          setSum((s) => ({ ...s, injuries: list.length ? list.map((i) => injuryLabel(i.location)).join(", ") : "No active injuries" }));
        })
        .catch(() => {});
    }, [athlete])
  );

  return (
    <Screen>
      <H1>{athlete?.name ?? "My info"}</H1>
      <P muted>{athlete?.email}</P>
      <Card>
        <Row icon="calendar-outline" title="Season & game days" sub={sum.season ?? "Dates, tournaments, game nights"} onPress={() => navigation.navigate("Season")} />
        <Row icon="repeat-outline" title="Training days per week" sub={sum.days ?? "Request a change"} onPress={() => navigation.navigate("TrainingDays")} />
        <Row icon="barbell-outline" title="Equipment" sub={sum.equipment ?? "What you can train with"} onPress={() => navigation.navigate("Equipment")} />
        <Row icon="bandage-outline" title="Injury status" sub={sum.injuries ?? "Check in or report something new"} onPress={() => navigation.navigate("Injuries")} />
        <Row icon="notifications-outline" title="Workout reminders" sub="A nudge on training days" onPress={() => navigation.navigate("Reminders")} />
      </Card>

      <RebuildRequestCard />

      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => Alert.alert("Sign out?", "", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => signOut() }])}
      />
      <Button title="Delete account" variant="link" onPress={() => navigation.navigate("DeleteAccount")} style={{ alignSelf: "center", marginTop: 8 }} />
    </Screen>
  );
}
