"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ---- Controlled vocabularies (must match the DB check constraints / Exercise Library tags exactly) ----

const EQUIPMENT_OPTIONS = [
  { value: "barbell_rack", label: "Barbell + Rack" },
  { value: "bench", label: "Bench" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "pullup_bar", label: "Pull-Up Bar" },
  { value: "cable_machine", label: "Cable Machine" },
  { value: "bands", label: "Resistance Bands" },
  { value: "med_ball", label: "Medicine Ball" },
  { value: "boxes", label: "Boxes/Plyo Boxes" },
  { value: "sled", label: "Sled" },
  { value: "turf_track", label: "Turf/Track/Running Room" },
  { value: "cardio_machine", label: "Treadmill/Bike/Rower" },
  { value: "bodyweight_only", label: "Bodyweight Only" },
];

const INJURY_LOCATIONS = [
  { value: "achilles_calf", label: "Achilles/calf" },
  { value: "patellar_knee", label: "Patellar tendon/knee" },
  { value: "acl_knee", label: "ACL/knee (post-surgical or otherwise)" },
  { value: "hamstring", label: "Hamstring" },
  { value: "groin_adductor", label: "Groin/adductor" },
  { value: "shoulder", label: "Shoulder" },
  { value: "lower_back", label: "Lower back" },
  { value: "ankle", label: "Ankle" },
  { value: "other", label: "Other" },
];

const GOAL_CHIPS = [
  "Get faster",
  "Jump higher",
  "Build strength",
  "Stay healthy through a long season",
  "Coming back from injury",
  "Make a specific team/roster",
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type CurrentInjury = { location: string; locationOther: string; character: string; durationText: string };
type RecurringCommitment = {
  dayOfWeek: string;
  time: string;
  label: string;
  startDate: string;
  endDate: string;
};
type TournamentWeekend = { startDate: string; endDate: string; label: string };
type MaxEntry = { weight: string; reps: string; skip: boolean };

type IntakeState = {
  name: string;
  email: string;
  password: string;
  age: string;
  benchmarkSet: "male_typical" | "female_typical" | "general_range" | "";
  yearsPlayingUltimate: string;
  yearsStructuredTraining: string;
  liftingExperience: "new" | "comfortable_with_basics" | "very_experienced" | "";
  seasonStart: string;
  seasonEnd: string;
  recurringCommitments: RecurringCommitment[];
  tournamentWeekends: TournamentWeekend[];
  calendarConfirmed: "yes" | "not_yet" | "";
  trainingDaysPerWeek: string;
  equipment: string[];
  bodyweightLb: string;
  bodyweightSkip: boolean;
  backSquat: MaxEntry;
  benchPress: MaxEntry;
  deadlift: MaxEntry;
  powerClean: MaxEntry;
  pullupMaxReps: string;
  pullupSkip: boolean;
  verticalJumpIn: string;
  currentPain: "yes" | "no" | "";
  currentInjuries: CurrentInjury[];
  injuryHistory: string[];
  catchall: string;
  goals: string;
  agreedToTerms: boolean;
};

const initialState: IntakeState = {
  name: "",
  email: "",
  password: "",
  age: "",
  benchmarkSet: "",
  yearsPlayingUltimate: "",
  yearsStructuredTraining: "",
  liftingExperience: "",
  seasonStart: "",
  seasonEnd: "",
  recurringCommitments: [],
  tournamentWeekends: [],
  calendarConfirmed: "",
  trainingDaysPerWeek: "",
  equipment: [],
  bodyweightLb: "",
  bodyweightSkip: false,
  backSquat: { weight: "", reps: "", skip: false },
  benchPress: { weight: "", reps: "", skip: false },
  deadlift: { weight: "", reps: "", skip: false },
  powerClean: { weight: "", reps: "", skip: false },
  pullupMaxReps: "",
  pullupSkip: false,
  verticalJumpIn: "",
  currentPain: "",
  currentInjuries: [],
  injuryHistory: [],
  catchall: "",
  goals: "",
  agreedToTerms: false,
};

const TOTAL_STEPS = 9;

function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-brand-dark">{title}</h2>
      {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

function MaxLiftInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MaxEntry;
  onChange: (v: MaxEntry) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {value.skip ? (
        <button
          type="button"
          onClick={() => onChange({ ...value, skip: false })}
          className="text-sm text-brand underline"
        >
          Actually, let me enter a number
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Weight (lb)"
              value={value.weight}
              onChange={(e) => onChange({ ...value, weight: e.target.value })}
              className={inputClass}
            />
            <input
              type="number"
              placeholder="Reps"
              value={value.reps}
              onChange={(e) => onChange({ ...value, reps: e.target.value })}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ weight: "", reps: "", skip: true })}
            className="mt-2 text-xs text-slate-500 underline"
          >
            I don&apos;t know / haven&apos;t tested this
          </button>
        </>
      )}
    </div>
  );
}

