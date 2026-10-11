import React, { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Pressable, Text, View } from "react-native";
import { discardPendingLog, flushPendingLogs, listPendingLogs } from "../lib/pendingLogs";
import type { PendingLog } from "../lib/pendingLogs.core";
import { colors } from "../theme";

/**
 * Shows workouts saved on the phone that haven't reached the server yet, and sends them
 * whenever the app opens or comes back to the foreground. `onSynced` lets the screen reload.
 */
export function SyncBanner({ onSynced }: { onSynced?: () => void }) {
  const [items, setItems] = useState<PendingLog[]>([]);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const r = await flushPendingLogs();
      if (r.synced > 0) onSynced?.();
    } finally {
      setItems(await listPendingLogs());
      setBusy(false);
    }
  }, [onSynced]);

  useEffect(() => {
    sync();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") sync(); });
    return () => sub.remove();
  }, [sync]);

  if (items.length === 0) return null;
  const rejected = items.filter((i) => i.lastError);
  const waiting = items.length - rejected.length;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: rejected.length ? colors.red : colors.amber, padding: 14, gap: 8 }}>
      {waiting > 0 ? (
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          {waiting === 1 ? "1 workout is saved on your phone" : `${waiting} workouts are saved on your phone`}
        </Text>
      ) : null}
      {waiting > 0 ? <Text style={{ color: colors.muted }}>It will send automatically when you have a connection.</Text> : null}
      {rejected.map((i) => (
        <View key={i.sessionId} style={{ gap: 4 }}>
          <Text style={{ color: colors.red, fontWeight: "700" }}>A saved workout couldn't be sent</Text>
          <Text style={{ color: colors.muted }}>{i.lastError}</Text>
          <Pressable
            onPress={() =>
              Alert.alert("Discard this workout?", "Its logged sets will be deleted from your phone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: async () => { await discardPendingLog(i.sessionId); setItems(await listPendingLogs()); } },
              ])
            }
          >
            <Text style={{ color: colors.red, fontWeight: "700" }}>Discard</Text>
          </Pressable>
        </View>
      ))}
      <Pressable disabled={busy} onPress={sync}>
        <Text style={{ color: colors.brand, fontWeight: "700" }}>{busy ? "Sending..." : "Try again now"}</Text>
      </Pressable>
    </View>
  );
}
