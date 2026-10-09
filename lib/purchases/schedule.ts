/**
 * Dates for a purchased program's sessions. Sessions are laid out in
 * program order (week 1 day 1, week 1 day 2, ...) onto the next matching
 * training weekdays starting at startDate. With weekdays [Mon, Tue, Thu, Sat]
 * and a Monday start, week 1 lands Mon/Tue/Thu/Sat, week 2 the next Mon/...,
 * exactly as expected; a mid-week start just begins at the next chosen day.
 */
export function scheduleDates(startDate: string, weekdays: number[], count: number): string[] {
  const set = new Set(weekdays);
  if (set.size === 0) throw new Error("At least one training weekday is required.");
  const out: string[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  while (out.length < count) {
    if (set.has(cur.getUTCDay())) out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function validateSchedule(
  startDate: unknown,
  weekdays: unknown,
  daysPerWeek: number,
  today = new Date().toISOString().slice(0, 10)
): { ok: true; startDate: string; weekdays: number[] } | { ok: false; error: string } {
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate))) {
    return { ok: false, error: "start_date (YYYY-MM-DD) is required." };
  }
  if (startDate < today) return { ok: false, error: "The start date can't be in the past." };
  const max = new Date(`${today}T00:00:00Z`);
  max.setUTCFullYear(max.getUTCFullYear() + 1);
  if (startDate > max.toISOString().slice(0, 10)) return { ok: false, error: "Pick a start date within the next year." };
  if (!Array.isArray(weekdays)) return { ok: false, error: "Choose your training days." };
  const days = Array.from(new Set(weekdays.map(Number)));
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { ok: false, error: "Invalid training day." };
  if (days.length !== daysPerWeek) return { ok: false, error: `This program has ${daysPerWeek} training days a week; choose exactly ${daysPerWeek}.` };
  return { ok: true, startDate, weekdays: days.sort((a, b) => a - b) };
}
