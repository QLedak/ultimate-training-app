import fs from "node:fs";
import path from "node:path";

/**
 * Extracts the two system prompts (Macrocycle Planner, Phase Builder) directly
 * from lib/prompts/system-prompt-v3.md — the actual spec document — rather
 * than duplicating that text in code where it could silently drift out of
 * sync. Edit the .md file; the code always reads the current version.
 */

let cache: { planner: string; builder: string } | null = null;

function extractFencedBlockAfterHeading(markdown: string, heading: string): string {
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error(`Could not find heading "${heading}" in system-prompt-v3.md`);
  }
  const afterHeading = markdown.slice(headingIndex);
  const fenceStart = afterHeading.indexOf("```");
  if (fenceStart === -1) {
    throw new Error(`Could not find a fenced code block after "${heading}"`);
  }
  const fenceContentStart = afterHeading.indexOf("\n", fenceStart) + 1;
  const fenceEnd = afterHeading.indexOf("```", fenceContentStart);
  if (fenceEnd === -1) {
    throw new Error(`Unterminated fenced code block after "${heading}"`);
  }
  return afterHeading.slice(fenceContentStart, fenceEnd).trim();
}

export function getSystemPrompts() {
  if (cache) return cache;

  const mdPath = path.join(process.cwd(), "lib/prompts/system-prompt-v3.md");
  const markdown = fs.readFileSync(mdPath, "utf-8");

  cache = {
    planner: extractFencedBlockAfterHeading(
      markdown,
      "## CALL 1: MACROCYCLE PLANNER — system prompt"
    ),
    builder: extractFencedBlockAfterHeading(
      markdown,
      "## CALL 2: PHASE BUILDER — system prompt"
    ),
  };
  return cache;
}
