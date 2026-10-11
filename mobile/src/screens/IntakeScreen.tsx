import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Card, Caps, Choice, Chip, ErrorText, Field, H1, H2, Loading, P, ProgressBar, Screen } from "../components/ui";
import { SeasonFields } from "../components/SeasonFields";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { injuryLabel, INJURY_LOCATIONS } from "../lib/injuries";
import { equipmentLabel } from "../lib/plans.core";
import { prettyDate } from "../lib/dates";
import {
  BENCHMARK_OPTIONS, GOAL_CHIPS, LIFTING_OPTIONS, STEP_TITLES, TOTAL_STEPS, addGoal, buildIntakePayload, firstInvalidStep, initialIntake,
  parseDraft, toggleEquipment, toggleIn, validateIntakeStep, type IntakeState, type MaxEntry,
} from "../lib/intake.core";
import { EQUIPMENT_OPTIONS, MODALITY_OPTIONS, SPACE_OPTIONS } from "../shared/equipment-options";
import { colors } from "../theme";

const draftKey = (athleteId: string) => `intake-draft:${athleteId}`;

function MaxRow({ label, value, onChange }: { label: string; value: MaxEntry; onChange: (v: MaxEntry) => void }) {
  return (
    <Card>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      {value.skip ? (
        <Button title="Actually, let me enter a number" variant="link" onPress={() => onChange({ ...value, skip: false })} style={{ alignSelf: "flex-start" }} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field placeholder="Weight (lb)" keyboardType="decimal-pad" value={value.weight} onChangeText={(v) => onChange({ ...value, weight: v })} /></View>
            <View style={{ flex: 1 }}><Field placeholder="Reps" keyboardType="number-pad" value={value.reps} onChangeText={(v) => onChange({ ...value, reps: v })} /></View>
          </View>
          <Button title="I don't know / haven't tested this" variant="link" onPress={() => onChange({ weight: "", reps: "", skip: true })} style={{ alignSelf: "flex-start" }} />
        </>
      )}
    </Card>
  );
}

function SkipField({ label, value, skip, onValue, onSkip, skipLabel, keyboardType = "decimal-pad" }: {
  label: string; value: string; skip: boolean; onValue: (v: string) => void; onSkip: (v: boolean) => void; skipLabel: string; keyboardType?: any;
}) {
  return skip ? (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Button title="Actually, let me enter a number" variant="link" onPress={() => onSkip(false)} style={{ alignSelf: "flex-start" }} />
    </View>
  ) : (
    <View>
      <Field label={label} value={value} onChangeText={onValue} keyboardType={keyboardType} />
      <Button title={skipLabel} variant="link" onPress={() => onSkip(true)} style={{ alignSelf: "flex-start", marginTop: 6 }} />
    </View>
  );
}

