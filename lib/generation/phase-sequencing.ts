/**
 * Deterministic macrocycle phase-boundary computation.
 *
 * Per the coach's own rule (superseding the old model-driven "size the
 * phases however seems right" approach): every phase defaults to 4 weeks.
 * Working BACKWARD from a peak date, the standard cycle is
 *   Hypertrophy -> Max Strength -> Power Conversion -> Peak Taper
 * repeating the middle two as many times as the available time calls for.
 * GPP/Reacclimation only ever appears as the very first block of a fresh
 * off-season build (right after the athlete's prior season ended) — never
 * mid-cycle, never as a repeatable block.
 *
 * Doing this in code instead of asking the model to do backward date math
 * across many phases matches the existing guardrail pattern in this file's
 * neighbors (assertPhase1StartsOnTrainingStartDate, assertCompleteWeeks in
 * lib/generation/phase.ts) — the model still writes phase_name,
 * weekly_template_label, deload_test_note and the rationale/flags, but the
 * phase_number/goal/start_date/end_date/week_count skeleton is computed
 * here and only asserted-matched for a fresh (non-rebuild) build, same as
 * those other guardrails.
 */

export type PhaseGoal =
  | "gpp_reacclimation"
  | "hypertrophy"
  | "max_strength"
  | "power_conversion"
  | "peak_taper";

export type ComputedPhase = {
  goal: PhaseGoal;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD, inclusive
  week_count: number;
};

const WEEK_DAYS = 7;
// The repeatable cycle, in BACKWARD priority order — i.e. reading this list
// left-to-right is the order blocks get ADDED working back from the peak,
// so when the available time doesn't cover a full cycle, whatever's left
// unfilled is always Hypertrophy (index 2, lowest priority) first, then Max
// Strength (index 1) — never Power Conversion, which sits closest to the
// peak and is filled first. A full cycle still reads, forward, as
// Hypertrophy -> Max Strength -> Power Conversion.
const BACKWARD_CYCLE: PhaseGoal[] = ["power_conversion", "max_strength", "hypertrophy"];

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * 24 * 60 * 60 * 1000));
}
/** Number of days from `fromIso` to `toIso` (toIso - fromIso). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

type BlockOpts = { includeGppAtStart: boolean; endsInPeakTaper: boolean };
type BlockResult = { phases: ComputedPhase[]; flags: string[] };

/**
 * Fills the span [fromDate, toDate) — toDate is EXCLUSIVE, i.e. the day
 * some fixed anchor (season_start, a priority tournament, season_end + 1)
 * itself belongs to whatever comes next, not to the last block built here.
 *
 * Sequence (forward order): [gpp_reacclimation?] -> repeating
 * Hypertrophy/Max Strength/Power Conversion cycle -> [peak_taper].
 * Leftover weeks that don't divide evenly into 4-week blocks are absorbed
 * into the first Hypertrophy block, then the first Max Strength block
 * (per the coach's own instruction) rather than left as an odd trailing
 * block or forcing the fixed peak date to move.
 */
