import { getAnthropicClient, CLAUDE_MODEL } from "../anthropic-client";
import { getSystemPrompts } from "./extract-system-prompts";
import {
  getCoachingPhilosophy,
  getTrainingTargetsReference,
  getDayStructureTemplates,
} from "./static-content";
import { getPrimaryReferenceProgramSummary } from "../corpus/fallback-examples";

// Mirrors the "submit_macrocycle_skeleton" shape stored in macrocycle_phases.
// Forcing tool use (rather than parsing free text) is what makes this
// reliably storable — see the Anthropic docs on tool use / structured output.
const SKELETON_TOOL = {
  name: "submit_macrocycle_skeleton",
  description:
    "Submit the completed macrocycle skeleton for this athlete's season.",
  input_schema: {
    type: "object" as const,
    properties: {
      rationale: {
        type: "string",
        description: "3-5 sentences on how the schedule shaped these phase boundaries.",
      },
      flags: {
        type: "array",
        items: { type: "string" },
        description: "Schedule conflicts resolved, or assumptions made due to incomplete info.",
      },
      phases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phase_number: { type: "integer" },
            phase_name: { type: "string" },
            goal: {
              type: "string",
              enum: [
                "gpp_reacclimation",
                "hypertrophy",
                "max_strength",
                "power_conversion",
                "peak_taper",
                "injury_return",
                "testing_block",
              ],
            },
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
            week_count: { type: "integer" },
            weekly_template_label: {
              type: "string",
              description:
                "A generic label built from the DAY STRUCTURE TEMPLATES' six fixed day types " +
                "(Lower Body Strength, Upper Body Strength, Athlete Day, Impulse Day, Hypertrophy " +
                "Day, Energy System Day) — e.g. 'Lower/Upper/Athlete (3-day)' or 'Lower/Upper/" +
                "Athlete/Impulse/Hypertrophy/Energy System (6-day)'. Every template, at every phase, " +
                "includes exactly the athlete's days/week worth of day types taken in that fixed " +
                "priority order — never an Upper/Lower-only or full-body-pattern split, and never " +
                "the primary reference program's own '4A'/'4B'/day-letter names, which describe an " +
                "older split this app no longer uses.",
            },
            deload_test_note: { type: "string" },
          },
          required: [
            "phase_number",
            "phase_name",
            "goal",
            "start_date",
            "end_date",
            "week_count",
            "weekly_template_label",
          ],
        },
      },
    },
    required: ["rationale", "flags", "phases"],
  },
};

export type MacrocyclePlannerInput = {
  intake: Record<string, unknown>;
  isRebuild?: boolean;
  rebuildReason?: string;
  priorSkeletonPhases?: Record<string, unknown>[]; // for a rebuild: past/completed phases to preserve
  // The exact calendar date (YYYY-MM-DD) Phase 1 must start on — training
  // begins the day after the athlete signs up, full stop, regardless of
  // when their competitive season falls. See lib/generation/macrocycle.ts:
  // always computed as tomorrow relative to when this call actually runs,
  // never left for the model to infer (and never taken from the athlete's
  // stated season_start — see the prompt section this drives for why those
  // are different dates).
  trainingStartDate?: string;
  // The deterministic 4-week-block phase skeleton computed by
  // lib/generation/phase-sequencing.ts — phase_number/goal/start_date/
  // end_date/week_count for every phase this call needs to plan. When
  // present, the model's only job per phase is phase_name,
  // weekly_template_label, and deload_test_note (plus the overall
  // rationale/flags); phase boundaries themselves are fixed by the app.
  // Absent when season_start isn't available/confirmed yet, in which case
  // the old prose-only fallback guidance applies instead.
  computedPhases?: Array<{
    phase_number: number;
    goal: string;
    start_date: string;
    end_date: string;
    week_count: number;
  }>;
  computedPhaseFlags?: string[];
  // Set both to regenerate an edited version of an existing draft (the
  // "chat edit" path in review-approval-flow-spec.md) instead of a fresh v1.
  currentDraftOutput?: MacrocyclePlannerOutput;
  editRequest?: string;
};

