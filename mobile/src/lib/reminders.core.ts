/**
 * Workout reminder planning (pure logic, no React Native imports so it can be unit tested).
 * Given the upcoming sessions and the athlete's settings, decides which local
 * notifications to schedule. One reminder per training day, at their chosen time,
 * skipping days already logged and times already past.
 */
export type ReminderSettings = { enabled: boolean; hour: number; minute: number };
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 17, minute: 0 };

export type UpcomingSession = {
  date: string; // YYYY-MM-DD, athlete's local date
  day_label: string;
  exercise_count: number;
  status: "completed" | "partially_completed" | "skipped" | null;
};

export type PlannedReminder = { date: string; fireAt: Date; title: string; body: string };

/** iOS keeps at most 64 pending local notifications; stay well under it. */
export const MAX_REMINDERS = 30;

export function clampTime(hour: number, minute: number): { hour: number; minute: number } {
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  const m = Math.min(59, Math.max(0, Math.round(minute)));
  return { hour: h, minute: m };
}

export function formatReminderTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function planReminders(sessions: UpcomingSession[], settings: ReminderSettings, now: Date): PlannedReminder[] {
  if (!settings.enabled) return [];
  const { hour, minute } = clampTime(settings.hour, settings.minute);

  // Group by day; a day is done when every session on it has been logged or skipped.
  const byDate = new Map<string, UpcomingSession[]>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const out: PlannedReminder[] = [];
  for (const date of Array.from(byDate.keys()).sort()) {
    const day = byDate.get(date)!;
    const todo = day.filter((s) => !s.status);
    if (todo.length === 0) continue;

    const [y, m, d] = date.split("-").map(Number);
    const fireAt = new Date(y, m - 1, d, hour, minute, 0, 0);
    if (fireAt.getTime() <= now.getTime()) continue;

    const names = todo.map((s) => s.day_label);
    const title = todo.length === 1 ? `Workout today: ${names[0]}` : `${todo.length} workouts today`;
    const body = todo.length === 1 ? `${todo[0].exercise_count} exercises. Tap to start.` : `${names.join(" + ")}. Tap to start.`;
    out.push({ date, fireAt, title, body });
  }
  return out.slice(0, MAX_REMINDERS);
}
