import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Caps, P } from "./ui";
import { DateField } from "./DateField";
import {
  DAYS_OF_WEEK, blankCommitment, blankTournament, isGameLabel, setPriorityTournament, type Commitment, type Tournament,
} from "../lib/schedule.core";
import { colors } from "../theme";

const inputStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.cardAlt } as const;

type Props = {
  start: string;
  end: string;
  tournaments: Tournament[];
  commitments: Commitment[];
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onTournaments: (v: Tournament[]) => void;
  onCommitments: (v: Commitment[]) => void;
};

/** Season dates, weekly game nights and tournaments. Shared by the Season screen and the intake wizard. */
export function SeasonFields({ start, end, tournaments, commitments, onStart, onEnd, onTournaments, onCommitments }: Props) {
  const updTournament = (i: number, patch: Partial<Tournament>) => onTournaments(tournaments.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const updCommitment = (i: number, patch: Partial<Commitment>) => onCommitments(commitments.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <>
          <Caps>Season dates</Caps>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <DateField label="Starts" value={start} onChange={onStart} />
            <DateField label="Ends" value={end} onChange={onEnd} />
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
              <Button title="Remove" variant="link" onPress={() => onCommitments(commitments.filter((_, idx) => idx !== i))} style={{ alignSelf: "flex-start" }} />
            </Card>
          ))}
          <Button title="+ Add a game or league night" variant="secondary" onPress={() => onCommitments([...commitments, blankCommitment()])} />

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
              <Pressable onPress={() => onTournaments(setPriorityTournament(tournaments, i))} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: t.is_priority ? colors.brand : "transparent" }} />
                <P small>Most important. Peak for this one</P>
              </Pressable>
              <Button title="Remove" variant="link" onPress={() => onTournaments(tournaments.filter((_, idx) => idx !== i))} style={{ alignSelf: "flex-start" }} />
            </Card>
          ))}
          <Button title="+ Add a tournament" variant="secondary" onPress={() => onTournaments([...tournaments, blankTournament()])} />

    </>
  );
}
