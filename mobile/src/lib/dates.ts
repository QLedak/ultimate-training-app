/** Local-date helpers. The server stores plain YYYY-MM-DD dates. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function startOfWeekStr(s: string): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDate(s: string): string {
  const d = parseDateStr(s);
  return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
}

export function dowShort(s: string): string {
  return DOW[parseDateStr(s).getDay()];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function startOfMonthStr(s: string): string {
  const d = parseDateStr(s);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1, 12));
}

export function addMonthsStr(s: string, n: number): string {
  const d = parseDateStr(s);
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
}

export function monthTitle(s: string): string {
  const d = parseDateStr(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Whole weeks (Sun-Sat) covering the month that contains `s`. */
export function monthGridWeeks(s: string): string[][] {
  const first = startOfMonthStr(s);
  const f = parseDateStr(first);
  const last = new Date(f.getFullYear(), f.getMonth() + 1, 0, 12);
  const gridStart = startOfWeekStr(first);
  const weeks: string[][] = [];
  let cursor = gridStart;
  while (parseDateStr(cursor) <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
