/**
 * Icon per workout type, matched on the free-text day_label. Same rules as the
 * website calendar (app/app/log/page.tsx) plus the sprint/acceleration program
 * days. First match wins, most specific first.
 */
const RULES: { match: RegExp; icon: string; title: string }[] = [
  { match: /lower body power|impulse/i, icon: "💥", title: "Lower body power" },
  { match: /hypertrophy/i, icon: "🏋️", title: "Hypertrophy" },
  { match: /game|tournament/i, icon: "🥏", title: "Game" },
  { match: /\brest\b/i, icon: "😴", title: "Rest" },
  { match: /upper/i, icon: "💪", title: "Upper body" },
  { match: /lower/i, icon: "🦵", title: "Lower body" },
  { match: /speed|plyo|reactive|sprint|accelerat/i, icon: "🏃", title: "Speed / plyo" },
  { match: /energy|conditioning/i, icon: "🔥", title: "Energy system" },
  { match: /athlete/i, icon: "⚡", title: "Athlete day" },
];

export function workoutIcon(dayLabel: string): { icon: string; title: string } {
  for (const r of RULES) if (r.match.test(dayLabel)) return { icon: r.icon, title: r.title };
  return { icon: "🏋️", title: dayLabel };
}
