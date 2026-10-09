"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav/NavBar";
import { useAthleteSession } from "../_components/useAthleteSession";
import { ATHLETE_NAV_LINKS } from "../_components/nav-links";

type TestDef = { key: string; label: string; unit: string; weeks: number[] };
type PurchaseRow = {
  id: string; product_id: string; start_date: string; total_sessions: number; logged_sessions: number; end_date: string | null;
  product: { title: string; week_count: number; days_per_week: number; tests: TestDef[] } | null;
  next_session: { id: string; date: string; week_number: number; day_label: string } | null;
  tests: Array<{ test_key: string; week_number: number; value: number }>;
};

const inputClass = "w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand focus:outline-none";

export default function MyProgramsPage() {
  const { athlete, authError, loadError } = useAthleteSession("/app/programs");
  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  function load(id: string) {
    fetch(`/api/athletes/${id}/purchases`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setPurchases(d.purchases); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }
  useEffect(() => { if (athlete) load(athlete.id); }, [athlete]);

  async function saveTest(purchaseId: string, key: string, week: number) {
    const dk = `${purchaseId}|${key}|${week}`;
    setError(null); setSaved(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/tests`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_key: key, week_number: week, value: Number(drafts[dk]) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setSaved(dk);
      if (athlete) load(athlete.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (authError === "no-athlete") {
    return <main className="mx-auto max-w-xl px-6 py-10"><p className="text-sm text-slate-600">No athlete profile for this account yet.</p></main>;
  }
  if (!athlete) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
        {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
      </main>
    );
  }

  return (
    <>
      <NavBar role="athlete" name={athlete.name} links={ATHLETE_NAV_LINKS} />
      <main className="mx-auto max-w-xl px-6 pb-16">
        <h1 className="text-2xl font-bold text-brand-dark">My programs</h1>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {purchases === null && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {purchases?.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">
            You haven&apos;t added a program yet. <Link href="/programs" className="text-brand underline">Browse programs</Link>.
          </p>
        )}
        <div className="mt-4 space-y-6">
          {purchases?.map((p) => {
            const pct = p.total_sessions ? Math.round((p.logged_sessions / p.total_sessions) * 100) : 0;
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                <h2 className="font-semibold text-brand-dark">{p.product?.title ?? p.product_id}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {p.logged_sessions} of {p.total_sessions} workouts logged · starts {p.start_date}{p.end_date ? ` · ends ${p.end_date}` : ""}
                </p>
                <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${pct}%` }} /></div>
                {p.next_session ? (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-slate-700">Next: Week {p.next_session.week_number}, {p.next_session.day_label} · {p.next_session.date}</p>
                    <Link href={`/app/log/${p.next_session.id}`} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Open</Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">All workouts logged. Nice work.</p>
                )}
                <Link href="/app/log" className="mt-2 block text-xs text-slate-500 underline">See full schedule</Link>

                {(p.product?.tests?.length ?? 0) > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <h3 className="text-sm font-medium text-slate-700">Test results</h3>
                    <p className="text-xs text-slate-500">Record these when you do the tests on your test days.</p>
                    <div className="mt-2 space-y-2">
                      {p.product!.tests.map((t) => (
                        <div key={t.key} className="text-sm">
                          <span className="text-slate-700">{t.label}</span> <span className="text-xs text-slate-400">({t.unit})</span>
                          <div className="mt-1 flex flex-wrap gap-3">
                            {t.weeks.map((wk) => {
                              const dk = `${p.id}|${t.key}|${wk}`;
                              const existing = p.tests.find((r) => r.test_key === t.key && r.week_number === wk);
                              return (
                                <span key={wk} className="flex items-center gap-1">
                                  <span className="text-xs text-slate-500">Wk {wk}</span>
                                  <input className={inputClass} inputMode="decimal" placeholder={existing ? String(existing.value) : ""}
                                    value={drafts[dk] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [dk]: e.target.value }))} />
                                  <button type="button" disabled={!drafts[dk]} onClick={() => saveTest(p.id, t.key, wk)}
                                    className="rounded border border-brand px-2 py-1 text-xs text-brand disabled:opacity-40">Save</button>
                                  {saved === dk && <span className="text-xs text-green-600">Saved</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Link href="/programs" className="mt-6 block text-center text-sm text-brand underline">Browse more programs</Link>
      </main>
    </>
  );
}
