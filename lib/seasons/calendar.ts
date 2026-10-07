export type TournamentWeekend = { start_date?: string; end_date?: string; label?: string; is_priority?: boolean };
export type RecurringCommitment = { day_of_week?: string; time?: string; label?: string };

export type SeasonCalendarInput = {
  season_start?: string | null;
  season_end?: string | null;
  recurring_commitments?: unknown[];
  tournament_weekends?: unknown[];
  season_calendar_confirmed?: boolean;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS);
}

/**
 * Validation shared by the athlete's schedule edit and the "plan next season"
 * flow. Returns a human-readable error string, or null when the calendar is OK.
 *
 * `opts.requireFuture`: season_start must be after `today` (next-season plans).
 * `opts.mustStartAfter`: season_start must be after this date (the end of the
 * season currently running, so two seasons can never overlap).
 */
export function validateSeasonCalendar(
  input: SeasonCalendarInput,
  opts: { today?: string; requireFuture?: boolean; mustStartAfter?: string | null } = {}
): string | null {
  const today = opts.today ?? todayISO();
  const { season_start: start, season_end: end } = input;

  if (start && !ISO.test(start)) return "Season start isn't a valid date.";
  if (end && !ISO.test(end)) return "Season end isn't a valid date.";
  if ((start && !end) || (!start && end)) return "Enter both a season start and a season end date.";

  if (start && end) {
    if (end <= start) return "Season end must be after season start.";
    if (dayDiff(start, end) > 400) return "That season is longer than a year — double-check your dates.";
    if (opts.requireFuture && start <= today) return "Season start needs to be a future date.";
    if (opts.mustStartAfter && start <= opts.mustStartAfter) {
      return `Your next season has to start after your current one ends (${opts.mustStartAfter}).`;
    }
  }

  const tournaments = (input.tournament_weekends ?? []) as TournamentWeekend[];
  let priorityCount = 0;
  for (const t of tournaments) {
    if (t.is_priority) priorityCount++;
    if (t.start_date && !ISO.test(t.start_date)) return "A tournament has an invalid start date.";
    if (t.end_date && !ISO.test(t.end_date)) return "A tournament has an invalid end date.";
    if (t.start_date && t.end_date && t.end_date < t.start_date) {
      return `Tournament${t.label ? ` "${t.label}"` : ""} ends before it starts.`;
    }
    if (start && end && t.start_date && (t.start_date < start || t.start_date > end)) {
      return `Tournament${t.label ? ` "${t.label}"` : ""} falls outside your season dates.`;
    }
  }
  if (priorityCount > 1) return "Only one tournament can be marked as your priority event.";
  return null;
}

/** A season is "over" once its end date has passed (or there are no dates and it's a bridge). */
export function isSeasonOver(seasonEnd: string | null | undefined, today = todayISO()): boolean {
  return !!seasonEnd && seasonEnd < today;
}

export function suggestSeasonLabel(seasonStart: string | null | undefined): string {
  return seasonStart ? seasonStart.slice(0, 4) : String(new Date().getUTCFullYear());
}
