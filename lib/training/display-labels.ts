/**
 * Shared cleanup for two athlete-facing display problems reported from
 * testing:
 *
 * 1. circuit_label (the Phase Builder's free-text field, see
 *    lib/prompts/phase-builder.ts) has no description in the system prompt
 *    telling the model what it's for, so nothing stops it from writing a
 *    movement-pattern/category string there instead of an actual A1/A2-style
 *    superset code — which then rendered straight onto the logging screen as
 *    "upper_push. Barbell bench press". isSupersetLabel is the one guard
 *    both the API (lib/api route) and the UI (guided workout grouping) use
 *    to agree on what counts as a real label; anything else is dropped
 *    rather than shown or grouped on.
 * 2. exercise_name falls back to the raw exercise_id when a prescribed
 *    exercise_id has no matching Exercise Library row — humanizeExerciseId
 *    turns an id-shaped string into something presentable instead of
 *    leaking the raw slug.
 */

/** "A1", "B2", "a12" — a letter followed by one or two digits. Anything else
 * (an invented category label, a blank string) is not a real superset code. */
export function isSupersetLabel(label: unknown): label is string {
  return typeof label === "string" && /^[A-Za-z]\d{1,2}$/.test(label.trim());
}

/** The superset group a label belongs to — "A1" and "A2" share group "A". */
export function supersetGroupKey(label: string): string {
  return label.trim()[0].toUpperCase();
}

/** Real Exercise Library ids are short codes like "SQ-001" — not readable
 * either way, so leave them as-is rather than mangling them. */
function looksLikeLibraryCode(id: string): boolean {
  return /^[A-Z]{1,4}-\d+$/.test(id);
}

/**
 * Best-effort cleanup for a raw id leaking into exercise_name (missing
 * library row): "upper_push_barbell_bench_press" -> "Upper push barbell
 * bench press" — not perfect, but never the literal underscored slug.
 */
export function humanizeExerciseId(id: string): string {
  if (!id) return id;
  if (looksLikeLibraryCode(id)) return id;
  const words = id
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return id;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}
