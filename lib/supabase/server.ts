import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to the current request's auth cookies —
 * ANON key only, used exclusively to answer "who is making this request"
 * (supabase.auth.getUser()) in Server Components and Route Handlers.
 *
 * This is deliberately separate from getSupabaseAdmin() (lib/db/supabase-admin.ts):
 * that client uses the service-role key and does all of the app's actual data
 * reads/writes (bypassing RLS, since RLS isn't enabled on these tables yet —
 * see the note in supabase/migrations/0005_auth.sql). This one only ever
 * calls .auth.* methods against the signed-in user's own session.
 */
export function getSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component render, which can't set
            // cookies — middleware.ts refreshes the session cookie instead.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}
