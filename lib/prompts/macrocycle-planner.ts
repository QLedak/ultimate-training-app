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
