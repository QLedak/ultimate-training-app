/**
 * Minimal dot-path get/set for direct-override edits (review-approval-flow-spec.md
 * "direct overrides" mechanic) — no lodash dependency needed for something this
 * small. Paths are plain dot-separated segments, array indices included as
 * numeric segments: e.g. "weeks.0.days.1.exercises.0.exercise_id" or
 * "phases.2.week_count".
 */
export function getAtPath(obj: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function setAtPath(obj: unknown, path: string, value: unknown): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) throw new Error("field_path must not be empty");

  let current: Record<string, unknown> = obj as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (current[segment] == null || typeof current[segment] !== "object") {
      throw new Error(`field_path segment "${segment}" does not exist on the draft output`);
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}
