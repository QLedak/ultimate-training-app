"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";

const NAV_LINKS = [
  { href: "/app", label: "Home" },
  { href: "/app/log", label: "Schedule" },
  { href: "/app/log/program", label: "Season" },
];

type Tournament = { start_date: string; end_date: string; label: string; is_priority?: boolean };

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

/**
 * The edit path intake never had a follow-up for: add a tournament or
 * league date as it's announced, and (new) flag one as this season's
 * priority/peak event so the program builds toward it specifically. See
 * app/api/athletes/[id]/schedule/route.ts for what happens on save.
 */
export default function EditSchedulePage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/schedule");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    fetch(`/api/athletes/${athlete.id}/schedule`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSeasonStart(data.season_start ?? "");
        setSeasonEnd(data.season_end ?? "");
        setTournaments(data.tournament_weekends ?? []);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [athlete]);

  function updateTournament(i: number, patch: Partial<Tournament>) {
    setTournaments((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function setPriority(i: number) {
    setTournaments((ts) => ts.map((t, idx) => ({ ...t, is_priority: idx === i ? !t.is_priority : false })));
  }

  function removeTournament(i: number) {
    setTournaments((ts) => ts.filter((_, idx) => idx !== i));
  }

  function addTournament() {
    setTournaments((ts) => [...ts, { start_date: "", end_date: "", label: "", is_priority: false }]);
  }

  async function handleSave() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_start: seasonStart,
          season_end: seasonEnd,
          tournament_weekends: tournaments,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaveMessage(data.message ?? "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-brand-dark">Edit your schedule</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add tournaments as they&apos;re announced, and mark your most important one so your program peaks for it.
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {saveMessage && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{saveMessage}</p>}

        <div className="mt-6 flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">Season start</span>
            <input type="date" className={inputClass} value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">Season end</span>
            <input type="date" className={inputClass} value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
          </label>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tournaments & league weekends
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Check &ldquo;Most important&rdquo; on the one event you most want to peak for — Regionals, Nationals,
            whichever matters most this season. Only one can be checked.
          </p>
          <div className="space-y-3">
            {tournaments.map((t, i) => (
              <div
                key={i}
                className={`space-y-2 rounded-md border p-3 ${t.is_priority ? "border-brand bg-blue-50" : "border-slate-200"}`}
              >
                <div className="flex gap-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={t.start_date}
                    onChange={(e) => updateTournament(i, { start_date: e.target.value })}
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={t.end_date}
                    onChange={(e) => updateTournament(i, { end_date: e.target.value })}
                  />
                  <button type="button" onClick={() => removeTournament(i)} className="text-slate-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
                <input
                  placeholder="Label (e.g. Regionals)"
                  className={inputClass}
                  value={t.label}
                  onChange={(e) => updateTournament(i, { label: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!t.is_priority} onChange={() => setPriority(i)} />
                  Most important — peak for this one
                </label>
              </div>
            ))}
            <button type="button" onClick={addTournament} className="text-sm text-brand underline">
              + Add a tournament or league weekend
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-8 w-full rounded-md bg-brand px-4 py-3.5 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </main>
    </>
  );
}
