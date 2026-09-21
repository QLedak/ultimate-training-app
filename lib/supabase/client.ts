"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (ANON key) — the only client that should ever
 * call supabase.auth.signInWithPassword / signUp / signOut, since those need
 * to run where the resulting session cookie can actually be set in the
 * user's browser. Server code never signs users in directly.
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