export default function IntakeScreen({ navigation }: any) {
  const { athlete, refreshProfile } = useAuth();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [s, setS] = useState<IntakeState>(initialIntake());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof IntakeState>(k: K, v: IntakeState[K]) => setS((cur) => ({ ...cur, [k]: v }));

  // Restore any saved draft.
  useEffect(() => {
    if (!athlete) return;
    AsyncStorage.getItem(draftKey(athlete.id))
      .then((raw) => {
        const d = parseDraft(raw);
        if (d) { setS(d.state); setStep(d.step); }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [athlete]);

  // Save the draft as answers change.
  useEffect(() => {
    if (!athlete || !ready || done) return;
    AsyncStorage.setItem(draftKey(athlete.id), JSON.stringify({ step, state: s })).catch(() => {});
  }, [athlete, ready, done, step, s]);

  const go = useCallback((n: number) => {
    setError(null);
    setStep(n);
  }, []);

  function next() {
    const problem = validateIntakeStep(step, s);
    if (problem) return setError(problem);
    go(Math.min(step + 1, TOTAL_STEPS - 1));
  }

  async function submit() {
    if (!athlete) return;
    const bad = firstInvalidStep(s);
    if (bad !== null) {
      setStep(bad);
      return setError(validateIntakeStep(bad, s));
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/intake", { method: "POST", body: buildIntakePayload(athlete.id, s) });
      await AsyncStorage.removeItem(draftKey(athlete.id)).catch(() => {});
      setDone(true);
      refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    Alert.alert("Start over?", "This clears everything you've entered.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { setS(initialIntake()); setStep(0); setError(null); } },
    ]);
  }

  if (!ready) return <Screen><Loading /></Screen>;

  if (done) {
    return (
      <Screen>
        <H1>You're all set{athlete?.name ? `, ${athlete.name.split(" ")[0]}` : ""}.</H1>
        <P muted>Your answers are in. Your coach builds and reviews your season plan next, so check back soon. It will show up on Today once it's ready.</P>
        <Card>
          <H2>While you wait</H2>
          <P muted>You can browse ready-made programs and start one right now, or set up workout reminders.</P>
          <Button title="Browse programs" variant="secondary" onPress={() => navigation.reset({ index: 1, routes: [{ name: "Main" }, { name: "Plans" }] })} />
        </Card>
        <Button title="Go to Today" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })} />
      </Screen>
    );
  }

  const eq = (v: string) => set("equipment", toggleEquipment(s.equipment, v));
  const bodyweightOnly = s.equipment.includes("bodyweight_only");

  return (
    // key={step} remounts the scroller so each step opens at the top (answers live in this component's state).
    <Screen key={step}>
      <View style={{ gap: 6 }}>
        <Caps>Step {step + 1} of {TOTAL_STEPS}</Caps>
        <ProgressBar pct={((step + 1) / TOTAL_STEPS) * 100} />
      </View>
      <H1>{STEP_TITLES[step]}</H1>

      {step === 0 ? (
        <>
          <P muted>A couple of basics. Everything on these screens helps your coach build the right plan.</P>
          <Field label="Age" value={s.age} onChangeText={(v) => set("age", v)} keyboardType="number-pad" />
          <Caps>Which benchmark set should we compare your numbers against?</Caps>
          <P small muted>This only decides which reference table we compare your training numbers to. Pick whichever is most useful to you.</P>
          {BENCHMARK_OPTIONS.map((o) => <Choice key={o.value} label={o.label} selected={s.benchmarkSet === o.value} onPress={() => set("benchmarkSet", o.value)} />)}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Field label="Years playing organized ultimate" value={s.yearsPlayingUltimate} onChangeText={(v) => set("yearsPlayingUltimate", v)} keyboardType="number-pad" />
          <Field label="Years of structured strength training (0 is fine)" value={s.yearsStructuredTraining} onChangeText={(v) => set("yearsStructuredTraining", v)} keyboardType="number-pad" />
          <Caps>How would you describe your lifting experience?</Caps>
          {LIFTING_OPTIONS.map((o) => <Choice key={o.value} label={o.label} selected={s.liftingExperience === o.value} onPress={() => set("liftingExperience", o.value)} />)}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <P muted>Your season and anything that repeats weekly. Your plan is built backwards from these dates.</P>
          <SeasonFields
            start={s.seasonStart}
            end={s.seasonEnd}
            tournaments={s.tournaments}
            commitments={s.commitments}
            onStart={(v) => set("seasonStart", v)}
            onEnd={(v) => set("seasonEnd", v)}
            onTournaments={(v) => set("tournaments", v)}
            onCommitments={(v) => set("commitments", v)}
          />
          <Caps>Is your league and tournament schedule fully set yet?</Caps>
          <Choice label="Yes, it's set" selected={s.calendarConfirmed === "yes"} onPress={() => set("calendarConfirmed", "yes")} />
          <Choice label="Not yet. I'll add dates as they're released" selected={s.calendarConfirmed === "not_yet"} onPress={() => set("calendarConfirmed", "not_yet")} />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <P muted>How many dedicated training days you'll have every week for the whole season. Games don't count against this. You can change it later, but it triggers a quick rebuild of your plan rather than happening silently.</P>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[2, 3, 4, 5, 6].map((n) => <Chip key={n} label={`${n} days/week`} selected={s.trainingDaysPerWeek === String(n)} onPress={() => set("trainingDaysPerWeek", String(n))} />)}
          </View>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <P muted>Select everything you have regular access to.</P>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {EQUIPMENT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={s.equipment.includes(o.value)} onPress={() => eq(o.value)} />
            ))}
          </View>
          {bodyweightOnly ? <P small muted>Bodyweight Only can't be combined with other equipment. Tap another item to switch.</P> : null}
          <Caps>How much space do you have for running and jumping drills?</Caps>
          {SPACE_OPTIONS.map((o) => <Choice key={o.value} label={o.label} selected={s.availableSpace === o.value} onPress={() => set("availableSpace", o.value)} />)}
          <Caps>Preferred conditioning style</Caps>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {MODALITY_OPTIONS.map((o) => <Chip key={o.value} label={o.label.replace(" (default)", "")} selected={s.conditioningModality === o.value} onPress={() => set("conditioningModality", o.value)} />)}
          </View>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <P muted>Everything here is optional. Skip anything you don't know.</P>
          <SkipField label="Bodyweight (lb)" value={s.bodyweightLb} skip={s.bodyweightSkip} onValue={(v) => set("bodyweightLb", v)} onSkip={(v) => set("bodyweightSkip", v)} skipLabel="I'd rather not say" />
          <MaxRow label="Back squat (weight x reps)" value={s.backSquat} onChange={(v) => set("backSquat", v)} />
          <MaxRow label="Bench press (weight x reps)" value={s.benchPress} onChange={(v) => set("benchPress", v)} />
          <MaxRow label="Deadlift (weight x reps)" value={s.deadlift} onChange={(v) => set("deadlift", v)} />
          <MaxRow label="Power clean (weight x reps)" value={s.powerClean} onChange={(v) => set("powerClean", v)} />
          <SkipField label="Pull-up max reps" value={s.pullupMaxReps} skip={s.pullupSkip} onValue={(v) => set("pullupMaxReps", v)} onSkip={(v) => set("pullupSkip", v)} skipLabel="I don't know" keyboardType="number-pad" />
          <Field label="Vertical jump (inches, optional)" value={s.verticalJumpIn} onChangeText={(v) => set("verticalJumpIn", v)} keyboardType="decimal-pad" />
        </>
      ) : null}

      {step === 6 ? (
        <>
          <P muted>This never blocks your program. It just helps your coach build it right.</P>
          <Caps>Any pain or an active injury right now? Select all that apply.</Caps>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {INJURY_LOCATIONS.map((l) => <Chip key={l} label={injuryLabel(l)} selected={s.currentInjuries.includes(l)} onPress={() => set("currentInjuries", toggleIn(s.currentInjuries, l))} />)}
          </View>
          <Caps>Ever diagnosed with or treated for any of these, even if you're pain-free now?</Caps>
          <P small muted>This doesn't limit your program. It means we keep some proven resilience work for these areas built into every phase.</P>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {INJURY_LOCATIONS.map((l) => <Chip key={l} label={injuryLabel(l)} selected={s.injuryHistory.includes(l)} onPress={() => set("injuryHistory", toggleIn(s.injuryHistory, l))} />)}
          </View>
          <Field label="Anything else (pain, restriction, something you're managing) we should know?" value={s.catchall} onChangeText={(v) => set("catchall", v)} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
        </>
      ) : null}

      {step === 7 ? (
        <>
          <P muted>What are you training for right now, in your own words?</P>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GOAL_CHIPS.map((c) => <Chip key={c} label={c} selected={s.goals.toLowerCase().includes(c.toLowerCase())} onPress={() => set("goals", addGoal(s.goals, c))} />)}
          </View>
          <Field value={s.goals} onChangeText={(v) => set("goals", v)} multiline placeholder="Tell us more" style={{ minHeight: 110, textAlignVertical: "top" }} />
        </>
      ) : null}

      {step === 8 ? <Review s={s} go={go} /> : null}

      <ErrorText>{error}</ErrorText>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        <Button title="Back" variant="secondary" disabled={step === 0} onPress={() => go(Math.max(0, step - 1))} style={{ flex: 1 }} />
        {step < TOTAL_STEPS - 1 ? (
          <Button title="Next" onPress={next} style={{ flex: 2 }} />
        ) : (
          <Button title="Confirm & build my plan" onPress={submit} loading={busy} style={{ flex: 2 }} />
        )}
      </View>
      <Button title="Start over" variant="link" onPress={startOver} style={{ alignSelf: "center", marginTop: 4 }} />
    </Screen>
  );
}

