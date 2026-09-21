import fs from "node:fs";
import path from "node:path";

/**
 * Priority order, per corpus-retrieval-spec.md: Primary Reference Program is
 * always included; corpus entries are tried first for a situational match;
 * these hand-written examples are the LAST resort, only when corpus has
 * nothing above threshold.
 *
 * Example 3 (the high school football player's full 6-day week) is
 * deliberately NOT auto-selected here — per system-prompt-v1.md's own
 * note, it's a structural reference for a specific week shape, not tied to
 * a phase goal, and including it well requires a coach's judgment call.
 * Add it manually via a chat edit in the review/approval flow if a
 * situation calls for it.
 */
const GOAL_TO_EXAMPLE: Record<string, string> = {
  injury_return: "example-program-4.md",
  testing_block: "example-program-2.md",
};

export function getFallbackExample(phaseGoal: string): string | null {
  const filename = GOAL_TO_EXAMPLE[phaseGoal];
  if (!filename) return null;

  const filePath = path.join(process.cwd(), "content/example-programs", filename);
  if (!fs.existsSync(filePath)) return null;

  return fs.readFileSync(filePath, "utf-8");
}

export function getPrimaryReferenceProgramSummary(): string {
  const filePath = path.join(
    process.cwd(),
    "content/example-programs/primary-reference-program-summary.md"
  );
  return fs.readFileSync(filePath, "utf-8");
}
