import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Alert } from "react-native";
import { Button, Card, ErrorText, Field, H1, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

/** Permanently deletes the account and all its data (required by the App Store). */
export default function DeleteAccountScreen() {
  const { athlete } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function ask() {
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete forever", style: "destructive", onPress: run },
    ]);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/account", { method: "DELETE", body: { confirm } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      return;
    }
    // The account is gone. Clear everything stored on this phone, then sign out locally.
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
    try { await supabase.auth.signOut({ scope: "local" }); } catch {} // swaps the app back to the sign-in screens
    try { await AsyncStorage.clear(); } catch {}
  }

  return (
    <Screen>
      <H1>Delete account</H1>
      <Card tone="amber">
        <P>This permanently deletes {athlete?.email ?? "your account"} and everything with it: your intake, season plan, programs, workout logs, progress history and reminders.</P>
        <P muted>It can't be undone. If you only want to pause, just sign out instead.</P>
      </Card>
      <Field label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      <ErrorText>{error}</ErrorText>
      <Button title="Delete my account" onPress={ask} loading={busy} disabled={confirm.trim().toUpperCase() !== "DELETE"} />
    </Screen>
  );
}
