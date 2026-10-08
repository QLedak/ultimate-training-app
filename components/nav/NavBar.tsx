"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type NavLink = { href: string; label: string };

/**
 * Shared top nav for both the athlete and coach sections. One component,
 * two roles — the only differences are the links passed in and the brand
 * label, so the two experiences stay visually consistent instead of
 * drifting into two different UIs over time.
 *
 * Active-link matching is prefix-based (with an exact match for the
 * homepage itself) so a nested route like /app/log/abc123 still highlights
 * the "Log" link.
 */
export function NavBar({
  role,
  name,
  links,
}: {
  role: "athlete" | "coach";
  name: string | null;
  links: NavLink[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/app" || href === "/coach") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="mb-8 border-b border-slate-200">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {role === "coach" ? "Coach" : "Athlete"}
          </span>
          <nav className="flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive(link.href)
                    ? "text-sm font-medium text-brand"
                    : "text-sm font-medium text-slate-500 hover:text-brand-dark"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {name && <span className="hidden text-sm text-slate-500 sm:inline">{name}</span>}
          <button type="button" onClick={logout} className="text-xs text-slate-400 underline">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
