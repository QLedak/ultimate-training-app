"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";
import { ATHLETE_NAV_LINKS } from "../_components/nav-links";

const NAV_LINKS = ATHLETE_NAV_LINKS;

type ActiveInjury = {
  location: string;
  character?: string;
  since?: string;
  note?: string;
  pending_resolution?: { resolved_at: string; after_phase_id: string };
};

// Matches app/app/intake/page.tsx's INJURY_LOCATIONS value->label mapping.
const LOCATION_LABELS: Record<string, string> = {
  achilles_calf: "Achilles/calf",
  patellar_knee: "Patellar tendon/knee",
  acl_knee: "ACL/knee",
  hamstring: "Hamstring",
  groin_adductor: "Groin/adductor",
  abdominal: "Core / abdominal",
  hip_flexor: "Hip flexor",
  elbow: "Elbow",
  wrist: "Wrist",
  shoulder: "Shoulder",
  lower_back: "Lower back",
  ankle: "Ankle",
};
function locationLabel(location: string) {
  return LOCATION_LABELS[location] ?? location.replace(/_/g, " ");
}
const ALL_LOCATIONS = Object.keys(LOCATION_LABELS);
const CHARACTER_OPTIONS = [
  { value: "sharp_sudden", label: "Sharp / sudden onset" },
  { value: "tight_sore_gradual", label: "Tight/sore, gradual or after activity" },
];

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

/**
 * Its own page, on its own nav tab — this used to be buried inside
 * /app/schedule (under "edit schedule / add a tournament"), which made it
 * easy to miss that it existed at all. See app/api/athletes/[id]/injury-status/route.ts
 * for what happens on save: a check-in on an already-active injury
 * (resolved / still bothering me) or reporting a brand-new one, either way
 * auto-triggering a mid-phase rebuild when there's an active plan to update.
 */
export default function InjuryStatusPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/injuries");

  const [loaded, setLoaded] = useState(false);
  const [activeInjuries, setActiveInjuries] = useState<ActiveInjury[]>([]);
  const [injuryNotes, setInjuryNotes] = useState<Record<string, string>>({});
  const [injuryError, setInjuryError] = useState<string | null>(null);
  const [injuryMessage, setInjuryMessage] = useState<string | null>(null);
  const [injurySavingLocation, setInjurySavingLocation] = useState<string | null>(null);

  const [newInjuryLocation, setNewInjuryLocation] = useState("");
  const [newInjuryCharacter, setNewInjuryCharacter] = useState("");
  const [newInjuryNote, setNewInjuryNote] = useState("");
  const [reportingInjury, setReportingInjury] = useState(false);

  function loadInjuryStatus(athleteId: string) {
    fetch(`/api/athletes/${athleteId}/injury-status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setActiveInjuries(data.current_active_injuries ?? []);
        setLoaded(true);
      })
      .catch((e) => setInjuryError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    if (!athlete) return;
    loadInjuryStatus(athlete.id);
  }, [athlete]);

  async function handleInjuryCheckIn(location: string, status: "resolved" | "still_active") {
    if (!athlete) return;
    setInjurySavingLocation(location);
    setInjuryError(null);
    setInjuryMessage(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/injury-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, status, note: injuryNotes[location] || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInjuryMessage(data.message ?? "Saved.");
      setInjuryNotes((n) => ({ ...n, [location]: "" }));
      loadInjuryStatus(athlete.id);
    } catch (e) {
      setInjuryError(e instanceof Error ? e.message : String(e));
    } finally {
      setInjurySavingLocation(null);
    }
  }

  async function handleReportNewInjury() {
    if (!athlete || !newInjuryLocation) return;
    setReportingInjury(true);
    setInjuryError(null);
    setInjuryMessage(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/injury-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_new",
          location: newInjuryLocation,
          character: newInjuryCharacter || undefined,
          note: newInjuryNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInjuryMessage(data.message ?? "Logged.");
      setNewInjuryLocation("");
      setNewInjuryCharacter("");
      setNewInjuryNote("");
      loadInjuryStatus(athlete.id);
    } catch (e) {
      setInjuryError(e instanceof Error ? e.message : String(e));
    } finally {
      setReportingInjury(false);
    }
  }

  if (authError === "no-athlete") {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-600">
          You&apos;re logged in, but there&apos;s no athlete profile for this account yet.{" "}
          <Link href="/app/intake" className="text-brand underline">Complete intake</Link>.
        </p>
      </main>
    );
  }

  if (!athlete || !loaded) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
        {sessionLoadError && <p className="mt-2 text-sm text-red-600">{sessionLoadError}</p>}
      </main>
    );
  }

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="text-2xl font-bold text-brand-dark">Injury status</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep this up to date and your program adjusts automatically — no more getting stuck on isometrics after
          you&apos;ve actually healed, and no more guessing if something new comes up.
        </p>

        {injuryError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{injuryError}</p>}
        {injuryMessage && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{injuryMessage}</p>}

        {activeInjuries.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Currently active
            </h2>
            <div className="space-y-3">
              {activeInjuries.map((inj) => (
                <div key={inj.location} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium text-brand-dark">{locationLabel(inj.location)}</p>
                  {inj.note && <p className="mt-0.5 text-xs italic text-slate-500">Last note: &ldquo;{inj.note}&rdquo;</p>}
                  {inj.pending_resolution && (
                    <p className="mt-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                      Marked as better — we&apos;ll finish this phase as planned, then move you to strengthening work in
                      your next phase. Tap &ldquo;Still bothering me&rdquo; if that changes.
                    </p>
                  )}
                  <input
                    placeholder="Optional note (e.g. how it's feeling)"
                    className={`${inputClass} mt-2`}
                    value={injuryNotes[inj.location] ?? ""}
                    onChange={(e) => setInjuryNotes((n) => ({ ...n, [inj.location]: e.target.value }))}
                  />
                  <div className="mt-2 flex gap-3">
                    {!inj.pending_resolution && (
                    <button
                      type="button"
                      onClick={() => handleInjuryCheckIn(inj.location, "resolved")}
                      disabled={injurySavingLocation === inj.location}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {injurySavingLocation === inj.location ? "Saving…" : "It's better — not bothering me"}
                    </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleInjuryCheckIn(inj.location, "still_active")}
                      disabled={injurySavingLocation === inj.location}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Still bothering me
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Report a new injury</h2>
          <div className="space-y-2">
            <select
              className={inputClass}
              value={newInjuryLocation}
              onChange={(e) => setNewInjuryLocation(e.target.value)}
            >
              <option value="">Where?</option>
              {ALL_LOCATIONS.filter((loc) => !activeInjuries.some((inj) => inj.location === loc)).map((loc) => (
                <option key={loc} value={loc}>
                  {locationLabel(loc)}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={newInjuryCharacter}
              onChange={(e) => setNewInjuryCharacter(e.target.value)}
            >
              <option value="">How does it feel? (optional)</option>
              {CHARACTER_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Optional note"
              className={inputClass}
              value={newInjuryNote}
              onChange={(e) => setNewInjuryNote(e.target.value)}
            />
            <button
              type="button"
              onClick={handleReportNewInjury}
              disabled={!newInjuryLocation || reportingInjury}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {reportingInjury ? "Logging…" : "Report injury"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