export function computeBackwardBlocks(fromDate: string, toDate: string, opts: BlockOpts): BlockResult {
  const flags: string[] = [];
  const totalDays = daysBetween(fromDate, toDate);
  if (totalDays <= 0) return { phases: [], flags };

  const totalWeeks = Math.floor(totalDays / WEEK_DAYS);
  const calendarSlopDays = totalDays - totalWeeks * WEEK_DAYS; // 0-6 days, absorbed into the last phase below

  // Window shorter than a single 4-week block: collapse into one compressed
  // block rather than push the fixed peak date later than it actually is.
  if (opts.endsInPeakTaper && totalWeeks < 4) {
    if (opts.includeGppAtStart) {
      flags.push(
        "Window is under 4 weeks — collapsed straight into a single compressed peak block; GPP skipped."
      );
    } else {
      flags.push("Window is under 4 weeks — collapsed into a single compressed peak block.");
    }
    return {
      phases: [
        {
          goal: "peak_taper",
          start_date: fromDate,
          end_date: addDays(toDate, -1),
          week_count: Math.max(1, Math.ceil(totalDays / WEEK_DAYS)),
        },
      ],
      flags,
    };
  }

  let includeGpp = opts.includeGppAtStart;
  let remainingWeeks = totalWeeks - (opts.endsInPeakTaper ? 4 : 0);

  if (includeGpp && remainingWeeks < 4) {
    includeGpp = false;
    flags.push(
      "Not enough room to fit a 4-week GPP block ahead of the standard progression without shorting it — " +
        "GPP skipped, straight into Hypertrophy."
    );
  }
  if (includeGpp) remainingWeeks -= 4;

  const cycleBlockCount = Math.max(0, Math.floor(remainingWeeks / 4));
  const leftoverWeeks = Math.max(0, remainingWeeks - cycleBlockCount * 4); // 0-3 weeks

  // Build the cycle portion working BACKWARD from the peak (index 0 =
  // closest to the peak = highest priority), then reverse it into forward
  // chronological order — so a partial final cycle (furthest back in time,
  // closest to GPP/training start) always drops Hypertrophy/Max Strength
  // before Power Conversion, never the other way around.
  const backwardCycleGoals: PhaseGoal[] = [];
  for (let i = 0; i < cycleBlockCount; i++) backwardCycleGoals.push(BACKWARD_CYCLE[i % BACKWARD_CYCLE.length]);
  const forwardCycleGoals = [...backwardCycleGoals].reverse();

  const goals: PhaseGoal[] = [];
  if (includeGpp) goals.push("gpp_reacclimation");
  goals.push(...forwardCycleGoals);
  if (opts.endsInPeakTaper) goals.push("peak_taper");

  // Degenerate case: no GPP, no taper, and not even one full 4-week cycle
  // block fits (e.g. a short in-season stretch between two other anchored
  // blocks). Rather than schedule nothing and leave a real gap in the
  // athlete's days, fall back to a single compressed block covering the
  // whole window.
  if (goals.length === 0) {
    flags.push(
      `Window (${totalWeeks} week(s)) is under a full 4-week block and has no GPP/Peak Taper anchor — ` +
        "compressed into a single Power Conversion maintenance block rather than leaving a scheduling gap."
    );
    return {
      phases: [
        {
          goal: "power_conversion",
          start_date: fromDate,
          end_date: addDays(toDate, -1),
          week_count: Math.max(1, Math.ceil(totalDays / WEEK_DAYS)),
        },
      ],
      flags,
    };
  }

  const blockWeeks = goals.map(() => 4);

  // Absorb leftover weeks: first Hypertrophy, then first Max Strength, per
  // the coach's own instruction ("extra weeks can be absorbed by
  // hypertrophy and max strength") — falling back, in order, to GPP, Peak
  // Taper, or finally whatever the last scheduled block is, so leftover
  // time is NEVER simply dropped (that would leave a real gap in the
  // athlete's schedule).
  let remainingLeftover = leftoverWeeks;
  const absorbInto = (goal: PhaseGoal): boolean => {
    if (remainingLeftover <= 0) return true;
    const idx = goals.indexOf(goal);
    if (idx === -1) return false;
    blockWeeks[idx] += remainingLeftover;
    remainingLeftover = 0;
    return true;
  };
  const absorbed =
    absorbInto("hypertrophy") ||
    absorbInto("max_strength") ||
    absorbInto("gpp_reacclimation") ||
    absorbInto("peak_taper");
  if (!absorbed && remainingLeftover > 0) {
    // Guaranteed fallback — the last scheduled block always exists here
    // since goals.length > 0 at this point.
    blockWeeks[blockWeeks.length - 1] += remainingLeftover;
    remainingLeftover = 0;
  }
  if (leftoverWeeks > 0) {
    flags.push(
      `${leftoverWeeks} leftover week(s) didn't divide evenly into 4-week blocks — absorbed into an ` +
        "adjacent block rather than left as an odd-length phase of its own."
    );
  }

  const phases: ComputedPhase[] = [];
  let cursor = fromDate;
  for (let i = 0; i < goals.length; i++) {
    // The very last phase also absorbs the 0-6 day calendar slop, so it
    // ends exactly the day before toDate.
    const isLast = i === goals.length - 1;
    const days = blockWeeks[i] * WEEK_DAYS + (isLast ? calendarSlopDays : 0);
    const start = cursor;
    const end = addDays(start, days - 1);
    phases.push({ goal: goals[i], start_date: start, end_date: end, week_count: Math.ceil(days / WEEK_DAYS) });
    cursor = addDays(start, days);
  }

  return { phases, flags };
}

