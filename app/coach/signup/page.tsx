"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export default function CoachSignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/coach-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, setup_code: setupCode }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);

      router.push("/coach");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-brand-dark">Create the coach account</h1>
      <p className="mt-1 text-sm text-slate-500">
        This is a one-time setup step. You&apos;ll need the setup code from your own <code>.env.local</code> (
        <code>COACH_SETUP_CODE</code>).
      </p>

      <div className="mt-6 space-y-3">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Setup code"
          value={setupCode}
          onChange={(e) => setSetupCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className={inputClass}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !email || !password || !setupCode}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Already have an account? <Link href="/login" className="text-brand underline">Log in</Link>.
      </p>
    </main>
  );
}
