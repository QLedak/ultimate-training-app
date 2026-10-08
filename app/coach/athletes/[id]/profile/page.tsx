"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";

type Coach = { id: string; email: string; name: string | null };
type AthleteRow = { id: string; email: string; name: string | null };

type Intake = {
  age: number | null;
  benchmark_set: string | null;
  years_playing_ultimate: number | null;
  years_structured_training: number | null;
  lifting_experience_selfdescribe: string | null;
  season_start: string | null;
  season_end: string | null;
  recurring_commitments: { day_of_week?: string; time?: string; label?: string }[];
  tournament_weekends: { start_date: string; end_date: string; label?: string; is_priority?: boolean }[];
  season_calendar_confirmed: boolean;
  training_days_per_week: number;
  equipment: string[];
  bodyweight_lb: number | null;
  back_squat_weight: number | null;
  back_squat_reps: number | null;
  bench_press_weight: number | null;
  bench_press_reps: number | null;
  deadlift_weight: number | null;
  deadlift_reps: number | null;
  power_clean_weight: number | null;
  power_clean_reps: number | null;
  pullup_max_reps: number | null;
  vertical_jump_in: number | null;
  goals: string | null;
  submitted_at: string;
};

type CurrentState = {
  bodyweight_lb: number | null;
  back_squat_1rm: number | null;
  bench_press_1rm: number | null;
  deadlift_1rm: number | null;
  power_clean_1rm: number | null;
  pullup_max_reps: number | null;
  vertical_jump_in: number | null;
  maxes_source: string;
  equipment: string[];
  training_days_per_week: number;
  current_active_injuries: { location: string; character?: string; since?: string; note?: string }[];
  standing_resilience_regions: { location: string; current_stage: string }[];
  updated_at: string;
};

type InjuryReport = {
  location: string;
  location_other_text: string | null;
  report_type: "current_active" | "history";
  character: string | null;
  duration_text: string | null;
  notes: string | null;
  created_at: string;
};

type ProfileData = {
  athlete: AthleteRow;
  intake: Intake | null;
  current_state: CurrentState | null;
  injury_reports: InjuryReport[];
  catchall_restrictions: { text: string; created_at: string }[];
  bodyweight_history: { date: string; bodyweight_lb: number }[];
};

const NAV_LINKS = [
  { href: "/coach", label: "Home" },
  { href: "/review", label: "Review" },
];

const LOCATION_LABELS: Record<string, string> = {
  achilles_calf: "Achilles / calf",
  patellar_knee: "Patellar / knee",
  acl_knee: "ACL / knee",
  hamstring: "Hamstring",
  groin_adductor: "Groin / adductor",
  abdominal: "Core / abdominal",
  hip_flexor: "Hip flexor",
  elbow: "Elbow",
  wrist: "Wrist",
  shoulder: "Shoulder",
  lower_back: "Lower back",
  ankle: "Ankle",
  other: "Other",
};

const LIFTING_EXPERIENCE_LABELS: Record<string, string> = {
  new: "New to lifting",
  comfortable_with_basics: "Comfortable with the basics",
  very_experienced: "Very experienced",
};

