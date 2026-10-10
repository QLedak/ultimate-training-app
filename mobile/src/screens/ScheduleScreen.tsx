import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, ErrorText, H2, Loading, P } from "../components/ui";
import { Draggable, DragProvider, useDrag, useDropZone } from "../components/DragDrop";
import { SessionCard, statusColor, statusLabel } from "./HomeScreen";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { addDays, addMonthsStr, dowShort, monthGridWeeks, monthTitle, prettyDate, startOfMonthStr, startOfWeekStr, todayStr } from "../lib/dates";
import { workoutIcon } from "../lib/workoutIcons";
import { colors } from "../theme";
import type { SessionSummary } from "../types";

type Mode = "week" | "month";

export default function ScheduleScreen({ navigation }: any) {
  const { athlete } = useAuth();
  const today = todayStr();
  const [mode, setMode] = useState<Mode>("week");
  const [weekStart, setWeekStart] = useState(startOfWeekStr(today));
  const [monthStart, setMonthStart] = useState(startOfMonthStr(today));
  const [selected, setSelected] = useState(today);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionsRef = useRef<SessionSummary[] | null>(null);
  sessionsRef.current = sessions;

  const weeks = monthGridWeeks(monthStart);
  const rangeStart = mode === "week" ? weekStart : weeks[0][0];
  const rangeEnd = mode === "week" ? addDays(weekStart, 6) : weeks[weeks.length - 1][6];

  const load = useCallback(async () => {
    if (!athlete) return;
    setError(null);
    try {
      const d = await api<{ sessions: SessionSummary[] }>(`/api/athletes/${athlete.id}/sessions?start=${rangeStart}&end=${rangeEnd}`);
      setSessions(d.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete, rangeStart, rangeEnd]);

  useEffect(() => { setSessions(null); }, [rangeStart, rangeEnd]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Same endpoint and rules as the website: max 6-day shift, can't move a
  // logged workout, must stay inside the phase. A refused move shows the reason.
  const handleDrop = useCallback(
    async (sessionId: string, date: string) => {
      const before = sessionsRef.current;
      const s = before?.find((x) => x.id === sessionId);
      if (!s || s.date === date) return;
      setError(null);
      setNotice(null);
      setSessions((prev) => prev?.map((x) => (x.id === sessionId ? { ...x, date } : x)) ?? prev);
      try {
        await api(`/api/sessions/${sessionId}/reschedule`, { method: "PATCH", body: { date } });
        setNotice(`Moved ${s.day_label} to ${prettyDate(date)}.`);
      } catch (e) {
        setSessions(before);
        setError(e instanceof Error ? e.message : String(e));
      }
      load();
    },
    [load]
  );

  return (
    <DragProvider onDrop={handleDrop}>
      <ScheduleBody
        mode={mode} setMode={setMode}
        weekStart={weekStart} setWeekStart={setWeekStart}
        monthStart={monthStart} setMonthStart={setMonthStart}
        weeks={weeks}
        selected={selected} setSelected={setSelected}
        sessions={sessions} error={error} notice={notice} reload={load}
        open={(id: string) => navigation.navigate("Session", { sessionId: id })}
      />
    </DragProvider>
  );
}

function ScheduleBody(p: {
  mode: Mode; setMode: (m: Mode) => void;
  weekStart: string; setWeekStart: (s: string) => void;
  monthStart: string; setMonthStart: (s: string) => void;
  weeks: string[][];
  selected: string; setSelected: (s: string) => void;
  sessions: SessionSummary[] | null; error: string | null; notice: string | null; reload: () => Promise<void>;
  open: (id: string) => void;
}) {
  const { dragging } = useDrag();
  const today = todayStr();
  const [refreshing, setRefreshing] = useState(false);
  const byDate = (d: string) => (p.sessions ?? []).filter((s) => s.date === d);

  const prev = () => (p.mode === "week" ? p.setWeekStart(addDays(p.weekStart, -7)) : p.setMonthStart(addMonthsStr(p.monthStart, -1)));
  const next = () => (p.mode === "week" ? p.setWeekStart(addDays(p.weekStart, 7)) : p.setMonthStart(addMonthsStr(p.monthStart, 1)));
  const title = p.mode === "week" ? `${prettyDate(p.weekStart)} – ${prettyDate(addDays(p.weekStart, 6))}` : monthTitle(p.monthStart);

  return (
    <ScrollView
      scrollEnabled={!dragging}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor={colors.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await p.reload(); setRefreshing(false); }} />}
    >
      <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.line }}>
        {(["week", "month"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => p.setMode(m)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: p.mode === m ? colors.brand : "transparent" }}>
            <Text style={{ fontWeight: "800", color: p.mode === m ? colors.onBrand : colors.muted }}>{m === "week" ? "Week" : "Month"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable hitSlop={12} onPress={prev}><Text style={{ color: colors.brand, fontSize: 28 }}>‹</Text></Pressable>
        <View style={{ alignItems: "center" }}>
          <H2>{title}</H2>
          <Button
            title="Today"
            variant="link"
            onPress={() => { p.setWeekStart(startOfWeekStr(today)); p.setMonthStart(startOfMonthStr(today)); p.setSelected(today); }}
          />
        </View>
        <Pressable hitSlop={12} onPress={next}><Text style={{ color: colors.brand, fontSize: 28 }}>›</Text></Pressable>
      </View>

      <ErrorText>{p.error}</ErrorText>
      {p.notice ? <Card tone="green" style={{ paddingVertical: 8 }}><P small>{p.notice}</P></Card> : null}
      {p.sessions === null && !p.error ? <Loading /> : null}

      {p.sessions && p.mode === "week" ? (
        <View style={{ gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => addDays(p.weekStart, i)).map((d) => (
            <WeekRow key={d} date={d} list={byDate(d)} open={p.open} />
          ))}
        </View>
      ) : null}

      {p.sessions && p.mode === "month" ? (
        <>
          <View style={{ flexDirection: "row" }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
              <Text key={i} style={{ flex: 1, textAlign: "center", color: colors.faint, fontSize: 11, fontWeight: "700" }}>{l}</Text>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            {p.weeks.map((w) => (
              <View key={w[0]} style={{ flexDirection: "row", gap: 4 }}>
                {w.map((d) => (
                  <MonthCell
                    key={d}
                    date={d}
                    inMonth={d.slice(0, 7) === p.monthStart.slice(0, 7)}
                    list={byDate(d)}
                    selected={p.selected === d}
                    onSelect={() => p.setSelected(d)}
                  />
                ))}
              </View>
            ))}
          </View>
          <H2>{p.selected === today ? "Today" : prettyDate(p.selected)}</H2>
          {byDate(p.selected).length === 0 ? <Card><P muted>Nothing scheduled.</P></Card> : null}
          {byDate(p.selected).map((s) => <SessionCard key={s.id} s={s} onPress={() => p.open(s.id)} />)}
        </>
      ) : null}

      <P small muted style={{ marginTop: 4 }}>
        Press and hold a workout, then drag it onto another day to move it. Logged workouts can't be moved.
      </P>
    </ScrollView>
  );
}

function WeekRow({ date, list, open }: { date: string; list: SessionSummary[]; open: (id: string) => void }) {
  const { ref, isHover } = useDropZone(date);
  const today = todayStr();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ width: 46, alignItems: "center", paddingTop: 10 }}>
        <Text style={{ fontSize: 12, color: date === today ? colors.brand : colors.muted, fontWeight: "700" }}>{dowShort(date)}</Text>
        <Text style={{ fontSize: 18, color: date === today ? colors.brand : colors.text, fontWeight: "800" }}>{Number(date.slice(8))}</Text>
      </View>
      <View
        ref={ref}
        collapsable={false}
        style={{
          flex: 1, gap: 6, minHeight: 56, padding: 4, borderRadius: 14, borderWidth: 1,
          borderColor: isHover ? colors.brand : "transparent", backgroundColor: isHover ? colors.brandBg : "transparent",
        }}
      >
        {list.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 12, minHeight: 48, borderRadius: 12, backgroundColor: colors.card }}>
            <Text style={{ color: colors.faint, fontSize: 13 }}>Rest</Text>
          </View>
        ) : (
          list.map((s) => {
            const { icon } = workoutIcon(s.day_label);
            return (
              <Draggable key={s.id} item={{ id: s.id, label: s.day_label, icon }} enabled={!s.status} onPress={() => open(s.id)}>
                <Card tone={date === today && !s.status ? "brand" : undefined} style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 26 }}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, flexShrink: 1 }}>{s.day_label}</Text>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: statusColor(s.status, s.date) }}>{statusLabel(s.status, s.date)}</Text>
                    </View>
                    <P small muted>Week {s.week_number} · {s.exercise_count} exercises{s.week_type !== "build" ? ` · ${s.week_type}` : ""}</P>
                  </View>
                </Card>
              </Draggable>
            );
          })
        )}
      </View>
    </View>
  );
}

function MonthCell({ date, inMonth, list, selected, onSelect }: { date: string; inMonth: boolean; list: SessionSummary[]; selected: boolean; onSelect: () => void }) {
  const { ref, isHover } = useDropZone(date);
  const today = todayStr();
  return (
    <Pressable onPress={onSelect} style={{ flex: 1 }}>
      <View
        ref={ref}
        collapsable={false}
        style={{
          minHeight: 70, borderRadius: 10, borderWidth: 1, padding: 3, alignItems: "center", gap: 3,
          borderColor: isHover ? colors.brand : selected ? colors.brand : colors.line,
          backgroundColor: isHover ? colors.brandBg : selected ? colors.cardAlt : colors.card,
          opacity: inMonth ? 1 : 0.4,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "800", color: date === today ? colors.brand : colors.text }}>{Number(date.slice(8))}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
          {list.map((s) => {
            const { icon } = workoutIcon(s.day_label);
            return (
              <Draggable key={s.id} item={{ id: s.id, label: s.day_label, icon }} enabled={!s.status} onPress={onSelect}>
                <View
                  style={{
                    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                    borderWidth: 2, borderColor: statusColor(s.status, s.date), backgroundColor: colors.bg,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{icon}</Text>
                </View>
              </Draggable>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}
