import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Caps, ErrorText, H1, Loading, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { COACH_PLAN, factsLine, priceLabel, type Product } from "../lib/plans.core";
import { colors } from "../theme";

/** Browse everything on offer: the coach-built season plan, then the stand-alone programs. Works signed out. */
export default function PlansScreen({ navigation }: any) {
  const { athlete, hasIntake } = useAuth();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api<{ products: Product[] }>("/api/products");
      setProducts(d.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (athlete) {
      api<{ purchases: Array<{ product_id: string }> }>(`/api/athletes/${athlete.id}/purchases`)
        .then((d) => setOwned(new Set(d.purchases.map((p) => p.product_id))))
        .catch(() => {});
    }
  }, [athlete]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor={colors.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <H1>Choose your training</H1>
      <P muted>Get a season plan built around your schedule, or start a ready-made program today.</P>

      <Pressable onPress={() => navigation.navigate("CoachPlan")}>
        <Card tone="brand">
          <Caps color={colors.brand}>Built for you</Caps>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{COACH_PLAN.title}</Text>
          <P muted>{COACH_PLAN.tagline}</P>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <Text style={{ color: colors.brand, fontWeight: "800" }}>{hasIntake ? "Intake complete" : COACH_PLAN.price}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>See details</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </View>
          </View>
        </Card>
      </Pressable>

      <Caps>Ready-made programs</Caps>
      <ErrorText>{error}</ErrorText>
      {products === null && !error ? <Loading /> : null}
      {products?.length === 0 ? <P muted>No programs are available right now. Check back soon.</P> : null}
      {products?.map((p) => (
        <Pressable key={p.id} onPress={() => navigation.navigate("PlanDetail", { id: p.id })}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: "800", flex: 1 }}>{p.title}</Text>
              {owned.has(p.id) ? <Text style={{ color: colors.green, fontWeight: "800", fontSize: 12 }}>OWNED</Text> : null}
            </View>
            <P small muted>{factsLine(p)}</P>
            {p.description ? <P numberOfLines={3}>{p.description}</P> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
              <Text style={{ color: colors.brand, fontWeight: "800" }}>{priceLabel(p.price_cents, p.currency)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
