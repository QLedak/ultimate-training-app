import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, ErrorText, H1, H2, Loading, P, Screen } from "../components/ui";
import { Guided } from "../workout/Guided";
import { clearProgress, loadProgress } from "../workout/storage";
import { api } from "../lib/api";
import { addDays, prettyDate, todayStr } from "../lib/dates";
import { colors } from "../theme";
import type { SessionDetail, SubmitPayload } from "../types";

const SKIP_REASONS = [
  { value: "pain_injury", label: "Pain / injury" },
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "illness", label: "Illness" },
  { value: "no_equipment", label: "No equipment available" },
  { value: "other", label: "Other" },
];

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.cardAlt } as const;

export default function SessionScreen({ route, navigation }: any) {
  const sessionId: string = route.params.sessionId;
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"overview" | "guided">("overview");
  const [hasProgress, setHasProgress] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [panel, setPanel] = useState<null | "reschedule" | "skip">(null);
  const [newDate, setNewDate] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [skipOther, setSkipOther] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelBusy, setPanelBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<SessionDetail>(`/api/sessions/${sessionId}`);
      setData(d);
      setNewDate(d.session.date);
      setHasProgress(!!(await loadProgress(sessionId)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function submitLog(payload: SubmitPayload) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api(`/api/sessions/${sessionId}/log`, { method: "POST", body: payload });
      await clearProgress(sessionId);
      setSaved(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function reschedule() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return setPanelError("Use the format YYYY-MM-DD.");
    setPanelBusy(true);
    setPanelError(null);
    try {
      await api(`/api/sessions/${sessionId}/reschedule`, { method: "PATCH", body: { date: newDate } });
      setPanel(null);
      await load();
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelBusy(false);
    }
  }

  async function skipSession() {
    if (!skipReason) return setPanelError("Please choose a reason.");
    if (skipReason === "other" && !skipOther.trim()) return setPanelError("Please describe the reason.");
    setPanelBusy(true);
    setPanelError(null);
    try {
      await api(`/api/sessions/${sessionId}/log`, {
        method: "POST",
        body: { status: "skipped", skip_reason: skipReason, skip_reason_other_text: skipOther || null, exercises: [] } satisfies SubmitPayload,
      });
      await clearProgress(sessionId);
      setSaved(true);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelBusy(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <ErrorText>{loadError}</ErrorText>
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  if (!data) return <Screen><Loading /></Screen>;

  if (saved) {
    return (
      <Screen>
        <View style={{ paddingTop: 60, gap: 12 }}>
          <H1>Logged.</H1>
          <P muted>Nice work. On to the next one.</P>
          <Button title="Done" onPress={() => navigation.popToTop()} />
        </View>
      </Screen>
    );
  }

  const { session, exercises, session_log } = data;

  if (mode === "guided") {
    return (
      <Guided
        sessionId={sessionId}
        session={session}
        exercises={exercises}
        submitting={submitting}
        submitError={submitError}
        onExit={() => { setMode("overview"); load(); }}
        onFinish={(exs, status) => submitLog({ status, exercises: exs })}
      />
    );
  }

  const loggedCount = exercises.filter((e) => e.logged).length;
  const warmups = exercises.reduce((n, e) => n + (e.warmup?.length ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center" }}>{session.day_label}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Workout Preview</Text>
          <Text style={{ color: colors.faint, fontSize: 13, marginTop: 4 }}>
            {prettyDate(session.date)} · Week {session.week_number}
            {session.week_type !== "build" ? ` · ${session.week_type} week` : ""}
          </Text>
        </View>

        {session_log ? (
          <Card tone={session_log.status === "completed" ? "green" : "amber"}>
            <P>
              {session_log.status === "completed" ? "Logged - completed." : session_log.status === "partially_completed" ? "Logged - partially completed." : "Skipped."}
              {loggedCount ? ` ${loggedCount} of ${exercises.length} exercises have results.` : ""}
            </P>
          </Card>
        ) : null}

        {warmups > 0 ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🔥</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Warm-up sets included</Text>
          </Card>
        ) : null}

        {exercises.map((e) => (
          <Card key={e.exercise_id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, flexShrink: 1 }}>
                {e.circuit_label ? `${e.circuit_label}. ` : ""}
                {e.exercise_name}
              </Text>
              {e.logged ? <Text style={{ color: colors.green, fontWeight: "800" }}>✓</Text> : null}
            </View>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {e.prescribed_target || "-"}
              {e.rest ? ` · rest ${e.rest}` : ""}
            </Text>
          </Card>
        ))}

        <View style={{ flexDirection: "row", gap: 20, marginTop: 4, justifyContent: "center" }}>
          <Button title="Reschedule" variant="link" onPress={() => { setPanel(panel === "reschedule" ? null : "reschedule"); setPanelError(null); }} />
          {!session_log ? (
            <Button title="Skip this workout" variant="link" onPress={() => { setPanel(panel === "skip" ? null : "skip"); setPanelError(null); }} />
          ) : null}
        </View>

        {panel === "reschedule" ? (
          <Card>
            <H2>Move to another day</H2>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Button title="−1" variant="secondary" onPress={() => setNewDate((d) => addDays(d || session.date, -1))} style={{ minWidth: 56 }} />
              <TextInput value={newDate} onChangeText={setNewDate} autoCapitalize="none" keyboardAppearance="dark" style={[inputStyle, { flex: 1, textAlign: "center" }]} />
              <Button title="+1" variant="secondary" onPress={() => setNewDate((d) => addDays(d || session.date, 1))} style={{ minWidth: 56 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Today" variant="secondary" onPress={() => setNewDate(todayStr())} style={{ flex: 1 }} />
              <Button title="Tomorrow" variant="secondary" onPress={() => setNewDate(addDays(todayStr(), 1))} style={{ flex: 1 }} />
            </View>
            <P small muted>{/^\d{4}-\d{2}-\d{2}$/.test(newDate) ? prettyDate(newDate) : "Format: YYYY-MM-DD"}</P>
            <ErrorText>{panelError}</ErrorText>
            <Button title="Save new date" onPress={reschedule} loading={panelBusy} />
          </Card>
        ) : null}

        {panel === "skip" ? (
          <Card>
            <H2>Why are you skipping?</H2>
            {SKIP_REASONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setSkipReason(r.value)}
                style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: skipReason === r.value ? colors.brand : colors.line, backgroundColor: skipReason === r.value ? colors.brandBg : colors.cardAlt }}
              >
                <Text style={{ fontSize: 15, color: colors.text }}>{r.label}</Text>
              </Pressable>
            ))}
            {skipReason === "other" ? (
              <TextInput placeholder="Tell us more" placeholderTextColor={colors.faint} keyboardAppearance="dark" value={skipOther} onChangeText={setSkipOther} style={inputStyle} />
            ) : null}
            <ErrorText>{panelError}</ErrorText>
            <Button title="Mark as skipped" variant="dark" onPress={skipSession} loading={panelBusy} />
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card }}>
        <Button
          title={hasProgress ? "Resume workout" : session_log ? "Edit / re-log workout" : "Start workout"}
          onPress={() => setMode("guided")}
        />
      </View>
    </SafeAreaView>
  );
}
