"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

/**
 * The single login screen for both athletes and coaches. There's no role
 * picker — after signing in, GET /api/me looks up which table (if either)
 * the account is linked to and sends the person to the matching homepage.
 * A `redirectTo` query param (set by middleware.ts when it bounces an
 * unauthenticated request) takes priority over the role default so a coach
 * bounced off /review lands back on /review, not on /coach.
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      const res = await fetch("/api/me");
      const data = await res.json();
      if (data.role === "coach") {
        router.push("/coach");
      } else if (data.role === "athlete") {
        router.push("/app");
      } else {
        // Signed in, but not linked to an athlete or coach row yet — most
        // likely someone who created a login but never finished intake.
        router.push("/app/intake");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-brand-dark">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">Athlete or coach — same login, we&apos;ll take you to the right place.</p>

      <div className="mt-6 space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className={inputClass}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-slate-500 underline">
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !email || !password}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Athlete, new here? <Link href="/app/intake" className="text-brand underline">Start your intake</Link>.
        <br />
        Coach, setting up for the first time? <Link href="/coach/signup" className="text-brand underline">Create the coach account</Link>.
      </p>

      <p className="mt-4 text-xs text-slate-400">
        <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </main>
  );
}
