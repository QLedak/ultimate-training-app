"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EQUIPMENT_OPTIONS } from "@/lib/training/equipment-options";
import { WEEKDAY_LABELS } from "@/lib/purchases/schedule";

type Product = {
  id: string; title: string; description: string | null; days_per_week: number; week_count: number; level: string | null;
  price_cents: number; currency: string; equipment: string[]; suggested_schedule: string | null;
  tests: Array<{ key: string; label: string; unit: string; weeks: number[] }>;
};
type Outline = Array<{ week_number: number; week_type: string; days: Array<{ day_label: string; exercise_count: number }> }>;

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const EXTRA_LABELS: Record<string, string> = { sliders: "Sliders/gliders (or towels on a smooth floor)", turf_track: "Space to sprint (20+ yards)" };
const DEFAULT_DAYS = [1, 2, 4, 6]; // Mon, Tue, Thu, Sat

function equipmentLabel(tag: string) {
  return EXTRA_LABELS[tag] ?? EQUIPMENT_OPTIONS.find((o) => o.value === tag)?.label ?? tag;
}
function priceLabel(cents: number, currency: string) {
  return cents === 0 ? "Free during launch" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [outline, setOutline] = useState<Outline>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  // schedule
  const [startDate, setStartDate] = useState(todayStr());
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setProduct(d.product); setOutline(d.outline); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
    fetch("/api/me/athlete").then((r) => setSignedIn(r.ok)).catch(() => setSignedIn(false));
  }, [params.id]);

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function authenticate() {
    setBusy(true); setError(null);
    try {
      if (mode === "signup") {
        if (!agreed) throw new Error("Please agree to the Terms and Privacy Policy.");
        const res = await fetch("/api/athletes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't create your account.");
      }
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      const me = await fetch("/api/me/athlete");
      if (!me.ok) throw new Error("This login isn't set up as an athlete account.");
      setSignedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!product) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, start_date: startDate, weekdays: days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the program.");
      router.push("/app/programs");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">{loadError}</p></main>;
  if (!product) return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-slate-500">Loading…</p></main>;

  const needDays = product.days_per_week;
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/programs" className="text-sm text-slate-500 underline">All programs</Link>
      <h1 className="mt-4 text-3xl font-bold text-brand-dark">{product.title}</h1>
      <p className="mt-2 text-slate-600">{product.description}</p>
      <p className="mt-3 text-sm text-slate-500">
        {product.week_count} weeks · {product.days_per_week} days/week · {product.level === "comfortable" ? "for lifters comfortable with the basics" : product.level} · {priceLabel(product.price_cents, product.currency)}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-dark">What you need</h2>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-700 sm:grid-cols-2">
          {product.equipment.map((e) => <li key={e}>• {equipmentLabel(e)}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">You can swap any exercise for a similar one while you train if something isn&apos;t available.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-dark">How it&apos;s laid out</h2>
        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {outline.map((w) => (
            <div key={w.week_number} className="flex items-start justify-between gap-4 px-4 py-2">
              <span className="font-medium text-slate-700">Week {w.week_number}{w.week_type === "deload" ? " (lighter)" : w.week_type === "test" ? " (retest)" : ""}</span>
              <span className="text-right text-slate-500">{w.days.map((d) => d.day_label).join(" · ")}</span>
            </div>
          ))}
        </div>
        {product.tests.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Tested in weeks {product.tests[0].weeks.join(" and ")}: {product.tests.map((t) => t.label.toLowerCase()).join(", ")}.
          </p>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-slate-200 p-5">
        {signedIn === null && <p className="text-sm text-slate-500">Checking your account…</p>}

        {signedIn === false && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-dark">{mode === "signup" ? "Create your account" : "Log in"}</h2>
            {mode === "signup" && <input className={inputClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />}
            <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputClass} type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                <span>I agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</span>
              </label>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" onClick={authenticate} disabled={busy || !email || password.length < 8}
              className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Working…" : mode === "signup" ? "Create account and continue" : "Log in and continue"}
            </button>
            <button type="button" className="text-xs text-slate-500 underline" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }}>
              {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
            </button>
          </div>
        )}

        {signedIn === true && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-brand-dark">Set your schedule</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
              <input className={inputClass} type="date" min={todayStr()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Your {needDays} training days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, d) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${days.includes(d) ? "border-brand bg-blue-50 text-brand-dark" : "border-slate-200 text-slate-600"}`}>
                    {label.slice(0, 3)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {product.suggested_schedule ? `Suggested: ${product.suggested_schedule}. ` : ""}Keep your hardest lower-body day and your sprint day apart. You can move individual workouts later.
              </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" onClick={buy} disabled={busy || days.length !== needDays}
              className="w-full rounded-md bg-brand px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Setting up…" : product.price_cents === 0 ? "Get this program" : `Buy for ${priceLabel(product.price_cents, product.currency)}`}
            </button>
            {days.length !== needDays && <p className="text-xs text-slate-500">Choose exactly {needDays} days.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
