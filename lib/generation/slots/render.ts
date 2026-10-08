import type { LibraryRow } from "../../library/exercise-row";
import { DAY_LABELS, PhasePlan, PlannedSlot, SlotProfile } from "./types";

function describe(r: LibraryRow | undefined, id: string): string {
  if (!r) return id;
  const bits = [
    r.exercise_name,
    r.laterality ? r.laterality : null,
    r.plane ? `${r.plane} plane` : null,
    r.region ? r.region : null,
    (r.joints_loaded ?? []).length ? `loads ${(r.joints_loaded ?? []).join("/")}` : null,
    r.impact ? `impact ${r.impact}` : null,
  ].filter(Boolean);
  return `${id} — ${bits.join("; ")}${r.cue ? ` [cue: ${r.cue}]` : ""}`;
}

const REST_HINT: Record<string, string> = {
  speed_accel: "Speed slot: FULL recovery between reps (do not use conditioning rest).",
  speed_cod: "Speed slot: FULL recovery between reps.",
  conditioning: "Conditioning slot: rest is a work:rest ratio for the interval type (see the exercise's time frame).",
};

export function renderSlotPlan(plan: PhasePlan, library: LibraryRow[], profile: SlotProfile): string {
  const byId = new Map(library.map((r) => [r.exercise_id, r]));
  const lines: string[] = [];
  lines.push(
    `Athlete level: ${profile.level} (N = new, C = comfortable, VE = very experienced). Space: ${profile.space}. ` +
      `Days/week: ${profile.daysPerWeek}${profile.hasLeagueDay ? " (league day on schedule — covers Energy Systems)" : ""}. ` +
      `Conditioning modality preference: ${profile.modality}.`
  );
  if (profile.injuries.length)
    lines.push(
      "Injuries: " +
        profile.injuries.map((i) => `${i.location} (${i.status === "active" ? "ACTIVE — isometric stage only" : "historical — heavy slow resistance"})`).join("; ")
    );
  lines.push("");
  for (const day of plan.days) {
    lines.push(`## ${day.label} (day_label: "${day.label}")`);
    for (const s of day.slots) {
      lines.push(renderSlot(s, byId));
    }
    lines.push("");
  }
  if (plan.warnings.length) {
    lines.push("## Plan warnings (surface the important ones in coach_review_flags)");
    for (const w of plan.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

function renderSlot(s: PlannedSlot, byId: Map<string, LibraryRow>): string {
  const head = `${s.order}. slot_key=${s.slot_key} | ${s.label}${s.superset ? ` | superset group ${s.superset}` : ""} | ${s.mode === "rule" ? (s.pinned ? "RULE (coach-pinned)" : "RULE") : "SHORTLIST"}`;
  const body: string[] = [`   intent: ${s.intent}`];
  if (REST_HINT[s.kind]) body.push(`   rest: ${REST_HINT[s.kind]}`);
  if (s.mode === "rule") body.push(`   USE EXACTLY: ${describe(byId.get(s.picked!), s.picked!)}`);
  else {
    body.push(`   CHOOSE ONE of:`);
    for (const id of s.candidates) body.push(`     - ${describe(byId.get(id), id)}`);
  }
  for (const n of s.notes) body.push(`   note: ${n}`);
  return [head, ...body].join("\n");
}

/** Compact index of everything the athlete is eligible for, so an override can name a valid id. */
export function renderEligibleIndex(library: LibraryRow[]): string {
  return library.map((r) => `${r.exercise_id} | ${r.exercise_name} | ${r.category}${r.subcategory ? " / " + r.subcategory : ""}`).join("\n");
}