export default function IntakePage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<IntakeState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = <K extends keyof IntakeState>(key: K, value: IntakeState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  function toggleEquipment(value: string) {
    if (value === "bodyweight_only") {
      update("equipment", state.equipment.includes("bodyweight_only") ? [] : ["bodyweight_only"]);
      return;
    }
    const withoutBodyweightOnly = state.equipment.filter((e) => e !== "bodyweight_only");
    update(
      "equipment",
      withoutBodyweightOnly.includes(value)
        ? withoutBodyweightOnly.filter((e) => e !== value)
        : [...withoutBodyweightOnly, value]
    );
  }

  function toggleInjuryHistory(value: string) {
    update(
      "injuryHistory",
      state.injuryHistory.includes(value)
        ? state.injuryHistory.filter((v) => v !== value)
        : [...state.injuryHistory, value]
    );
  }

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function validateStep(): string | null {
    switch (step) {
      case 0:
        if (!state.name.trim()) return "Please enter your name.";
        if (!state.email.trim()) return "Please enter your email.";
        if (state.password.length < 8) return "Password must be at least 8 characters.";
        return null;
      case 1:
        if (state.yearsStructuredTraining === "") return "Let us know your years of structured training.";
        if (!state.liftingExperience) return "Please choose one.";
        return null;
      case 2:
        if (!state.seasonStart || !state.seasonEnd) return "Season start and end dates are required.";
        if (!state.calendarConfirmed) return "Please answer whether your schedule is set yet.";
        return null;
      case 3:
        if (!state.trainingDaysPerWeek) return "Please choose your training days per week.";
        return null;
      case 4:
        if (state.equipment.length === 0) return "Select at least one piece of equipment.";
        return null;
      case 6:
        if (!state.currentPain) return "Please answer this question.";
        if (state.currentPain === "yes") {
          for (const inj of state.currentInjuries) {
            if (!inj.location) return "Each reported area needs a location.";
            if (!inj.character) return "Each reported area needs how it feels.";
          }
        }
        return null;
      case 8:
        if (!state.agreedToTerms) return "Please agree to the Terms and Privacy Policy to continue.";
        return null;
      default:
        return null;
    }
  }

  function handleNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    next();
  }

  async function handleSubmit() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const athleteRes = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email, name: state.name, password: state.password }),
      });
      const athleteData = await athleteRes.json();
      if (athleteData.error) throw new Error(athleteData.error);
      const athleteId = athleteData.athlete.id;

      // Establish the browser session now — the account was just created
      // server-side via the admin API (no confirmation email involved), so
      // this sign-in always succeeds immediately.
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: state.email,
        password: state.password,
      });
      if (signInError) throw new Error(signInError.message);

      const injuryReports = [
        ...state.currentInjuries.map((inj) => ({
          location: inj.location,
          location_other_text: inj.location === "other" ? inj.locationOther : undefined,
          report_type: "current_active",
          character: inj.character,
          duration_text: inj.durationText,
        })),
        ...state.injuryHistory.map((loc) => ({ location: loc, report_type: "history" })),
      ];
      const catchallRestrictions = state.catchall.trim() ? [state.catchall.trim()] : [];

      const num = (v: string) => (v === "" ? null : Number(v));

      const intakePayload = {
        athleteId,
        age: num(state.age),
        benchmark_set: state.benchmarkSet || null,
        years_playing_ultimate: num(state.yearsPlayingUltimate),
        years_structured_training: num(state.yearsStructuredTraining),
        lifting_experience_selfdescribe: state.liftingExperience || null,
        season_start: state.seasonStart,
        season_end: state.seasonEnd,
        recurring_commitments: state.recurringCommitments.map((c) => ({
          day_of_week: c.dayOfWeek,
          time: c.time,
          label: c.label,
          start_date: c.startDate || null,
          end_date: c.endDate || null,
        })),
        tournament_weekends: state.tournamentWeekends.map((t) => ({
          start_date: t.startDate,
          end_date: t.endDate,
          label: t.label,
        })),
        season_calendar_confirmed: state.calendarConfirmed === "yes",
        training_days_per_week: num(state.trainingDaysPerWeek),
        equipment: state.equipment,
        bodyweight_lb: state.bodyweightSkip ? null : num(state.bodyweightLb),
        back_squat_weight: state.backSquat.skip ? null : num(state.backSquat.weight),
        back_squat_reps: state.backSquat.skip ? null : num(state.backSquat.reps),
        bench_press_weight: state.benchPress.skip ? null : num(state.benchPress.weight),
        bench_press_reps: state.benchPress.skip ? null : num(state.benchPress.reps),
        deadlift_weight: state.deadlift.skip ? null : num(state.deadlift.weight),
        deadlift_reps: state.deadlift.skip ? null : num(state.deadlift.reps),
        power_clean_weight: state.powerClean.skip ? null : num(state.powerClean.weight),
        power_clean_reps: state.powerClean.skip ? null : num(state.powerClean.reps),
        pullup_max_reps: state.pullupSkip ? null : num(state.pullupMaxReps),
        vertical_jump_in: num(state.verticalJumpIn),
        goals: state.goals,
        injuryReports,
        catchallRestrictions,
      };

      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intakePayload),
      });
      const intakeData = await intakeRes.json();
      if (intakeData.error) throw new Error(intakeData.error);

      const plannerRes = await fetch("/api/macrocycle-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId }),
      });
      const plannerData = await plannerRes.json();
      if (plannerData.error) throw new Error(plannerData.error);

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-dark">You&apos;re all set, {state.name.split(" ")[0]}.</h1>
        <p className="mt-3 text-slate-600">
          Your answers are in and your season plan is being built. Your coach reviews every plan before it&apos;s
          finalized, so check back soon.
        </p>
        <Link href="/app" className="mt-6 text-sm text-brand underline">
          Go to your dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full bg-brand transition-all"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <Screen title="Let's get you set up" subtitle="A few basics to start.">
          <Field label="Name">
            <input className={inputClass} value={state.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputClass}
              value={state.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={state.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              At least 8 characters. You&apos;ll use this to log in and check your workouts later.
            </p>
          </Field>
          <Field label="Age">
            <input
              type="number"
              className={inputClass}
              value={state.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </Field>
          <Field label="Which benchmark set should we compare your numbers against?">
            <p className="mb-2 text-xs text-slate-500">
              This just decides which reference table we compare your training numbers to — pick whichever is
              most useful to you.
            </p>
            <div className="space-y-2">
              {[
                { value: "male_typical", label: "Male-typical benchmarks" },
                { value: "female_typical", label: "Female-typical benchmarks" },
                { value: "general_range", label: "Prefer a general range" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="benchmarkSet"
                    checked={state.benchmarkSet === opt.value}
                    onChange={() => update("benchmarkSet", opt.value as IntakeState["benchmarkSet"])}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
        </Screen>
      )}

      {step === 1 && (
        <Screen title="Experience & training age">
          <Field label="Years playing organized ultimate">
            <input
              type="number"
              className={inputClass}
              value={state.yearsPlayingUltimate}
              onChange={(e) => update("yearsPlayingUltimate", e.target.value)}
            />
          </Field>
          <Field label="Years of structured strength training">
            <input
              type="number"
              className={inputClass}
              value={state.yearsStructuredTraining}
              onChange={(e) => update("yearsStructuredTraining", e.target.value)}
            />
          </Field>
          <Field label="How would you describe your lifting experience?">
            <div className="space-y-2">
              {[
                { value: "new", label: "New to structured lifting" },
                { value: "comfortable_with_basics", label: "Comfortable with the basics (squat, bench, deadlift)" },
                { value: "very_experienced", label: "Very experienced, have trained through multiple programs" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="liftingExperience"
                    checked={state.liftingExperience === opt.value}
                    onChange={() => update("liftingExperience", opt.value as IntakeState["liftingExperience"])}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
        </Screen>
      )}

      {step === 2 && (
        <Screen title="Season calendar">
          <div className="flex gap-3">
            <Field label="Season start">
              <input
                type="date"
                className={inputClass}
                value={state.seasonStart}
                onChange={(e) => update("seasonStart", e.target.value)}
              />
            </Field>
            <Field label="Season end">
              <input
                type="date"
                className={inputClass}
                value={state.seasonEnd}
                onChange={(e) => update("seasonEnd", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Recurring weekly commitments (league night, team practice)">
            <p className="mb-2 text-xs text-slate-500">
              If this only runs for part of the season (e.g. a winter league), add its date range so we don&apos;t
              plan around it before it starts or after it ends. Leave the dates blank if it runs the whole season.
            </p>
            <div className="space-y-2">
              {state.recurringCommitments.map((c, i) => (
                <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
                  <div className="flex gap-2">
                    <select
                      className={inputClass}
                      value={c.dayOfWeek}
                      onChange={(e) => {
                        const copy = [...state.recurringCommitments];
                        copy[i] = { ...c, dayOfWeek: e.target.value };
                        update("recurringCommitments", copy);
                      }}
                    >
                      <option value="">Day</option>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className={inputClass}
                      value={c.time}
                      onChange={(e) => {
                        const copy = [...state.recurringCommitments];
                        copy[i] = { ...c, time: e.target.value };
                        update("recurringCommitments", copy);
                      }}
                    />
                    <input
                      placeholder="Label (e.g. League night)"
                      className={inputClass}
                      value={c.label}
                      onChange={(e) => {
                        const copy = [...state.recurringCommitments];
                        copy[i] = { ...c, label: e.target.value };
                        update("recurringCommitments", copy);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "recurringCommitments",
                          state.recurringCommitments.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-slate-500">Runs from</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={c.startDate}
                      onChange={(e) => {
                        const copy = [...state.recurringCommitments];
                        copy[i] = { ...c, startDate: e.target.value };
                        update("recurringCommitments", copy);
                      }}
                    />
                    <span className="whitespace-nowrap text-xs text-slate-500">to</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={c.endDate}
                      onChange={(e) => {
                        const copy = [...state.recurringCommitments];
                        copy[i] = { ...c, endDate: e.target.value };
                        update("recurringCommitments", copy);
                      }}
                    />
                    <span className="whitespace-nowrap text-xs text-slate-400">(optional)</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update("recurringCommitments", [
                    ...state.recurringCommitments,
                    { dayOfWeek: "", time: "", label: "", startDate: "", endDate: "" },
                  ])
                }
                className="text-sm text-brand underline"
              >
                + Add a recurring commitment
              </button>
            </div>
          </Field>

          <Field label="Tournament weekends">
            <div className="space-y-2">
              {state.tournamentWeekends.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={t.startDate}
                    onChange={(e) => {
                      const copy = [...state.tournamentWeekends];
                      copy[i] = { ...t, startDate: e.target.value };
                      update("tournamentWeekends", copy);
                    }}
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={t.endDate}
                    onChange={(e) => {
                      const copy = [...state.tournamentWeekends];
                      copy[i] = { ...t, endDate: e.target.value };
                      update("tournamentWeekends", copy);
                    }}
                  />
                  <input
                    placeholder="Label"
                    className={inputClass}
                    value={t.label}
                    onChange={(e) => {
                      const copy = [...state.tournamentWeekends];
                      copy[i] = { ...t, label: e.target.value };
                      update("tournamentWeekends", copy);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "tournamentWeekends",
                        state.tournamentWeekends.filter((_, idx) => idx !== i)
                      )
                    }
                    className="text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update("tournamentWeekends", [
                    ...state.tournamentWeekends,
                    { startDate: "", endDate: "", label: "" },
                  ])
                }
                className="text-sm text-brand underline"
              >
                + Add a tournament weekend
              </button>
            </div>
          </Field>

          <Field label="Is your league/tournament schedule fully set yet?">
            <div className="space-y-2">
              {[
                { value: "yes", label: "Yes, it's set" },
                { value: "not_yet", label: "Not yet — I'll add dates as they're released" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="calendarConfirmed"
                    checked={state.calendarConfirmed === opt.value}
                    onChange={() => update("calendarConfirmed", opt.value as IntakeState["calendarConfirmed"])}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
        </Screen>
      )}

      {step === 3 && (
        <Screen title="Training frequency">
          <p className="text-sm text-slate-600">
            This is how many dedicated training days you&apos;ll have every week for the whole season — games
            don&apos;t count against this. You can change it later, but it&apos;ll trigger a quick rebuild of
            your plan rather than happening silently.
          </p>
          <Field label="Desired training days per week">
            <select
              className={inputClass}
              value={state.trainingDaysPerWeek}
              onChange={(e) => update("trainingDaysPerWeek", e.target.value)}
            >
              <option value="">Choose one</option>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} days/week
                </option>
              ))}
            </select>
          </Field>
        </Screen>
      )}

      {step === 4 && (
        <Screen title="Equipment access" subtitle="Select everything you have regular access to.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EQUIPMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  state.equipment.includes(opt.value) ? "border-brand bg-blue-50" : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={state.equipment.includes(opt.value)}
                  onChange={() => toggleEquipment(opt.value)}
                  disabled={
                    opt.value !== "bodyweight_only" && state.equipment.includes("bodyweight_only")
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Screen>
      )}

      {step === 5 && (
        <Screen title="Current stats & known maxes" subtitle="Everything here is optional — skip anything you don't know.">
          <Field label="Bodyweight (lb)">
            {state.bodyweightSkip ? (
              <button type="button" onClick={() => update("bodyweightSkip", false)} className="text-sm text-brand underline">
                Actually, let me enter a number
              </button>
            ) : (
              <>
                <input
                  type="number"
                  className={inputClass}
                  value={state.bodyweightLb}
                  onChange={(e) => update("bodyweightLb", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => update("bodyweightSkip", true)}
                  className="mt-1 text-xs text-slate-500 underline"
                >
                  I&apos;d rather not say
                </button>
              </>
            )}
          </Field>

          <MaxLiftInput label="Back Squat (weight x reps)" value={state.backSquat} onChange={(v) => update("backSquat", v)} />
          <MaxLiftInput label="Bench Press (weight x reps)" value={state.benchPress} onChange={(v) => update("benchPress", v)} />
          <MaxLiftInput label="Deadlift (weight x reps)" value={state.deadlift} onChange={(v) => update("deadlift", v)} />
          <MaxLiftInput
            label="Power Clean (weight x reps)"
            value={state.powerClean}
            onChange={(v) => update("powerClean", v)}
          />

          <Field label="Pull-up max reps">
            {state.pullupSkip ? (
              <button type="button" onClick={() => update("pullupSkip", false)} className="text-sm text-brand underline">
                Actually, let me enter a number
              </button>
            ) : (
              <>
                <input
                  type="number"
                  className={inputClass}
                  value={state.pullupMaxReps}
                  onChange={(e) => update("pullupMaxReps", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => update("pullupSkip", true)}
                  className="mt-1 text-xs text-slate-500 underline"
                >
                  I don&apos;t know
                </button>
              </>
            )}
          </Field>

          <Field label="Vertical jump (in, optional)">
            <input
              type="number"
              className={inputClass}
              value={state.verticalJumpIn}
              onChange={(e) => update("verticalJumpIn", e.target.value)}
            />
          </Field>
        </Screen>
      )}

      {step === 6 && (
        <Screen title="Injury screening" subtitle="This never blocks your program — it just helps us build it right.">
          <Field label="Do you currently have any pain or an active injury?">
            <div className="space-y-2">
              {[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="currentPain"
                    checked={state.currentPain === opt.value}
                    onChange={() => {
                      update("currentPain", opt.value as IntakeState["currentPain"]);
                      if (opt.value === "no") update("currentInjuries", []);
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>

          {state.currentPain === "yes" && (
            <div className="space-y-3">
              {state.currentInjuries.map((inj, i) => (
                <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
                  <select
                    className={inputClass}
                    value={inj.location}
                    onChange={(e) => {
                      const copy = [...state.currentInjuries];
                      copy[i] = { ...inj, location: e.target.value };
                      update("currentInjuries", copy);
                    }}
                  >
                    <option value="">Location</option>
                    {INJURY_LOCATIONS.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                  {inj.location === "other" && (
                    <input
                      placeholder="Describe the location"
                      className={inputClass}
                      value={inj.locationOther}
                      onChange={(e) => {
                        const copy = [...state.currentInjuries];
                        copy[i] = { ...inj, locationOther: e.target.value };
                        update("currentInjuries", copy);
                      }}
                    />
                  )}
                  <div className="space-y-1">
                    {[
                      { value: "sharp_sudden", label: "Sharp/sudden onset" },
                      { value: "tight_sore_gradual", label: "Tight/sore, comes on gradually or after activity" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`character-${i}`}
                          checked={inj.character === opt.value}
                          onChange={() => {
                            const copy = [...state.currentInjuries];
                            copy[i] = { ...inj, character: opt.value };
                            update("currentInjuries", copy);
                          }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <input
                    placeholder="How long has this been present?"
                    className={inputClass}
                    value={inj.durationText}
                    onChange={(e) => {
                      const copy = [...state.currentInjuries];
                      copy[i] = { ...inj, durationText: e.target.value };
                      update("currentInjuries", copy);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => update("currentInjuries", state.currentInjuries.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update("currentInjuries", [
                    ...state.currentInjuries,
                    { location: "", locationOther: "", character: "", durationText: "" },
                  ])
                }
                className="text-sm text-brand underline"
              >
                + Add an area
              </button>
            </div>
          )}

          <Field label="Have you ever been diagnosed with or treated for any of the following — even if you're fully recovered and pain-free now?">
            <p className="mb-2 text-xs text-slate-500">
              This doesn&apos;t limit your program — it just means we&apos;ll keep some proven resilience work for
              these areas built into every phase, the way a coach would for an athlete with your history.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INJURY_LOCATIONS.filter((l) => l.value !== "other").map((loc) => (
                <label key={loc.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.injuryHistory.includes(loc.value)}
                    onChange={() => toggleInjuryHistory(loc.value)}
                  />
                  {loc.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Anything else — pain, restriction, or something you're managing — that we should know about?">
            <textarea
              className={inputClass}
              rows={3}
              value={state.catchall}
              onChange={(e) => update("catchall", e.target.value)}
            />
          </Field>
        </Screen>
      )}

      {step === 7 && (
        <Screen title="Goals" subtitle="What are you training for right now, in your own words?">
          <div className="flex flex-wrap gap-2">
            {GOAL_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => update("goals", state.goals ? `${state.goals}. ${chip}` : chip)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
              >
                {chip}
              </button>
            ))}
          </div>
          <textarea
            className={inputClass}
            rows={4}
            value={state.goals}
            onChange={(e) => update("goals", e.target.value)}
          />
        </Screen>
      )}

      {step === 8 && (
        <Screen title="Review & confirm" subtitle="This builds your season plan — check it over before we generate it.">
          <div className="space-y-4 text-sm">
            <SummarySection title="Basics" onEdit={() => setStep(0)}>
              <p>{state.name} · {state.email} · Age {state.age || "—"}</p>
              <p>Benchmark: {state.benchmarkSet || "—"}</p>
            </SummarySection>
            <SummarySection title="Experience" onEdit={() => setStep(1)}>
              <p>
                {state.yearsPlayingUltimate || "?"} yrs playing · {state.yearsStructuredTraining || "?"} yrs
                structured training · {state.liftingExperience || "—"}
              </p>
            </SummarySection>
            <SummarySection title="Season calendar" onEdit={() => setStep(2)}>
              <p>
                {state.seasonStart || "?"} → {state.seasonEnd || "?"} ·{" "}
                {state.calendarConfirmed === "yes" ? "Schedule set" : "Provisional"}
              </p>
              <p>{state.recurringCommitments.length} recurring commitments, {state.tournamentWeekends.length} tournament weekends</p>
            </SummarySection>
            <SummarySection title="Training frequency" onEdit={() => setStep(3)}>
              <p>{state.trainingDaysPerWeek || "—"} days/week</p>
            </SummarySection>
            <SummarySection title="Equipment" onEdit={() => setStep(4)}>
              <p>{state.equipment.join(", ") || "—"}</p>
            </SummarySection>
            <SummarySection title="Stats & maxes" onEdit={() => setStep(5)}>
              <p>Bodyweight: {state.bodyweightSkip ? "skipped" : state.bodyweightLb || "—"}</p>
              <p>
                Squat: {state.backSquat.skip ? "skipped" : `${state.backSquat.weight || "?"} x ${state.backSquat.reps || "?"}`} ·
                Bench: {state.benchPress.skip ? "skipped" : `${state.benchPress.weight || "?"} x ${state.benchPress.reps || "?"}`} ·
                Deadlift: {state.deadlift.skip ? "skipped" : `${state.deadlift.weight || "?"} x ${state.deadlift.reps || "?"}`} ·
                Power Clean: {state.powerClean.skip ? "skipped" : `${state.powerClean.weight || "?"} x ${state.powerClean.reps || "?"}`}
              </p>
              <p>Pull-up max: {state.pullupSkip ? "skipped" : state.pullupMaxReps || "—"} · Vertical jump: {state.verticalJumpIn || "—"}</p>
            </SummarySection>
            <SummarySection title="Injury screening" onEdit={() => setStep(6)}>
              <p>Current pain: {state.currentPain || "—"} ({state.currentInjuries.length} area(s))</p>
              <p>History: {state.injuryHistory.join(", ") || "none reported"}</p>
              {state.catchall && <p>Note: {state.catchall}</p>}
            </SummarySection>
            <SummarySection title="Goals" onEdit={() => setStep(7)}>
              <p>{state.goals || "—"}</p>
            </SummarySection>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={state.agreedToTerms}
              onChange={(e) => update("agreedToTerms", e.target.checked)}
            />
            <span>
              I&apos;ve read and agree to the{" "}
              <Link href="/terms" target="_blank" className="text-brand underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="text-brand underline">
                Privacy Policy
              </Link>
              , including how my training and injury information is used.
            </span>
          </label>
        </Screen>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          Back
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !state.agreedToTerms}
            className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Building your plan…" : "Confirm & build my plan"}
          </button>
        )}
      </div>
    </main>
  );
}

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-brand-dark">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs text-brand underline">
          Edit
        </button>
      </div>
      <div className="text-slate-600">{children}</div>
    </div>
  );
}
