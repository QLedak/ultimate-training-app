import { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, CLAUDE_MODEL } from "../anthropic-client";
import { getSystemPrompts } from "./extract-system-prompts";
import {
  getCoachingPhilosophy,
  getTrainingTargetsReference,
  getDayStructureTemplates,
} from "./static-content";
import { getFallbackExample, getPrimaryReferenceProgramSummary } from "../corpus/fallback-examples";
import { retrieveCorpusEntries, Situation } from "../corpus/retrieve";
import { getFilteredExerciseLibrary } from "../db/exercise-filter";

const PHASE_PROGRAM_TOOL = {
  name: "submit_phase_program",
  description: "Submit the completed week-by-week program for this phase.",
  input_schema: {
    type: "object" as const,
    properties: {
      // "weeks" is listed FIRST so the model generates the actual program
      // before spending output budget on prose — if a response ever runs
      // long, we'd rather lose the rationale than have the workout data cut
      // off silently.
      weeks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            week_number: { type: "integer" },
            week_type: { type: "string", enum: ["build", "deload", "test"] },
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day_label: { type: "string" },
                  date: { type: "string", description: "YYYY-MM-DD" },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        exercise_id: {
                          type: "string",
                          description: "Must be an exercise_id from the provided filtered library.",
                        },
                        circuit_label: { type: "string" },
                        sets_reps: { type: "string" },
                        tempo: { type: "string" },
                        rest: { type: "string" },
                        notes: { type: "string" },
                      },
                      required: ["exercise_id", "sets_reps"],
                    },
                  },
                },
                required: ["day_label", "date", "exercises"],
              },
            },
          },
          required: ["week_number", "week_type", "days"],
        },
      },
      rationale: { type: "string" },
      athlete_intro: {
        type: "string",
        description: "Short athlete-facing intro paragraph, in the coach's voice.",
      },
      coach_review_flags: { type: "array", items: { type: "string" } },
    },
    // Only "weeks" is required — a long phase is generated in multiple calls
    // (see lib/generation/phase.ts), and calls after the first don't need to
    // repeat the rationale/athlete_intro.
    required: ["weeks"],
  },
};

export type PhaseBuilderInput = {
  phase: Record<string, unknown>; // this phase's row from macrocycle_phases
  athleteIntake: Record<string, unknown>;
  currentAthleteState: Record<string, unknown>;
  phasePerformanceSummary: Record<string, unknown> | null; // null for the athlete's first phase
  situation: Situation;
  // Set both to regenerate an edited version of an existing draft (the
  // "chat edit" path in review-approval-flow-spec.md) instead of a fresh v1.
  currentDraftOutput?: PhaseBuilderOutput;
  editRequest?: string;
  // Set to generate only a subset of this phase's weeks in this call — used
  // to split a long phase across multiple calls so no single response risks
  // truncation (see lib/generation/phase.ts's SPLIT_THRESHOLD_WEEKS).
  weekRange?: { start: number; end: number; totalWeeks: number };
  // For a call after the first in a split phase: a short recap of what's
  // already been generated, so this call's progression continues naturally
  // without needing the full prior weeks' JSON as input context.
  priorWeeksContext?: { rationaleSoFar?: string; lastWeek: PhaseBuilderOutput["weeks"][number] };
};

export type PhaseWeek = {
  week_number: number;
  week_type: "build" | "deload" | "test";
  days: Array<{
    day_label: string;
    date: string;
    exercises: Array<{
      exercise_id: string;
      circuit_label?: string;
      sets_reps: string;
      tempo?: string;
      rest?: string;
      notes?: string;
    }>;
  }>;
};

export type PhaseBuilderOutput = {
  rationale?: string;
  athlete_intro?: string;
  coach_review_flags?: string[];
  weeks: PhaseWeek[];
};

