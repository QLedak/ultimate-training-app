"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Product = {
  id: string; title: string; description: string | null; days_per_week: number; week_count: number;
  level: string | null; price_cents: number; currency: string;
};

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Free during launch";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function ProgramsCatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setProducts(d.products); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-slate-500 underline">Home</Link>
      <h1 className="mt-4 text-3xl font-bold text-brand-dark">Training programs</h1>
      <p className="mt-2 text-slate-600">
        Stand-alone programs you buy once and follow in the app, with the same logging, rest timers and exercise
        swaps as a coached season.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {products === null && !error && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {products?.length === 0 && <p className="mt-6 text-sm text-slate-500">No programs available yet. Check back soon.</p>}
      <div className="mt-6 space-y-4">
        {products?.map((p) => (
          <Link key={p.id} href={`/programs/${p.id}`} className="block rounded-lg border border-slate-200 p-5 hover:border-brand">
            <h2 className="text-lg font-semibold text-brand-dark">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.description}</p>
            <p className="mt-3 text-xs text-slate-500">
              {p.week_count} weeks · {p.days_per_week} days/week · {formatPrice(p.price_cents, p.currency)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
