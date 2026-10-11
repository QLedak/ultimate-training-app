import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, H1, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
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

export default function AccountScreen({ navigation }: any) {
  const { athlete, signOut } = useAuth();
  return (
    <Screen>
      <H1>{athlete?.name ?? "Account"}</H1>
      <P muted>{athlete?.email}</P>
      <Card>
        <Row icon="barbell-outline" title="Equipment" sub="What you can train with" onPress={() => navigation.navigate("Equipment")} />
        <Row icon="bandage-outline" title="Injury status" sub="Check in or report something new" onPress={() => navigation.navigate("Injuries")} />
        <Row icon="notifications-outline" title="Workout reminders" sub="A nudge on training days" onPress={() => navigation.navigate("Reminders")} />
      </Card>
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => Alert.alert("Sign out?", "", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => signOut() }])}
      />
    </Screen>
  );
}
