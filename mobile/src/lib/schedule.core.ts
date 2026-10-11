/**
 * Season schedule helpers (pure, no React Native imports so they can be unit tested).
 * Shapes match the website: intake stores snake_case keys and weekday names like "Monday".
 */
export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type Tournament = { start_date: string; end_date: string; label: string; is_priority: boolean };
export type Commitment = { day_of_week: string; time: string; label: string; start_date: string; end_date: string };

export const blankTournament = (): Tournament => ({ start_date: "", end_date: "", label: "", is_priority: false });
export const blankCommitment = (): Commitment => ({ day_of_week: "", time: "", label: "League game", start_date: "", end_date: "" });

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTournaments(raw: unknown): Tournament[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: any) => ({
    start_date: String(t?.start_date ?? ""),
    end_date: String(t?.end_date ?? ""),
    label: String(t?.label ?? ""),
    is_priority: !!t?.is_priority,
  }));
}

export function normalizeCommitments(raw: unknown): Commitment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => ({
    day_of_week: String(c?.day_of_week ?? ""),
    time: String(c?.time ?? ""),
    label: String(c?.label ?? ""),
    // Older rows may have been saved camelCase.
    start_date: String(c?.start_date ?? c?.startDate ?? ""),
    end_date: String(c?.end_date ?? c?.endDate ?? ""),
  }));
}

/** Only one tournament can be the season's priority event. */
export function setPriorityTournament(list: Tournament[], index: number): Tournament[] {
  return list.map((t, i) => ({ ...t, is_priority: i === index ? !t.is_priority : false }));
}

/** True when a recurring commitment will be treated as a game/league day by the program builder. */
export function isGameLabel(label: string): boolean {
  return /\b(league|game|games)\b/i.test(label);
}

/** Quick checks so the athlete sees a plain message before the server's. Returns null when fine. */
export function validateScheduleForm(f: { season_start: string; season_end: string; tournaments: Tournament[]; commitments: Commitment[] }): string | null {
  if (!ISO.test(f.season_start) || !ISO.test(f.season_end)) return "Set both a season start and a season end date.";
  if (f.season_end < f.season_start) return "Your season can't end before it starts.";
  for (const [i, t] of f.tournaments.entries()) {
    const n = i + 1;
    if (!ISO.test(t.start_date) || !ISO.test(t.end_date)) return `Tournament ${n}: set a start and end date, or remove it.`;
    if (t.end_date < t.start_date) return `Tournament ${n}: it can't end before it starts.`;
  }
  for (const [i, c] of f.commitments.entries()) {
    const n = i + 1;
    if (!c.day_of_week) return `Weekly commitment ${n}: choose a day, or remove it.`;
    if (c.start_date && c.end_date && c.end_date < c.start_date) return `Weekly commitment ${n}: its end date is before its start date.`;
  }
  return null;
}

/** Payload for PATCH /schedule: blank optional dates become null; rows with no day are dropped by validation first. */
export function commitmentsPayload(list: Commitment[]) {
  return list.map((c) => ({
    day_of_week: c.day_of_week,
    time: c.time,
    label: c.label.trim() || "League game",
    start_date: c.start_date || null,
    end_date: c.end_date || null,
  }));
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parses YYYY-MM-DD as a LOCAL date (new Date("2026-10-11") would be UTC and can land on the previous day). */
export function fromIso(s: string): Date | null {
  if (!ISO.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fromHHMM(s: string): Date | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export function prettyTime(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
