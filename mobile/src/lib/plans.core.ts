/**
 * Plan catalog helpers (pure). Product shapes match GET /api/products and /api/products/:id.
 * The "coach-built season plan" is not a product row; it is a pinned card that starts intake.
 */
import { EQUIPMENT_OPTIONS } from "../shared/equipment-options";

export type Product = {
  id: string;
  title: string;
  description: string | null;
  days_per_week: number;
  week_count: number;
  level: string | null;
  price_cents: number;
  currency: string;
  equipment: string[];
  space?: string | null;
  suggested_schedule?: string | null;
  tests?: Array<{ key: string; label: string; unit: string; weeks: number[] }>;
};
export type OutlineWeek = { week_number: number; week_type: string; days: Array<{ day_label: string; exercise_count: number }> };

const EXTRA_LABELS: Record<string, string> = {
  sliders: "Sliders/gliders (or towels on a smooth floor)",
  turf_track: "Space to sprint (20+ yards)",
};
export const equipmentLabel = (tag: string) => EXTRA_LABELS[tag] ?? EQUIPMENT_OPTIONS.find((o) => o.value === tag)?.label ?? tag;

export function priceLabel(cents: number, currency = "usd"): string {
  if (!cents) return "Free during launch";
  const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return currency.toLowerCase() === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
}

export function levelLabel(level: string | null | undefined): string {
  if (!level) return "All levels";
  if (level === "comfortable") return "For lifters comfortable with the basics";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Weekday numbers match the server: 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DEFAULT_PLAN_DAYS = [1, 2, 4, 6]; // Mon, Tue, Thu, Sat

/** A sensible starting pick for N days: the default four, trimmed or topped up to the program's days per week. */
export function defaultDaysFor(daysPerWeek: number): number[] {
  const base = DEFAULT_PLAN_DAYS.slice(0, daysPerWeek);
  for (const d of [3, 5, 0]) if (base.length < daysPerWeek && !base.includes(d)) base.push(d);
  return base.sort((a, b) => a - b);
}

export function toggleWeekday(days: number[], d: number): number[] {
  return days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b);
}

export function daysProblem(days: number[], needed: number): string | null {
  return days.length === needed ? null : days.length < needed ? `Choose ${needed - days.length} more day${needed - days.length === 1 ? "" : "s"}.` : `Choose exactly ${needed} days.`;
}

export function weekTypeNote(t: string): string {
  return t === "deload" ? " (lighter)" : t === "test" ? " (retest)" : "";
}

/** Short facts line for catalog cards. */
export function factsLine(p: Pick<Product, "week_count" | "days_per_week" | "level">): string {
  return `${p.week_count} weeks · ${p.days_per_week} days/week · ${levelLabel(p.level)}`;
}

/** What the coach-built season plan offers, shown as marketing on its card and detail screen. */
export const COACH_PLAN = {
  title: "Your season plan, built for you",
  tagline: "A full season of training built around your calendar, your equipment and your body, reviewed by your coach.",
  bullets: [
    "Planned backwards from your tournaments and game nights, so you peak when it counts",
    "Phases that build speed, strength and conditioning, and lighten up around games",
    "Built with your equipment, your space and your injury history in mind",
    "Your coach reviews every plan before you see it",
    "Update your schedule, equipment or injuries any time and ask for a rebuild",
    "Log every workout; the app adjusts weights from how sessions actually feel",
  ],
  how: [
    "Create your free account",
    "Answer the intake (about 5 minutes)",
    "Your coach builds and reviews your season plan",
    "Your workouts show up in the app",
  ],
  price: "Free during launch",
} as const;