export async function runPhaseBuilder(
  supabase: SupabaseClient,
  input: PhaseBuilderInput
): Promise<PhaseBuilderOutput> {
  const { builder: systemPrompt } = getSystemPrompts();
  const coachingPhilosophy = getCoachingPhilosophy();
  const primaryReferenceProgram = getPrimaryReferenceProgramSummary();

  const athleteEquipment = (input.currentAthleteState.equipment as string[]) ?? [];
  const filteredLibrary = await getFilteredExerciseLibrary(supabase, athleteEquipment);

  const corpusMatches = await retrieveCorpusEntries(supabase, "phase_builder", input.situation);
  const fallbackExample = corpusMatches.length === 0
    ? getFallbackExample(input.situation.phaseGoal)
    : null;

  const dayStructureTemplates = getDayStructureTemplates();
  const daysPerWeek = input.currentAthleteState.training_days_per_week as number | undefined;

  const userMessage = [
    "# COACHING PHILOSOPHY",
    coachingPhilosophy,
    "",
    "# DAY STRUCTURE TEMPLATES (by split & phase)",
    daysPerWeek
      ? `This athlete trains ${daysPerWeek} days/week — use the ${daysPerWeek}-Day Split section below for the ` +
        `fixed slot order per day type, and this phase's row in that split's phase table for dosing/pairing. ` +
        `Fill each generic slot with a real exercise from the filtered library below that matches the slot's intent.`
      : "Use the section matching this athlete's days/week for the fixed slot order per day type, and this " +
        "phase's row in that split's phase table for dosing/pairing.",
    dayStructureTemplates,
    "",
    "# MACROCYCLE SKELETON — THIS PHASE",
    JSON.stringify(input.phase, null, 2),
    ...(input.weekRange
      ? [
          "",
          "# WEEK RANGE FOR THIS CALL",
          `This ${input.weekRange.totalWeeks}-week phase is being generated across multiple calls ` +
            `to stay within response limits. Generate ONLY weeks ${input.weekRange.start} through ` +
            `${input.weekRange.end} in this call, using the phase's ACTUAL week numbers (do not ` +
            `restart numbering at 1). Apply the phase's deload/test placement exactly where it falls ` +
            `within the full ${input.weekRange.totalWeeks}-week phase, even if that week isn't in ` +
            `this call's range.` +
            // The first call of a split/rebuild sequence has no
            // priorWeeksContext yet (lib/generation/phase.ts only sets it
            // once a prior call's weeks exist) — that's the reliable signal
            // for "this is the call that should carry the rationale," not
            // whether the range happens to start at week 1 (a phase-scoped
            // rebuild's first call may start mid-phase, e.g. week 4).
            (!input.priorWeeksContext
              ? " Include the full rationale, athlete_intro, and any coach_review_flags for the phase as a whole."
              : " Do not repeat the rationale or athlete_intro from the earlier call — only include " +
                "coach_review_flags relevant to THIS call's weeks, if any."),
        ]
      : []),
    ...(input.priorWeeksContext
      ? [
          "",
          "# PRIOR WEEKS ALREADY GENERATED (for continuity — do not repeat these)",
          ...(input.priorWeeksContext.rationaleSoFar
            ? ["Rationale so far:", input.priorWeeksContext.rationaleSoFar, ""]
            : []),
          "Last generated week (continue load progression naturally from here):",
          JSON.stringify(input.priorWeeksContext.lastWeek, null, 2),
        ]
      : []),
    "",
    `# EXERCISE LIBRARY (pre-filtered to this athlete's equipment — ${filteredLibrary.length} exercises)`,
    JSON.stringify(filteredLibrary, null, 2),
    "",
    "# PRIMARY REFERENCE PROGRAM SUMMARY",
    primaryReferenceProgram,
    ...(corpusMatches.length > 0
      ? [
          "",
          `# RETRIEVED CORPUS EXAMPLES (${corpusMatches.length} matched, scores: ${corpusMatches
            .map((m) => m.score)
            .join(", ")})`,
          JSON.stringify(corpusMatches.map((m) => m.entry), null, 2),
        ]
      : fallbackExample
      ? ["", "# FALLBACK EXAMPLE (no corpus match above threshold)", fallbackExample]
      : []),
    "",
    "# TRAINING TARGETS REFERENCE",
    getTrainingTargetsReference(),
    "",
    "# ATHLETE INTAKE & CURRENT STATE",
    JSON.stringify(
      { intake: input.athleteIntake, current_state: input.currentAthleteState },
      null,
      2
    ),
    ...(input.phasePerformanceSummary
      ? [
          "",
          // A rebuild's summary is compiled for THIS SAME phase (interrupted
          // partway through, per data-architecture-spec.md step 7(b)/(c)) —
          // its own `reason`/`reason_detail` fields explain why. A normal
          // transition's summary is for the phase that just ended.
          input.phasePerformanceSummary.phase_id === input.phase.id
            ? "# PHASE PERFORMANCE SUMMARY — THIS PHASE, INTERRUPTED MID-WAY FOR A REBUILD"
            : "# PHASE PERFORMANCE SUMMARY (prior phase)",
          JSON.stringify(input.phasePerformanceSummary, null, 2),
          ...(input.phasePerformanceSummary.phase_id === input.phase.id
            ? [
                "Explain in the rationale, briefly, what's changing about the remaining weeks and why, " +
                  "given the reason/reason_detail above — the athlete will read this.",
              ]
            : []),
        ]
      : ["", "# NOTE: this is the athlete's first phase — no Phase Performance Summary exists yet."]),
    ...(input.currentDraftOutput && input.editRequest
      ? [
          "",
          input.weekRange
            ? `# CURRENT DRAFT — WEEKS ${input.weekRange.start}-${input.weekRange.end} ONLY (pending the coach's requested edit below)`
            : "# CURRENT DRAFT (pending the coach's requested edit below)",
          JSON.stringify(input.currentDraftOutput, null, 2),
          "",
          "# COACH EDIT REQUEST",
          input.editRequest,
          "",
          input.weekRange
            ? "Revise weeks " +
                `${input.weekRange.start}-${input.weekRange.end} per the coach's edit request above ` +
                "(the request may apply to this range, elsewhere in the phase, or both — apply it " +
                "wherever it's relevant within these weeks). Call submit_phase_program with the " +
                "COMPLETE revised weeks for this range (not just the changed parts) — leave anything " +
                "the coach didn't ask to change exactly as it was."
            : "Revise the phase program per the coach's edit request above. Call " +
                "submit_phase_program again with the COMPLETE revised program (not " +
                "just the changed parts) — leave anything the coach didn't ask to " +
                "change exactly as it was in the current draft (e.g. an edit about " +
                "one day's session shouldn't silently change other days).",
        ]
      : ["", "Call submit_phase_program with the completed week-by-week program."]),
  ].join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    // A long phase is split across multiple calls by weekRange (see
    // lib/generation/phase.ts), so a single call only ever needs to cover a
    // handful of weeks — but even a small range with detailed exercises can
    // add up, so this still leaves real headroom. "weeks" is listed first in
    // the schema above as a second line of defense, and the check below
    // throws if a response still comes back without it, rather than
    // silently saving a broken draft.
    max_tokens: 20000,
    // Same reasoning as the Macrocycle Planner call: structured, rules-driven
    // output where consistency matters more than creative variety, with a
    // little room left for weighing close exercise-selection judgment calls.
    temperature: 0.3,
    system: systemPrompt,
    tools: [PHASE_PROGRAM_TOOL],
    tool_choice: { type: "tool", name: "submit_phase_program" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a submit_phase_program tool call.");
  }

  const output = toolUse.input as PhaseBuilderOutput;

  // A response cut off by the token budget (response.stop_reason ===
  // "max_tokens") can still parse as valid JSON while missing the "weeks"
  // array entirely, or trailing off mid-week — fail loudly here rather than
  // storing a draft that only breaks later, at approval/publish time.
  if (response.stop_reason === "max_tokens" || !output.weeks || output.weeks.length === 0) {
    throw new Error(
      "Phase Builder response was truncated or incomplete (missing weeks) — try again, and if it " +
        "keeps happening, this phase's date range may need a shorter program or a higher max_tokens."
    );
  }

  return output;
}