export type MacrocyclePlannerOutput = {
  rationale: string;
  flags: string[];
  phases: Array<{
    phase_number: number;
    phase_name: string;
    goal: string;
    start_date: string;
    end_date: string;
    week_count: number;
    weekly_template_label: string;
    deload_test_note?: string;
  }>;
};

export async function runMacrocyclePlanner(
  input: MacrocyclePlannerInput
): Promise<MacrocyclePlannerOutput> {
  const { planner: systemPrompt } = getSystemPrompts();
  const coachingPhilosophy = getCoachingPhilosophy();
  const primaryReferenceProgram = getPrimaryReferenceProgramSummary();
  const dayStructureTemplates = getDayStructureTemplates();
  const daysPerWeek = (input.intake as Record<string, unknown> | undefined)?.[
    "training_days_per_week"
  ] as number | undefined;

  const userMessage = [
    "# COACHING PHILOSOPHY",
    coachingPhilosophy,
    "",
    "# DAY STRUCTURE TEMPLATES (six fixed day types — governs weekly_template_label and phase structure)",
    daysPerWeek
      ? `This athlete trains ${daysPerWeek} days/week. Every phase's weekly_template_label must reflect ` +
        `exactly the first ${daysPerWeek} day types from the priority-order table below (Lower Body ` +
        `Strength, Upper Body Strength, Athlete Day, Impulse Day, Hypertrophy Day, Energy System Day, in ` +
        `that order) — the same fixed set at every phase in this skeleton, not a different split shape per ` +
        `phase. A league/game day satisfies the Energy System day's role and is never counted as one of ` +
        `the athlete's chosen training days.`
      : "Every phase's weekly_template_label must reflect exactly the athlete's days/week worth of day " +
        "types from the priority-order table below, taken in that fixed order — the same fixed set at " +
        "every phase, not a different split shape per phase.",
    dayStructureTemplates,
    "",
    "# PRIMARY REFERENCE PROGRAM SUMMARY",
    "IMPORTANT: this coach's own real program below predates the current methodology. Its structural " +
      "conventions (deload/test placement anchored to phase boundaries, contrast/complex labeling, wave " +
      "loading notation, alternating exercises week-to-week, sport-specific day-renaming during taper) " +
      "still apply and should inform this skeleton. Its weekly template shapes and day labels — '4A'/" +
      "'4B', 'Lower A/Upper B/Speed-Plyo/Lower C/Upper D' — do NOT apply and must not appear in or shape " +
      "weekly_template_label; use the DAY STRUCTURE TEMPLATES above for that instead.",
    primaryReferenceProgram,
    "",
    "# TRAINING TARGETS REFERENCE",
    getTrainingTargetsReference(),
    "",
    "# ATHLETE INTAKE",
    JSON.stringify(input.intake, null, 2),
    ...(input.trainingStartDate && !input.computedPhases
      ? [
          "",
          "# TRAINING START DATE vs. COMPETITIVE SEASON — READ CAREFULLY",
          `Phase 1's start_date MUST be exactly ${input.trainingStartDate} — training begins the day ` +
            "after the athlete signed up, always, regardless of anything on their intake calendar. This is " +
            "not a floor or a suggestion; it is the literal start_date value for phase_number 1.",
          "",
          "The athlete's `season_start` / `season_end` fields on intake describe their COMPETITIVE ultimate " +
            "season — when they're playing games/tournaments — NOT a training start date. Never use " +
            "season_start as Phase 1's start_date. Instead, treat season_start itself as the PEAK TARGET the " +
            "periodization builds toward: size and sequence the phases between Phase 1's start (" +
            `${input.trainingStartDate}) and season_start so the athlete reaches in-season-ready condition ` +
            "(appropriate power-conversion/peaking emphasis, per the Coaching Philosophy's GPP-to-SPP " +
            "progression) right around season_start, then shift phase goals/emphasis to in-season maintenance " +
            "(per the Coaching Philosophy's in-season rules) from season_start through season_end. Any " +
            "`tournament_weekends` (including one marked `is_priority`) are schedule anchors for THIS purpose " +
            "only — feed them into the day-before/day-of-game rule and into how much in-season volume/" +
            "conditioning a given week can carry, per the Coaching Philosophy's tournament-weekend " +
            "conditioning note — but do not treat any tournament date as a peak target in its own right; " +
            "season_start alone is the peak target this skeleton builds toward.",
          "",
          "This skeleton is PROVISIONAL — no computed phase skeleton could be built because season_start " +
            "isn't available/confirmed yet. Build the standard full periodization toward a reasonable " +
            "default peak, using 4-week blocks per the standard cycle (Hypertrophy -> Max Strength -> " +
            "Power Conversion -> Peak Taper, GPP only as an opening block right after a season ends), and " +
            "flag that the skeleton is provisional pending the real calendar. If the gap between Phase 1's " +
            "start and a knowable season_start is short, compress the buildup rather than forcing a full " +
            "progression into too little time, and flag the compression.",
        ]
      : []),
    ...(input.computedPhases
      ? [
          "",
          "# PHASE BOUNDARIES — FIXED BY THE APP (do not change dates, goal, phase_number, or week_count)",
          "These boundaries were computed deterministically from the athlete's training start date, " +
            "season_start (their single peak target), season_end, and any priority tournament, per the " +
            "app's standard 4-week-block periodization model: every phase defaults to 4 weeks; working " +
            "backward from a peak, the cycle is Hypertrophy -> Max Strength -> Power Conversion -> Peak " +
            "Taper, repeating the middle two as many times as the available time allows; GPP/Reacclimation " +
            "only ever opens a fresh off-season build, directly after a season ends, never mid-cycle. A " +
            "flagged priority tournament gets its own backward-planned sequence ending in its own Peak " +
            "Taper, as a second, in-season peak — with every in-season phase (before AND after that " +
            "tournament) dosed per the Coaching Philosophy's in-season rules (maintenance strength, managed " +
            "fatigue around games, day-before/day-of-game volume rules), never at off-season volume.",
          "",
          "For each phase below, use EXACTLY this phase_number, goal, start_date, end_date, and week_count " +
            "in your submit_macrocycle_skeleton call. Your only job for each one is to write its phase_name, " +
            "weekly_template_label, and (if relevant) deload_test_note, and to write the overall " +
            "rationale/flags reflecting this structure — do not add, remove, reorder, resize, or re-date any " +
            "phase." +
            (input.isRebuild
              ? " This is a rebuild: the boundaries below are the app's computed default for the " +
                "still-to-be-planned remainder of the season — deviate from them only if the rebuild reason " +
                "genuinely requires something else (e.g. inserting an injury_return or testing_block phase " +
                "in place of one of these), and say so explicitly in flags if you do."
              : ""),
          JSON.stringify(input.computedPhases, null, 2),
          ...(input.computedPhaseFlags && input.computedPhaseFlags.length
            ? ["", "Automatic flags from this computation (include these, worded naturally, in your own flags array):",
                ...input.computedPhaseFlags.map((f) => `- ${f}`)]
            : []),
        ]
      : []),
    ...(input.isRebuild
      ? [
          "",
          "# REBUILD CONTEXT",
          `This is a REBUILD. Reason: ${input.rebuildReason}`,
          "Prior skeleton phases (preserve past/completed ones unchanged):",
          JSON.stringify(input.priorSkeletonPhases ?? [], null, 2),
        ]
      : []),
    ...(input.currentDraftOutput && input.editRequest
      ? [
          "",
          "# CURRENT DRAFT (pending the coach's requested edit below)",
          JSON.stringify(input.currentDraftOutput, null, 2),
          "",
          "# COACH EDIT REQUEST",
          input.editRequest,
          "",
          "Revise the skeleton per the coach's edit request above. Call " +
            "submit_macrocycle_skeleton again with the COMPLETE revised skeleton " +
            "(not just the changed parts) — leave anything the coach didn't ask " +
            "to change exactly as it was in the current draft.",
        ]
      : ["", "Call submit_macrocycle_skeleton with the completed skeleton."]),
  ].join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    // `temperature` used to be set low (0.3) here for consistency on this
    // structured, rules-driven output — removed because the API now rejects
    // it for this model ("temperature is deprecated for this model").
    system: systemPrompt,
    tools: [SKELETON_TOOL],
    tool_choice: { type: "tool", name: "submit_macrocycle_skeleton" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a submit_macrocycle_skeleton tool call.");
  }

  return toolUse.input as MacrocyclePlannerOutput;
}