function fmt(n: number | null | undefined, suffix = "") {
  return n == null ? "—" : `${n}${suffix}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-brand-dark">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

/**
 * Coach-facing athlete profile — "who is this athlete," distinct from
 * /coach/athletes/[id]/program's "what are they training on right now."
 * Never built before now (testing feedback flagged it as missing); read-only,
 * same single-coach access model as the rest of the coach surface.
 */
export default function CoachAthleteProfilePage({ params }: { params: { id: string } }) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/coach")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setCoach(d.coach);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/coach/athletes/${params.id}/profile`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [params.id]);

  const activeInjuries = data?.current_state?.current_active_injuries ?? [];
  const resilienceRegions = data?.current_state?.standing_resilience_regions ?? [];
  const historyReports = (data?.injury_reports ?? []).filter((r) => r.report_type === "history");
  const upcomingTournaments = (data?.intake?.tournament_weekends ?? [])
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <>
      <NavBar role="coach" name={coach?.name ?? null} links={NAV_LINKS} />
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <Link href="/coach" className="text-sm text-brand underline">
          ← Coach dashboard
        </Link>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

        {data && (
          <>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-bold text-brand-dark">
                {data.athlete.name ?? data.athlete.email}
              </h1>
              <Link
                href={`/coach/athletes/${data.athlete.id}/program`}
                className="text-sm text-brand underline"
              >
                View current program →
              </Link>
            </div>
            <p className="mt-1 text-sm text-slate-500">{data.athlete.email}</p>

            {!data.intake ? (
              <p className="mt-6 rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                This athlete hasn&apos;t completed intake yet.
              </p>
            ) : (
              <>
                <Section title="Profile">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Age" value={fmt(data.intake.age)} />
                    <Stat
                      label="Lifting experience"
                      value={LIFTING_EXPERIENCE_LABELS[data.intake.lifting_experience_selfdescribe ?? ""] ?? "—"}
                    />
                    <Stat label="Years playing ultimate" value={fmt(data.intake.years_playing_ultimate)} />
                    <Stat
                      label="Years structured training"
                      value={fmt(data.intake.years_structured_training)}
                    />
                    <Stat label="Training days/week" value={fmt(data.current_state?.training_days_per_week ?? data.intake.training_days_per_week)} />
                    <Stat
                      label="Bodyweight"
                      value={fmt(data.current_state?.bodyweight_lb ?? data.intake.bodyweight_lb, " lb")}
                    />
                  </div>
                  {data.intake.goals && (
                    <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="font-medium">Goals: </span>
                      {data.intake.goals}
                    </p>
                  )}
                  {(data.intake.equipment?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(data.current_state?.equipment ?? data.intake.equipment).map((eq) => (
                        <span
                          key={eq}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {eq.replace(/_/g, " ")}
                        </span>
                      ))}
                      {data.current_state?.updated_at && (
                        <span className="self-center text-xs text-slate-400">
                          (state updated {new Date(data.current_state.updated_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  )}
                </Section>

                <Section title="Current maxes">
                  <p className="mb-2 text-xs text-slate-400">
                    Source: {data.current_state?.maxes_source?.replace(/_/g, " ") ?? "intake estimate"}
                    {data.current_state?.updated_at &&
                      ` · updated ${new Date(data.current_state.updated_at).toLocaleDateString()}`}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                    <Stat
                      label="Back squat"
                      value={fmt(data.current_state?.back_squat_1rm ?? data.intake.back_squat_weight, " lb")}
                    />
                    <Stat
                      label="Bench press"
                      value={fmt(data.current_state?.bench_press_1rm ?? data.intake.bench_press_weight, " lb")}
                    />
                    <Stat
                      label="Deadlift"
                      value={fmt(data.current_state?.deadlift_1rm ?? data.intake.deadlift_weight, " lb")}
                    />
                    <Stat
                      label="Power clean"
                      value={fmt(data.current_state?.power_clean_1rm ?? data.intake.power_clean_weight, " lb")}
                    />
                    <Stat
                      label="Pull-up max"
                      value={fmt(data.current_state?.pullup_max_reps ?? data.intake.pullup_max_reps)}
                    />
                    <Stat
                      label="Vertical jump"
                      value={fmt(data.current_state?.vertical_jump_in ?? data.intake.vertical_jump_in, " in")}
                    />
                  </div>
                </Section>

                <Section title="Injuries">
                  {activeInjuries.length === 0 && resilienceRegions.length === 0 && historyReports.length === 0 ? (
                    <p className="text-sm text-slate-500">No injuries reported.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeInjuries.map((inj, i) => (
                        <div key={`active-${i}`} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                          <span className="font-medium text-red-800">
                            {LOCATION_LABELS[inj.location] ?? inj.location} — active
                          </span>
                          {inj.character && (
                            <span className="ml-2 text-xs text-red-600">
                              ({inj.character.replace(/_/g, " ")})
                            </span>
                          )}
                          {inj.note && <p className="mt-1 text-xs text-red-700">{inj.note}</p>}
                        </div>
                      ))}
                      {resilienceRegions.map((r, i) => (
                        <div
                          key={`resilience-${i}`}
                          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
                        >
                          <span className="font-medium text-amber-800">
                            {LOCATION_LABELS[r.location] ?? r.location} — standing resilience work
                          </span>
                          <span className="ml-2 text-xs text-amber-700">
                            stage: {r.current_stage.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                      {historyReports
                        .filter((r) => !resilienceRegions.some((rr) => rr.location === r.location))
                        .map((r, i) => (
                          <div key={`history-${i}`} className="rounded-md border border-slate-200 p-3 text-sm">
                            <span className="font-medium text-slate-700">
                              {LOCATION_LABELS[r.location] ?? r.location_other_text ?? r.location} — history
                            </span>
                            {r.notes && <p className="mt-1 text-xs text-slate-500">{r.notes}</p>}
                          </div>
                        ))}
                    </div>
                  )}
                  {data.catchall_restrictions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {data.catchall_restrictions.map((c, i) => (
                        <p key={i} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                          {c.text}
                        </p>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Season">
                  <p className="text-sm text-slate-600">
                    {data.intake.season_start ?? "—"} → {data.intake.season_end ?? "—"}
                    {!data.intake.season_calendar_confirmed && " · provisional"}
                  </p>
                  {upcomingTournaments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {upcomingTournaments.map((t, i) => (
                        <div key={i} className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm">
                          <span className="font-medium text-purple-800">{t.label || "Tournament"}</span>{" "}
                          <span className="text-purple-600">
                            {t.start_date} → {t.end_date}
                          </span>
                          {t.is_priority && (
                            <span className="ml-2 rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800">
                              Priority peak
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {data.bodyweight_history.length > 0 && (
                  <Section title="Recent bodyweight">
                    <div className="flex flex-wrap gap-2">
                      {data.bodyweight_history.map((b, i) => (
                        <span key={i} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                          {b.date}: {b.bodyweight_lb} lb
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                <p className="mt-8 text-xs text-slate-400">
                  Intake submitted {new Date(data.intake.submitted_at).toLocaleDateString()}
                </p>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
