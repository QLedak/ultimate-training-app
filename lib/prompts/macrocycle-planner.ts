import { getAnthropicClient, CLAUDE_MODEL } from "../anthropic-client";
import { getSystemPrompts } from "./extract-system-prompts";
import { getCoachingPhilosophy, getTrainingTargetsReference } from "./static-content";
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
                "A generic label for THIS athlete's template, not the primary reference program's own '4A'/'4B' names.",
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

  const userMessage = [
    "# COACHING PHILOSOPHY",
    coachingPhilosophy,
    "",
    "# PRIMARY REFERENCE PROGRAM SUMMARY",
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
