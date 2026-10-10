import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card, ErrorText, H1, Loading, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { prettyDate } from "../lib/dates";
import { colors } from "../theme";
import type { ExerciseListItem } from "../types";

export default function ProgressScreen({ navigation }: any) {
  const { athlete } = useAuth();
  const [items, setItems] = useState<ExerciseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    setError(null);
    try {
      const d = await api<{ exercises: ExerciseListItem[] }>(`/api/athletes/${athlete.id}/exercise-history`);
      setItems(d.exercises);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor={colors.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <H1>Track your progress</H1>
      <P muted>Every lift you've logged, with your estimated 1RM over time.</P>
      <ErrorText>{error}</ErrorText>
      {items === null && !error ? <Loading /> : null}
      {items?.length === 0 ? (
        <Card><P muted>Nothing to chart yet. Log a few weighted sets and they'll show up here.</P></Card>
      ) : null}
      {items?.map((x) => (
        <Pressable key={x.exercise_id} onPress={() => navigation.navigate("ExerciseHistory", { exerciseId: x.exercise_id, name: x.exercise_name })}>
          <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{x.exercise_name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {x.times_logged} workout{x.times_logged === 1 ? "" : "s"}{x.last_date ? ` · last ${prettyDate(x.last_date)}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: colors.brand, fontSize: 18, fontWeight: "800" }}>{x.best_est_1rm ? Math.round(x.best_est_1rm) : x.heaviest_weight}</Text>
              <Text style={{ color: colors.faint, fontSize: 10 }}>{x.best_est_1rm ? "est. 1RM" : "heaviest lb"}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
