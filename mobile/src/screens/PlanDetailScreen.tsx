import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Caps, ErrorText, H1, H2, Loading, P, Screen } from "../components/ui";
import { DateField } from "../components/DateField";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { todayStr } from "../lib/dates";
import {
  WEEKDAY_SHORT, daysProblem, defaultDaysFor, equipmentLabel, factsLine, priceLabel, toggleWeekday, weekTypeNote,
  type OutlineWeek, type Product,
} from "../lib/plans.core";
import { colors } from "../theme";

/** One ready-made program: marketing details, week-by-week layout, and (signed in) choose days and start. */
export default function PlanDetailScreen({ route, navigation }: any) {
  const id: string = route.params.id;
  const { athlete, setPendingPlanId } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [outline, setOutline] = useState<OutlineWeek[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);
  const [start, setStart] = useState(todayStr());
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ product: Product; outline: OutlineWeek[] }>(`/api/products/${id}`)
      .then((d) => { setProduct(d.product); setOutline(d.outline); setDays(defaultDaysFor(d.product.days_per_week)); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    if (!athlete) return;
    api<{ purchases: Array<{ product_id: string }> }>(`/api/athletes/${athlete.id}/purchases`)
      .then((d) => setOwned(d.purchases.some((p) => p.product_id === id)))
      .catch(() => {});
  }, [athlete, id]);

  async function getProgram() {
    if (!product) return;
    setError(null);
    if (start < todayStr()) return setError("The start date can't be in the past.");
    const problem = daysProblem(days, product.days_per_week);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await api("/api/purchases", { method: "POST", body: { product_id: product.id, start_date: start, weekdays: days } });
      navigation.navigate("Main", { screen: "Programs" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function signUpFirst(screen: "SignUp" | "Login") {
    setPendingPlanId(id);
    navigation.navigate(screen);
  }

  if (loadError) return <Screen><ErrorText>{loadError}</ErrorText></Screen>;
  if (!product) return <Screen><Loading /></Screen>;

  const need = product.days_per_week;
  const free = product.price_cents === 0;
  return (
    <Screen>
      <H1>{product.title}</H1>
      <Text style={{ color: colors.brand, fontWeight: "800" }}>{priceLabel(product.price_cents, product.currency)}</Text>
      <P small muted>{factsLine(product)}</P>
      {product.description ? <P>{product.description}</P> : null}

      <Caps>What you need</Caps>
      <Card>
        {product.equipment.map((e) => <P key={e}>• {equipmentLabel(e)}</P>)}
        <P small muted>You can swap any exercise for a similar one while you train if something isn't available.</P>
      </Card>

      <Caps>How it's laid out</Caps>
      <Card>
        {outline.map((w) => (
          <View key={w.week_number} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "700", width: 110 }}>Week {w.week_number}{weekTypeNote(w.week_type)}</Text>
            <Text style={{ color: colors.muted, flex: 1, textAlign: "right", fontSize: 13 }}>{w.days.map((d) => d.day_label).join(" · ")}</Text>
          </View>
        ))}
        {product.tests && product.tests.length > 0 ? (
          <P small muted>Tested in weeks {product.tests[0].weeks.join(" and ")}: {product.tests.map((t) => t.label.toLowerCase()).join(", ")}.</P>
        ) : null}
      </Card>

      {!athlete ? (
        <Card tone="brand">
          <H2>Get this program</H2>
          <P muted>Create a free account to start. It takes under a minute.</P>
          <Button title="Create account" onPress={() => signUpFirst("SignUp")} />
          <Button title="I already have an account" variant="link" onPress={() => signUpFirst("Login")} style={{ alignSelf: "center" }} />
        </Card>
      ) : owned ? (
        <Card tone="green">
          <H2>You have this program</H2>
          <Button title="Open My programs" onPress={() => navigation.navigate("Main", { screen: "Programs" })} />
        </Card>
      ) : (
        <Card tone="brand">
          <H2>Set your schedule</H2>
          <DateField label="Start date" value={start} onChange={setStart} />
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Your {need} training days</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {WEEKDAY_SHORT.map((label, d) => {
                const on = days.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDays(toggleWeekday(days, d))}
                    style={{ minWidth: 48, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? colors.brand : colors.line, backgroundColor: on ? colors.brandBg : colors.cardAlt }}
                  >
                    <Text style={{ color: on ? colors.brand : colors.text, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <P small muted style={{ marginTop: 6 }}>
              {product.suggested_schedule ? `Suggested: ${product.suggested_schedule}. ` : ""}Keep your hardest lower-body day and your sprint day apart. You can move individual workouts later.
            </P>
          </View>
          <ErrorText>{error}</ErrorText>
          <Button title={free ? "Get this program" : `Get for ${priceLabel(product.price_cents, product.currency)}`} onPress={getProgram} loading={busy} disabled={days.length !== need} />
          {days.length !== need ? <P small muted>{daysProblem(days, need)}</P> : null}
        </Card>
      )}
    </Screen>
  );
}
