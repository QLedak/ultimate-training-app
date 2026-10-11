import React, { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Caps, Choice, Chip, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { CHARACTER_OPTIONS, INJURY_LOCATIONS, injuryLabel } from "../lib/injuries";
import { colors } from "../theme";

type ActiveInjury = {
  location: string;
  note?: string;
  pending_resolution?: { resolved_at: string; after_phase_id: string };
};

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt } as const;

export default function InjuriesScreen() {
  const { athlete } = useAuth();
  const [injuries, setInjuries] = useState<ActiveInjury[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newLoc, setNewLoc] = useState("");
  const [newChar, setNewChar] = useState("");
  const [newNote, setNewNote] = useState("");

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<{ current_active_injuries: ActiveInjury[] }>(`/api/athletes/${athlete.id}/injury-status`);
      setInjuries(d.current_active_injuries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);
  useEffect(() => { load(); }, [load]);

  async function post(key: string, body: Record<string, unknown>, after?: () => void) {
    if (!athlete) return;
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/injury-status`, { method: "POST", body });
      setMessage(d.message ?? "Saved.");
      after?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!injuries && !error) return <Screen><Loading /></Screen>;
  const active = injuries ?? [];

  return (
    <Screen>
      <H1>Injury status</H1>
      <P muted>Keep this up to date and your program adjusts on its own. No more staying on isometrics after you've healed.</P>
      <ErrorText>{error}</ErrorText>
      {busy ? <P small muted>Updating your plan. This can take up to a minute.</P> : null}
      {message ? (
        <Card tone="green">
          <P>{message}</P>
        </Card>
      ) : null}

      {active.length > 0 ? <Caps>Currently active</Caps> : null}
      {active.map((inj) => (
        <Card key={inj.location}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{injuryLabel(inj.location)}</Text>
          {inj.note ? <P small muted style={{ fontStyle: "italic" }}>Last note: "{inj.note}"</P> : null}
          {inj.pending_resolution ? (
            <Card tone="green">
              <P small>Marked as better. This phase finishes as planned, then you move to strengthening work in the next one. Tap "Still bothering me" if that changes.</P>
            </Card>
          ) : null}
          <TextInput
            placeholder="Optional note (how it's feeling)"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            value={notes[inj.location] ?? ""}
            onChangeText={(v) => setNotes((n) => ({ ...n, [inj.location]: v }))}
            style={inputStyle}
          />
          <View style={{ gap: 8 }}>
            {!inj.pending_resolution ? (
              <Button
                title="It's better. Not bothering me"
                loading={busy === inj.location}
                disabled={busy != null}
                onPress={() => post(inj.location, { location: inj.location, status: "resolved", note: notes[inj.location] || undefined }, () => setNotes((n) => ({ ...n, [inj.location]: "" })))}
              />
            ) : null}
            <Button
              title="Still bothering me"
              variant="secondary"
              disabled={busy != null}
              onPress={() => post(inj.location, { location: inj.location, status: "still_active", note: notes[inj.location] || undefined }, () => setNotes((n) => ({ ...n, [inj.location]: "" })))}
            />
          </View>
        </Card>
      ))}

      <Caps>Report a new injury</Caps>
      <Card>
        <P small muted>Where?</P>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {INJURY_LOCATIONS.filter((l) => !active.some((i) => i.location === l)).map((l) => (
            <Chip key={l} label={injuryLabel(l)} selected={newLoc === l} onPress={() => setNewLoc(newLoc === l ? "" : l)} />
          ))}
        </View>
        <P small muted>How does it feel? (optional)</P>
        <View style={{ gap: 8 }}>
          {CHARACTER_OPTIONS.map((c) => (
            <Choice key={c.value} label={c.label} selected={newChar === c.value} onPress={() => setNewChar(newChar === c.value ? "" : c.value)} />
          ))}
        </View>
        <TextInput
          placeholder="Optional note"
          placeholderTextColor={colors.faint}
          keyboardAppearance="dark"
          value={newNote}
          onChangeText={setNewNote}
          style={inputStyle}
        />
        <Button
          title="Report injury"
          loading={busy === "new"}
          disabled={!newLoc || busy != null}
          onPress={() =>
            post("new", { action: "report_new", location: newLoc, character: newChar || undefined, note: newNote || undefined }, () => {
              setNewLoc(""); setNewChar(""); setNewNote("");
            })
          }
        />
      </Card>
    </Screen>
  );
}
