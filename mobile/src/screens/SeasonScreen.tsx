import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Caps, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { DateField } from "../components/DateField";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import {
  DAYS_OF_WEEK, blankCommitment, blankTournament, commitmentsPayload, isGameLabel, normalizeCommitments, normalizeTournaments,
  setPriorityTournament, validateScheduleForm, type Commitment, type Tournament,
} from "../lib/schedule.core";
import { colors } from "../theme";

type ScheduleResponse = {
  season_over: boolean;
  season_start: string | null;
  season_end: string | null;
  recurring_commitments: unknown;
  tournament_weekends: unknown;
};

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt } as const;

export default function SeasonScreen() {
  const { athlete } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [seasonOver, setSeasonOver] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<ScheduleResponse>(`/api/athletes/${athlete.id}/schedule`);
      setStart(d.season_start ?? "");
      setEnd(d.season_end ?? "");
      setTournaments(normalizeTournaments(d.tournament_weekends));
      setCommitments(normalizeCommitments(d.recurring_commitments));
      setSeasonOver(!!d.season_over);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);
  useEffect(() => { load(); }, [load]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setMessage(null); };

  const updTournament = (i: number, patch: Partial<Tournament>) => edit(setTournaments)(tournaments.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const updCommitment = (i: number, patch: Partial<Commitment>) => edit(setCommitments)(commitments.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function save() {
    if (!athlete) return;
    setError(null);
    setMessage(null);
    const problem = validateScheduleForm({ season_start: start, season_end: end, tournaments, commitments });
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/schedule`, {
        method: "PATCH",
        body: {
          season_start: start,
          season_end: end,
          tournament_weekends: tournaments,
          recurring_commitments: commitmentsPayload(commitments),
        },
      });
      setMessage(d.message ?? "Saved.");
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded && !error) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <H1>Season & game days</H1>
      <P muted>Keep your season dates, tournaments and weekly game or league nights current so your program plans around them.</P>
      {seasonOver ? (
        <Card tone="amber">
          <P>Your last season has ended. Planning your next season is done on the website under "Plan next season". Your coach builds your next plan from it.</P>
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {message ? <Card tone="green"><P>{message}</P></Card> : null}

      {loaded && !seasonOver ? (
        <>
          <Caps>Season dates</Caps>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <DateField label="Starts" value={start} onChange={edit(setStart)} />
            <DateField label="Ends" value={end} onChange={edit(setEnd)} />
          </View>

          <Caps>Game and league nights (every week)</Caps>
          <P small muted>Name game nights with "league" or "game" so your program treats that day as a game day. Add a date range if it only runs part of the season.</P>
          {commitments.map((c, i) => (
            <Card key={i}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {DAYS_OF_WEEK.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => updCommitment(i, { day_of_week: d })}
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: c.day_of_week === d ? colors.brand : colors.line, backgroundColor: c.day_of_week === d ? colors.brandBg : colors.cardAlt }}
                  >
                    <Text style={{ color: c.day_of_week === d ? colors.brand : colors.text, fontWeight: "700", fontSize: 13 }}>{d.slice(0, 3)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={c.label}
                onChangeText={(v) => updCommitment(i, { label: v })}
                placeholder="Label (League game, Team practice)"
                placeholderTextColor={colors.faint}
                keyboardAppearance="dark"
                style={inputStyle}
              />
              {c.label && !isGameLabel(c.label) ? <P small muted>This will count as a regular commitment, not a game day.</P> : null}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <DateField mode="time" label="Time (optional)" value={c.time} onChange={(v) => updCommitment(i, { time: v })} clearable />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <DateField label="Runs from (optional)" value={c.start_date} onChange={(v) => updCommitment(i, { start_date: v })} clearable />
                <DateField label="Until (optional)" value={c.end_date} onChange={(v) => updCommitment(i, { end_date: v })} clearable />
              </View>
              <Button title="Remove" variant="link" onPress={() => edit(setCommitments)(commitments.filter((_, idx) => idx !== i))} style={{ alignSelf: "flex-start" }} />
            </Card>
          ))}
          <Button title="+ Add a game or league night" variant="secondary" onPress={() => edit(setCommitments)([...commitments, blankCommitment()])} />

          <Caps>Tournaments and league weekends</Caps>
          <P small muted>Mark the one event you most want to peak for. Only one can be the most important.</P>
          {tournaments.map((t, i) => (
            <Card key={i} tone={t.is_priority ? "brand" : undefined}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <DateField label="First day" value={t.start_date} onChange={(v) => updTournament(i, { start_date: v, end_date: t.end_date && t.end_date < v ? v : t.end_date })} />
                <DateField label="Last day" value={t.end_date} onChange={(v) => updTournament(i, { end_date: v })} />
              </View>
              <TextInput
                value={t.label}
                onChangeText={(v) => updTournament(i, { label: v })}
                placeholder="Name (Regionals, Nationals)"
                placeholderTextColor={colors.faint}
                keyboardAppearance="dark"
                style={inputStyle}
              />
              <Pressable onPress={() => edit(setTournaments)(setPriorityTournament(tournaments, i))} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: t.is_priority ? colors.brand : "transparent" }} />
                <P small>Most important. Peak for this one</P>
              </Pressable>
              <Button title="Remove" variant="link" onPress={() => edit(setTournaments)(tournaments.filter((_, idx) => idx !== i))} style={{ alignSelf: "flex-start" }} />
            </Card>
          ))}
          <Button title="+ Add a tournament" variant="secondary" onPress={() => edit(setTournaments)([...tournaments, blankTournament()])} />

          <Button title="Save schedule" onPress={save} loading={saving} disabled={!dirty} />
        </>
      ) : null}
    </Screen>
  );
}
