import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Caps, ErrorText, Field, H1, Loading, P, Screen } from "../components/ui";
import { SeasonFields } from "../components/SeasonFields";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { todayStr } from "../lib/dates";
import {
  DAYS_OPTIONS, buildNextSeasonBody, formFromState, isLocked, nextSeasonProblem, plannedStatus, seasonIntro, type NextSeasonForm, type SeasonState,
} from "../lib/nextSeason.core";
import { colors } from "../theme";

/** Year-over-year planning: enter next season's dates and send them to the coach. */
export default function NextSeasonScreen({ navigation }: any) {
  const { athlete } = useAuth();
  const [state, setState] = useState<SeasonState | null>(null);
  const [form, setForm] = useState<NextSeasonForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<SeasonState>(`/api/athletes/${athlete.id}/next-season`);
      setState(d);
      setForm(formFromState(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);

  // Load once (not on every focus) so edits survive a trip to the Equipment or Injuries screen.
  useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<NextSeasonForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function submit() {
    if (!athlete || !form) return;
    setError(null);
    setMessage(null);
    const problem = nextSeasonProblem(form, todayStr());
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/next-season`, { method: "POST", body: buildNextSeasonBody(form) });
      setMessage(d.message ?? "Sent to your coach.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removePlanned() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/athletes/${athlete.id}/next-season`, { method: "DELETE" });
      setMessage("Removed. You'll keep rolling through off-season training blocks until you enter new dates.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!state || !form) return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Loading />}</Screen>;

  if (state.stage === "no_plan") {
    return (
      <Screen>
        <H1>Plan next season</H1>
        <Card tone="amber"><P>You don't have a season plan yet. Once your coach has built your first plan, you can plan the next season here.</P></Card>
      </Screen>
    );
  }

  const planned = state.planned_season;
  const locked = isLocked(planned);
  const status = plannedStatus(planned);

  return (
    <Screen>
      <H1>Plan next season</H1>
      <P muted>{seasonIntro(state.stage)}</P>
      <ErrorText>{error}</ErrorText>
      {message ? <Card tone="green"><P>{message}</P></Card> : null}
      {status ? <Card tone="brand"><P>{status}</P></Card> : null}

      {!locked ? (
        <>
          <SeasonFields
            start={form.start}
            end={form.end}
            tournaments={form.tournaments}
            commitments={form.commitments}
            onStart={(v) => patch({ start: v })}
            onEnd={(v) => patch({ end: v })}
            onTournaments={(v) => patch({ tournaments: v })}
            onCommitments={(v) => patch({ commitments: v })}
          />

          <Card>
            <Caps>Anything changed?</Caps>
            <P small muted>Leave these alone if nothing changed. We only update what you edit.</P>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Training days per week</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DAYS_OPTIONS.map((d) => {
                const on = form.days === d;
                return (
                  <Pressable key={d} onPress={() => patch({ days: d })} style={{ width: 46, height: 46, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: on ? colors.brand : colors.line, backgroundColor: on ? colors.brandBg : colors.cardAlt }}>
                    <Text style={{ color: on ? colors.brand : colors.text, fontWeight: "800", fontSize: 16 }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Goals" value={form.goals} onChangeText={(v) => patch({ goals: v })} multiline style={{ minHeight: 70, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Equipment changed?" variant="secondary" onPress={() => navigation.navigate("Equipment")} style={{ flex: 1 }} />
              <Button title="Injury status?" variant="secondary" onPress={() => navigation.navigate("Injuries")} style={{ flex: 1 }} />
            </View>
          </Card>

          <Button title={planned ? "Update my dates" : "Send to my coach"} onPress={submit} loading={saving} disabled={!form.start || !form.end} />
          {planned ? <Button title="Remove these dates" variant="link" onPress={removePlanned} disabled={saving} style={{ alignSelf: "center" }} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
