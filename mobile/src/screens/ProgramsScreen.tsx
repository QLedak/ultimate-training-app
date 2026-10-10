import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, ErrorText, H1, H2, Loading, P, ProgressBar } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { prettyDate } from "../lib/dates";
import { colors } from "../theme";
import type { PurchaseRow } from "../types";

export default function ProgramsScreen({ navigation }: any) {
  const { athlete } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<{ purchases: PurchaseRow[] }>(`/api/athletes/${athlete.id}/purchases`);
      setPurchases(d.purchases);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveTest(purchaseId: string, key: string, week: number) {
    const dk = `${purchaseId}|${key}|${week}`;
    setError(null);
    setSaved(null);
    try {
      const value = Number(drafts[dk]);
      if (!Number.isFinite(value)) throw new Error("Enter a number.");
      await api(`/api/purchases/${purchaseId}/tests`, { method: "PUT", body: { test_key: key, week_number: week, value } });
      setSaved(dk);
      setDrafts((d) => ({ ...d, [dk]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor={colors.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <H1>My programs</H1>
      <ErrorText>{error}</ErrorText>
      {purchases === null && !error ? <Loading /> : null}
      {purchases?.length === 0 ? (
        <P muted>You haven't added a program yet. Programs can be added on the website.</P>
      ) : null}

      {purchases?.map((p) => {
        const pct = p.total_sessions ? Math.round((p.logged_sessions / p.total_sessions) * 100) : 0;
        return (
          <Card key={p.id}>
            <H2>{p.product?.title ?? p.product_id}</H2>
            <P small muted>
              {p.logged_sessions} of {p.total_sessions} workouts logged · starts {p.start_date}
              {p.end_date ? ` · ends ${p.end_date}` : ""}
            </P>
            <ProgressBar pct={pct} />
            {p.next_session ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <P>Next: Week {p.next_session.week_number}, {p.next_session.day_label} · {prettyDate(p.next_session.date)}</P>
                <Button title="Open" onPress={() => navigation.navigate("Session", { sessionId: p.next_session!.id })} />
              </View>
            ) : (
              <P muted>All workouts logged. Nice work.</P>
            )}

            {(p.product?.tests?.length ?? 0) > 0 ? (
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>Test results</Text>
                <P small muted>Record these when you do the tests on your test days.</P>
                {p.product!.tests.map((t) => (
                  <View key={t.key} style={{ gap: 6 }}>
                    <P>{t.label} <Text style={{ color: colors.faint, fontSize: 12 }}>({t.unit})</Text></P>
                    {t.weeks.map((wk) => {
                      const dk = `${p.id}|${t.key}|${wk}`;
                      const existing = p.tests.find((r) => r.test_key === t.key && r.week_number === wk);
                      return (
                        <View key={wk} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ width: 52, fontSize: 13, color: colors.muted }}>Wk {wk}</Text>
                          <TextInput
                            keyboardAppearance="dark"
                            value={drafts[dk] ?? ""}
                            onChangeText={(v) => setDrafts((d) => ({ ...d, [dk]: v }))}
                            placeholder={existing ? String(existing.value) : "-"}
                            placeholderTextColor={existing ? colors.text : colors.faint}
                            keyboardType="decimal-pad"
                            style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 8, fontSize: 16, color: colors.text, backgroundColor: colors.cardAlt }}
                          />
                          <Button title="Save" variant="secondary" disabled={!drafts[dk]} onPress={() => saveTest(p.id, t.key, wk)} style={{ minHeight: 40, paddingHorizontal: 12 }} />
                          {saved === dk ? <Text style={{ color: colors.green, fontSize: 12 }}>Saved</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}