const LIFT_LABEL: Record<string, string> = {
  new: "New to structured lifting",
  comfortable_with_basics: "Comfortable with the basics",
  very_experienced: "Very experienced",
};

function maxText(m: MaxEntry) {
  return m.skip ? "skipped" : m.weight || m.reps ? `${m.weight || "?"} x ${m.reps || "?"}` : "—";
}

function Section({ title, step, go, children }: { title: string; step: number; go: (n: number) => void; children: React.ReactNode }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
        <Button title="Edit" variant="link" onPress={() => go(step)} />
      </View>
      {children}
    </Card>
  );
}

function Review({ s, go }: { s: IntakeState; go: (n: number) => void }) {
  const games = s.commitments.length;
  return (
    <>
      <P muted>Check it over. Your coach uses this to build your season plan.</P>
      <Section title="About you" step={0} go={go}>
        <P muted>Age {s.age || "—"} · {BENCHMARK_OPTIONS.find((o) => o.value === s.benchmarkSet)?.label ?? "no benchmark chosen"}</P>
      </Section>
      <Section title="Experience" step={1} go={go}>
        <P muted>{s.yearsPlayingUltimate || "?"} yrs playing · {s.yearsStructuredTraining || "?"} yrs structured training · {LIFT_LABEL[s.liftingExperience] ?? "—"}</P>
      </Section>
      <Section title="Season calendar" step={2} go={go}>
        <P muted>{s.seasonStart ? prettyDate(s.seasonStart) : "?"} to {s.seasonEnd ? prettyDate(s.seasonEnd) : "?"} · {s.calendarConfirmed === "yes" ? "schedule set" : "schedule provisional"}</P>
        <P muted>{games} weekly commitment{games === 1 ? "" : "s"} · {s.tournaments.length} tournament{s.tournaments.length === 1 ? "" : "s"}</P>
      </Section>
      <Section title="Training days" step={3} go={go}>
        <P muted>{s.trainingDaysPerWeek || "—"} days a week</P>
      </Section>
      <Section title="Equipment" step={4} go={go}>
        <P muted>{s.equipment.map(equipmentLabel).join(", ") || "—"}</P>
        <P muted>Space: {s.availableSpace || "—"} · Conditioning: {s.conditioningModality}</P>
      </Section>
      <Section title="Stats & maxes" step={5} go={go}>
        <P muted>Bodyweight: {s.bodyweightSkip ? "skipped" : s.bodyweightLb || "—"}</P>
        <P muted>Squat {maxText(s.backSquat)} · Bench {maxText(s.benchPress)} · Deadlift {maxText(s.deadlift)} · Power clean {maxText(s.powerClean)}</P>
        <P muted>Pull-ups: {s.pullupSkip ? "skipped" : s.pullupMaxReps || "—"} · Vertical: {s.verticalJumpIn || "—"}</P>
      </Section>
      <Section title="Injury screening" step={6} go={go}>
        <P muted>Current: {s.currentInjuries.map(injuryLabel).join(", ") || "none reported"}</P>
        <P muted>History: {s.injuryHistory.map(injuryLabel).join(", ") || "none reported"}</P>
        {s.catchall ? <P muted>Note: {s.catchall}</P> : null}
      </Section>
      <Section title="Goals" step={7} go={go}>
        <P muted>{s.goals || "—"}</P>
      </Section>
    </>
  );
}
