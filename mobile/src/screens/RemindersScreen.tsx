import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Button, Card, Caps, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { clampTime, DEFAULT_REMINDERS, formatReminderTime, type ReminderSettings } from "../lib/reminders.core";
import { ensurePermission, loadReminderSettings, saveReminderSettings, sendTestReminder, syncReminders } from "../lib/reminders";
import { colors } from "../theme";

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const btn = { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" } as const;
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Caps>{label}</Caps>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onMinus} style={btn}><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>-</Text></Pressable>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", minWidth: 50, textAlign: "center", fontVariant: ["tabular-nums"] }}>{value}</Text>
        <Pressable onPress={onPlus} style={btn}><Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { athlete } = useAuth();
  const [s, setS] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => { loadReminderSettings().then(setS); }, []);

  async function apply(next: ReminderSettings) {
    setS(next);
    setError(null);
    setNote(null);
    await saveReminderSettings(next);
    if (athlete) {
      const n = await syncReminders(athlete.id);
      setNote(next.enabled ? (n > 0 ? `${n} upcoming workout${n === 1 ? "" : "s"} will remind you.` : "No upcoming workouts to remind you about yet.") : "Reminders are off.");
    }
  }

  async function toggle() {
    if (!s) return;
    if (!s.enabled) {
      const ok = await ensurePermission();
      if (!ok) {
        setBlocked(true);
        setError("Notifications are turned off for this app. Turn them on in your phone's settings, then try again.");
        return;
      }
      setBlocked(false);
    }
    await apply({ ...s, enabled: !s.enabled });
  }

  if (!s) return <Screen><Loading /></Screen>;

  const setTime = (hour: number, minute: number) => apply({ ...s, ...clampTime(((hour % 24) + 24) % 24, ((minute % 60) + 60) % 60) });

  return (
    <Screen>
      <H1>Workout reminders</H1>
      <P muted>Get a nudge on each day you have a workout scheduled. Days you've already logged are skipped.</P>
      <ErrorText>{error}</ErrorText>
      {blocked ? <Button title="Open phone settings" variant="secondary" onPress={() => Linking.openSettings()} /> : null}

      <Card tone={s.enabled ? "green" : undefined}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Remind me to train</Text>
            <P small muted>{s.enabled ? `Daily at ${formatReminderTime(s.hour, s.minute)}` : "Off"}</P>
          </View>
          <Button title={s.enabled ? "Turn off" : "Turn on"} variant={s.enabled ? "secondary" : "primary"} onPress={toggle} />
        </View>
      </Card>

      {s.enabled ? (
        <Card>
          <Caps>Reminder time</Caps>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 8 }}>
            <Stepper
              label="Hour"
              value={String(s.hour % 12 === 0 ? 12 : s.hour % 12)}
              onMinus={() => setTime(s.hour - 1, s.minute)}
              onPlus={() => setTime(s.hour + 1, s.minute)}
            />
            <Stepper
              label="Minute"
              value={String(s.minute).padStart(2, "0")}
              onMinus={() => setTime(s.hour, s.minute - 15)}
              onPlus={() => setTime(s.hour, s.minute + 15)}
            />
            <View style={{ alignItems: "center", gap: 6 }}>
              <Caps>AM / PM</Caps>
              <Button title={s.hour < 12 ? "AM" : "PM"} variant="dark" onPress={() => setTime((s.hour + 12) % 24, s.minute)} />
            </View>
          </View>
          <P small muted>Reminder: {formatReminderTime(s.hour, s.minute)}</P>
          <Button title="Send me a test in 5 seconds" variant="secondary" onPress={() => sendTestReminder()} />
        </Card>
      ) : null}

      {note ? <P small muted>{note}</P> : null}
      <P small muted>Reminders are refreshed whenever you open the app, so a rescheduled or logged workout updates them.</P>
    </Screen>
  );
}
