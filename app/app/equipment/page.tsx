"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";
import { ATHLETE_NAV_LINKS } from "../_components/nav-links";
import { EQUIPMENT_OPTIONS, SPACE_OPTIONS, MODALITY_OPTIONS, toggleEquipmentValue } from "@/lib/training/equipment-options";

/**
 * Post-intake equipment editor. Saves to current_athlete_state.equipment
 * (see app/api/athletes/[id]/equipment/route.ts). Applies to future training
 * blocks; the athlete can optionally ask for a rebuild of their current phase,
 * which goes to the coach for review like any other athlete-initiated rebuild.
 */
export default function EquipmentPage() {
  const { athlete, authError, loadError: sessionLoadError } = useAthleteSession("/app/equipment");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [space, setSpace] = useState("standard");
  const [modality, setModality] = useState("running");
  const [savedExtra, setSavedExtra] = useState("standard|running");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canRebuild, setCanRebuild] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    if (!athlete) return;
    fetch(`/api/athletes/${athlete.id}/equipment`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEquipment(data.equipment);
        setSaved(data.equipment);
        setSpace(data.available_space ?? "standard");
        setModality(data.conditioning_modality ?? "running");
        setSavedExtra(`${data.available_space ?? "standard"}|${data.conditioning_modality ?? "running"}`);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [athlete]);

  const changed =
    JSON.stringify([...equipment].sort()) !== JSON.stringify([...saved].sort()) ||
    `${space}|${modality}` !== savedExtra;

  async function save() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/equipment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment, available_space: space, conditioning_modality: modality }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(data.equipment);
      setSavedExtra(`${space}|${modality}`);
      setMessage(data.message);
      setCanRebuild(!!data.has_active_phase);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function rebuild() {
    if (!athlete) return;
    setRebuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/request-rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason_category: "other",
          detail: `Athlete updated their available equipment to: ${saved.join(", ")}. Please rebuild the rest of the current phase with it.`,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(data.message ?? "Your coach has an updated plan to review.");
      setCanRebuild(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRebuilding(false);
    }
  }

  if (authError === "no-athlete") {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="text-sm text-slate-600">
          You&apos;re logged in, but there&apos;s no athlete profile for this account yet.{" "}
          <Link href="/app/intake" className="text-brand underline">Complete intake</Link>.
        </p>
      </main>
    );
  }
  if (!athlete) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="text-sm text-slate-500">Loading…</p>
        {sessionLoadError && <p className="mt-2 text-sm text-red-600">{sessionLoadError}</p>}
      </main>
    );
  }

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={ATHLETE_NAV_LINKS} />
      <main className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
        <h1 className="text-2xl font-bold text-brand-dark">Your equipment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select everything you have regular access to. Your programs only use exercises you can do with this.
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        {loaded && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    equipment.includes(opt.value) ? "border-brand bg-blue-50" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={equipment.includes(opt.value)}
                    onChange={() => setEquipment((cur) => toggleEquipmentValue(cur, opt.value))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Space for running and jumping drills</p>
              {SPACE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="space" checked={space === opt.value} onChange={() => setSpace(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Preferred conditioning style</p>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                {MODALITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || !changed || equipment.length === 0}
              className="mt-6 w-full rounded-md bg-brand px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {canRebuild && (
              <div className="mt-4 rounded-md border border-slate-200 p-3">
                <p className="text-sm text-slate-600">
                  Want your current training block rebuilt with this equipment? Your coach will review the update.
                </p>
                <button
                  type="button"
                  onClick={rebuild}
                  disabled={rebuilding}
                  className="mt-2 rounded-md border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-blue-50 disabled:opacity-50"
                >
                  {rebuilding ? "Requesting…" : "Rebuild my current phase"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
