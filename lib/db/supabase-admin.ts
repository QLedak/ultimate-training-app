import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key — bypasses row-level
 * security. Use this ONLY in server-side code (API routes, scripts) that
 * needs to write across athletes (seeding, corpus writes, the app's own
 * background jobs like compiling a Phase Performance Summary). Never import
 * this into anything that ships to the browser.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Copy .env.local.example to .env.local and fill in your Supabase project's values."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
