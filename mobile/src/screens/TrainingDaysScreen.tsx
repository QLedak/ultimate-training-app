import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Caps, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { colors } from "../theme";

type Pending = { id: string; current_days_per_week: number; requested_days_per_week: number; note: string | null };
const DAY_OPTIONS = [2, 3, 4, 5, 6];

export default function TrainingDaysScreen() {
  const { athlete } = useAuth();
  const [current, setCurrent] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wanted, setWanted] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<{ current_days_per_week: number | null; pending_request: Pending | null }>(`/api/athletes/${athlete.id}/days-change-request`);
      setCurrent(d.current_days_per_week);
      setPending(d.pending_request);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);
  useEffect(() => { load(); }, [load]);

  async function request() {
    if (!athlete || wanted == null) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/days-change-request`, {
        method: "POST",
        body: { requested_days_per_week: wanted, note: note.trim() || undefined },
      });
      setMessage(d.message ?? "Sent to your coach.");
      setWanted(null);
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!athlete || !pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/athletes/${athlete.id}/days-change-request/${pending.id}`, { method: "DELETE" });
      setMessage("Request cancelled.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !error) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <H1>Training days</H1>
      <P muted>You're training {current ?? "?"} days a week. A change goes to your coach, and once approved your plan updates automatically, even mid-phase.</P>
      <ErrorText>{error}</ErrorText>
      {message ? <Card tone="green"><P>{message}</P></Card> : null}

      {pending ? (
        <Card tone="amber">
          <Caps color={colors.amber}>Waiting for your coach</Caps>
          <P>{pending.current_days_per_week} to {pending.requested_days_per_week} days a week{pending.note ? `. "${pending.note}"` : ""}</P>
          <Button title="Cancel request" variant="secondary" onPress={cancel} loading={busy} />
        </Card>
      ) : (
        <>
          <Caps>Request a change</Caps>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {DAY_OPTIONS.map((d) => {
              const disabled = d === current;
              const selected = wanted === d;
              return (
                <Pressable
                  key={d}
                  disabled={disabled}
                  onPress={() => setWanted(d)}
                  style={{ width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, opacity: disabled ? 0.35 : 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandBg : colors.card }}
                >
                  <Text style={{ color: selected ? colors.brand : colors.text, fontSize: 20, fontWeight: "800" }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note for your coach"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt }}
          />
          <Button title="Request change" onPress={request} loading={busy} disabled={wanted == null} />
        </>
      )}
    </Screen>
  );
}