/**
 * The in-season portion: normally one continuous maintenance stretch
 * (reusing the same four cycle goals, dosed at in-season/maintenance
 * volume per the Coaching Philosophy's in-season rules — no reserved
 * ending block, since there's no peak to build to). If the athlete flagged
 * a priority tournament, it gets treated as a second peak: the same
 * backward-block logic runs from season_start to that tournament date
 * (ending in its own peak_taper), then the remainder of the season (if
 * any) falls back to generic in-season maintenance.
 */
export function computeInSeasonPhases(
  fromDate: string,
  seasonEnd: string,
  priorityTournamentDate?: string | null
): BlockResult {
  const seasonEndExclusive = addDays(seasonEnd, 1);

  if (
    priorityTournamentDate &&
    priorityTournamentDate > fromDate &&
    priorityTournamentDate <= seasonEnd
  ) {
    const preTournamentEnd = addDays(priorityTournamentDate, 1); // exclusive
    const pre = computeBackwardBlocks(fromDate, preTournamentEnd, {
      includeGppAtStart: false,
      endsInPeakTaper: true,
    });

    const dayAfterTournament = addDays(priorityTournamentDate, 1);
    let post: BlockResult = { phases: [], flags: [] };
    if (daysBetween(dayAfterTournament, seasonEndExclusive) > 0) {
      post = computeBackwardBlocks(dayAfterTournament, seasonEndExclusive, {
        includeGppAtStart: false,
        endsInPeakTaper: false,
      });
    }
    return { phases: [...pre.phases, ...post.phases], flags: [...pre.flags, ...post.flags] };
  }

  if (daysBetween(fromDate, seasonEndExclusive) <= 0) return { phases: [], flags: [] };
  return computeBackwardBlocks(fromDate, seasonEndExclusive, {
    includeGppAtStart: false,
    endsInPeakTaper: false,
  });
}

/**
 * Full sequence for whatever portion of the season still needs planning:
 * - Fresh build (resumeDate before season_start): off-season backward-fill
 *   (optionally opening with GPP) ending in Peak Taper right before
 *   season_start, then the in-season portion through season_end.
 * - A rebuild resuming mid-season (resumeDate on/after season_start): only
 *   the remaining in-season portion is (re)computed — past/completed
 *   phases are preserved separately by the caller, never replanned here.
 */
export function computeMacrocyclePhaseSequence(input: {
  resumeDate: string;
  seasonStart: string;
  seasonEnd: string;
  priorityTournamentDate?: string | null;
  includeGpp: boolean;
}): BlockResult {
  const { resumeDate, seasonStart, seasonEnd, priorityTournamentDate, includeGpp } = input;

  if (resumeDate < seasonStart) {
    const offSeason = computeBackwardBlocks(resumeDate, seasonStart, {
      includeGppAtStart: includeGpp,
      endsInPeakTaper: true,
    });
    const inSeason = computeInSeasonPhases(seasonStart, seasonEnd, priorityTournamentDate);
    return { phases: [...offSeason.phases, ...inSeason.phases], flags: [...offSeason.flags, ...inSeason.flags] };
  }

  if (resumeDate > seasonEnd) {
    return { phases: [], flags: ["Resume date is after season_end — nothing left to schedule this season."] };
  }

  return computeInSeasonPhases(resumeDate, seasonEnd, priorityTournamentDate);
}
