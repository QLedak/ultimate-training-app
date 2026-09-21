import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths under these prefixes require SOME signed-in user (coach or athlete —
// which one is checked at the page/API level, not here). Login/signup pages
// are intentionally left off the matcher below entirely, except coach
// signup, which shares a prefix with protected coach pages and needs an
// explicit carve-out. There's a single unified login at /login for both
// roles now, so no equivalent carve-out is needed on the athlete side.
const COACH_PUBLIC_PATHS = ["/coach/signup"];

/**
 * Auth gate — Pass 1 of authorization (see the two-pass plan: this pass adds
 * real login/signup and keeps people out of pages meant for a signed-in
 * user; Pass 2 will additionally lock down the underlying API routes to
 * verify the caller owns the specific athlete/draft/session they're asking
 * about, not just that they're logged in as *someone*).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Refreshes the session token if it's expired — must run on every matched
  // request even when we don't otherwise need the result.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isCoachPublicPath = COACH_PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isCoachPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // /app/intake is deliberately NOT matched — it's the athlete signup flow
  // and must be reachable by someone with no account yet. /app itself (the
  // new athlete homepage) IS matched, alongside its existing sub-pages.
  matcher: ["/app", "/app/log/:path*", "/review/:path*", "/coach/:path*"],
};
