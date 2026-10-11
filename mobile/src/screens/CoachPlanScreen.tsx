import React from "react";
import { Text, View } from "react-native";
import { Button, Card, Caps, H1, H2, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { COACH_PLAN } from "../lib/plans.core";
import { colors } from "../theme";

/** Marketing page for the coach-built season plan, with the right next step for where the visitor is. */
export default function CoachPlanScreen({ navigation }: any) {
  const { athlete, hasIntake, setPendingPlanId } = useAuth();

  return (
    <Screen>
      <Caps color={colors.brand}>Built for you</Caps>
      <H1>{COACH_PLAN.title}</H1>
      <Text style={{ color: colors.brand, fontWeight: "800" }}>{COACH_PLAN.price}</Text>
      <P muted>{COACH_PLAN.tagline}</P>

      <Caps>What you get</Caps>
      <Card>
        {COACH_PLAN.bullets.map((b) => (
          <View key={b} style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ color: colors.brand, fontWeight: "900" }}>✓</Text>
            <P style={{ flex: 1 }}>{b}</P>
          </View>
        ))}
      </Card>

      <Caps>How it works</Caps>
      <Card>
        {COACH_PLAN.how.map((step, i) => (
          <View key={step} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.onBrand, fontWeight: "800" }}>{i + 1}</Text>
            </View>
            <P style={{ flex: 1 }}>{step}</P>
          </View>
        ))}
      </Card>

      {!athlete ? (
        <Card tone="brand">
          <H2>Start your plan</H2>
          <Button title="Create account" onPress={() => { setPendingPlanId("coach"); navigation.navigate("SignUp"); }} />
          <Button title="I already have an account" variant="link" onPress={() => { setPendingPlanId("coach"); navigation.navigate("Login"); }} style={{ alignSelf: "center" }} />
        </Card>
      ) : hasIntake ? (
        <Card tone="green">
          <H2>Your intake is in</H2>
          <P muted>Your coach builds and reviews your season plan next. You'll see it on Today once it's ready.</P>
          <Button title="Back to Today" variant="secondary" onPress={() => navigation.navigate("Main", { screen: "Today" })} />
        </Card>
      ) : (
        <Card tone="brand">
          <H2>Ready when you are</H2>
          <P muted>The intake takes about 5 minutes, and your answers save as you go.</P>
          <Button title="Start intake" onPress={() => navigation.navigate("Intake")} />
        </Card>
      )}
    </Screen>
  );
}
