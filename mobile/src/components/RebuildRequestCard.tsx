import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { Button, Card, Caps, Choice, ErrorText, P } from "./ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { colors } from "../theme";

const REASONS = [
  { value: "schedule_change", label: "My schedule changed" },
  { value: "injury_pain", label: "I'm dealing with pain or an injury" },
  { value: "other", label: "Something else" },
];

/** Ask for an updated plan. Goes to the coach for review before anything replaces the current plan. */
export function RebuildRequestCard() {
  const { athlete } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!athlete) return;
    setError(null);
    if (!reason) return setError("Please choose a reason.");
    if (!detail.trim()) return setError("Tell your coach a bit more about what changed.");
    setBusy(true);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/request-rebuild`, {
        method: "POST",
        body: { reason_category: reason, detail: detail.trim() },
      });
      setMessage(d.message ?? "Sent. Your coach will review it.");
      setOpen(false);
      setReason("");
      setDetail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Caps>Something changed?</Caps>
      {message ? <Card tone="green"><P>{message}</P></Card> : null}
      {!open ? (
        <Button title="Request a plan update" variant="secondary" onPress={() => { setOpen(true); setMessage(null); }} />
      ) : (
        <Card>
          <P>What's going on?</P>
          <View style={{ gap: 8 }}>
            {REASONS.map((r) => <Choice key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}
          </View>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="What changed, what hurts, etc."
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            multiline
            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt, minHeight: 90, textAlignVertical: "top" }}
          />
          <ErrorText>{error}</ErrorText>
          {busy ? <P small muted>Sending. This can take up to a minute while your plan is rebuilt.</P> : null}
          <Button title="Send to my coach" onPress={send} loading={busy} />
          <Button title="Cancel" variant="link" onPress={() => setOpen(false)} style={{ alignSelf: "flex-start" }} />
        </Card>
      )}
    </View>
  );
}
