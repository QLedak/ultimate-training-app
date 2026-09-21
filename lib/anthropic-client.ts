import Anthropic from "@anthropic-ai/sdk";

// Per this project's current model reference, the API model string for the
// production model is "claude-sonnet-5". Override via env var if that
// changes or you want a different model for testing.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. This is a separate account/billing from your " +
        "claude.ai subscription — create a key at console.anthropic.com and add " +
        "it to .env.local."
    );
  }
  return new Anthropic({ apiKey });
}
