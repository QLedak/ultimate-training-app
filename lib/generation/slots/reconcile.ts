import type { LibraryRow } from "../../library/exercise-row";
import { DAY_LABELS, DayType, PhasePlan, PlannedDay, PlannedSlot } from "./types";

/**
 * Post-generation validation (the slot-fill counterpart of assertCompleteWeeks).
 *
 * The app, not the model, decides which exercise fills a RULE slot and which
 * options a SHORTLIST slot may choose from. The model may break either only by
 * attaching an `override_reason` to the entry; every override (and every
 * silent deviation the app has to repair) lands in coach_review_flags.
 *
 * Deterministic: no model calls. Repairs keep the model's prescription (sets,
 * reps, tempo, rest, notes) and swap only the exercise_id.
 */

export type EntryLike = {
  exercise_id: string;
  slot_key?: string;
  override_reason?: string;
  circuit_label?: string;
  [k: string]: unknown;
};
export type DayLike = { day_label: string; date: string; exercises: EntryLike[] };
export type WeekLike = { week_number: number; week_type: string; days: DayLike[] };

export type ReconcileResult = { flags: string[]; repairs: number };

/** Match a model-written day label to a planned day type. */
export function matchDayType(label: string): DayType | null {
  const l = (label ?? "").toLowerCase();
  if (/lower\s*body\s*power|lower\s*power|impulse/.test(l)) return "lower_body_power";
  if (/lower/.test(l) && /strength/.test(l)) return "lower_strength";
  if (/upper/.test(l) && /(strength\s*2|\b2\b)/.test(l)) return "upper_strength_2";
  if (/upper/.test(l)) return "upper_strength_1";
  if (/athlete/.test(l)) return "athlete_day";
  if (/energy/.test(l)) return "energy_systems";
  return null;
}

export function reconcileWeeksWithPlan(
  weeks: WeekLike[],
  plan: PhasePlan,
  library: LibraryRow[],
  opts: { mode: "generate" | "edit" }
): ReconcileResult {
  const byId = new Map(library.map((r) => [r.exercise_id, r]));
  const flags: string[] = [];
  let repairs = 0;
  const planDay = new Map<DayType, PlannedDay>(plan.days.map((d) => [d.day_type, d]));
  const slotByKey = new Map<string, PlannedSlot>();
  for (const d of plan.days) for (const s of d.slots) slotByKey.set(s.slot_key, s);
  const missingSeen = new Set<string>();
  const flagOnce = new Set<string>();
  const pushFlag = (f: string) => { if (!flagOnce.has(f)) { flagOnce.add(f); flags.push(f); } };

  for (const week of weeks) {
    const usedThisWeek = new Map<string, string>(); // exercise_id -> slot_key
    // Pass A: slot adherence
    for (const day of week.days) {
      const dayType = matchDayType(day.day_label);
      const planned = dayType ? planDay.get(dayType) : undefined;
      if (!planned) {
        if (opts.mode === "generate") pushFlag(`Week ${week.week_number}: "${day.day_label}" does not match a planned day type for this athlete.`);
        continue;
      }
      const seen = new Set<string>();
      for (const entry of day.exercises) {
        const key = entry.slot_key;
        const slot = key ? slotByKey.get(key) : undefined;
        if (!slot) {
          if (opts.mode === "generate")
            pushFlag(`Week ${week.week_number}, ${day.day_label}: an exercise (${entry.exercise_id}) was added without a planned slot — review.`);
          delete entry.override_reason;
          continue;
        }
        seen.add(slot.slot_key);
        const reason = (entry.override_reason ?? "").toString().trim();
        if (opts.mode === "edit") {
          delete entry.override_reason;
          continue; // coach-directed edit: any active library exercise is allowed
        }
        const label = `${DAY_LABELS[slot.day_type]} — ${slot.label}`;
        if (slot.mode === "rule") {
          if (entry.exercise_id !== slot.picked) {
            const chose = entry.exercise_id;
            if (reason && byId.get(chose)?.is_active) {
              pushFlag(`OVERRIDE (Week ${week.week_number}) ${label}: used ${chose} instead of the rule pick ${slot.picked}. Reason: ${reason}`);
            } else {
              pushFlag(`Auto-corrected: ${label} — the model used ${chose} without a stated reason; restored the rule pick ${slot.picked}.`);
              entry.exercise_id = slot.picked!;
              repairs++;
            }
          }
        } else if (!slot.candidates.includes(entry.exercise_id)) {
          const chose = entry.exercise_id;
          if (reason && byId.get(chose)?.is_active) {
            pushFlag(`OVERRIDE (Week ${week.week_number}) ${label}: used ${chose}, outside the shortlist. Reason: ${reason}`);
          } else {
            const fallback = slot.candidates.find((c) => !usedThisWeek.has(c) && !day.exercises.some((e) => e !== entry && e.exercise_id === c)) ?? slot.candidates[0];
            pushFlag(`Auto-corrected: ${label} — ${chose} is outside the shortlist and no reason was given; replaced with ${fallback}.`);
            entry.exercise_id = fallback;
            repairs++;
          }
        }
        delete entry.override_reason;
      }
      if (opts.mode === "generate") {
        for (const s of planned.slots) {
          if (!seen.has(s.slot_key)) {
            const k = `${s.slot_key}`;
            if (!missingSeen.has(k)) {
              missingSeen.add(k);
              pushFlag(`Missing slot: ${DAY_LABELS[s.day_type]} — ${s.label} (${s.slot_key}) was not programmed in at least one week — review.`);
            }
          }
        }
      }
      // Order by plan; relabel supersets from the plan.
      const order = new Map(planned.slots.map((s, i) => [s.slot_key, i]));
      day.exercises.sort((a, b) => (order.get(a.slot_key ?? "") ?? 999) - (order.get(b.slot_key ?? "") ?? 999));
      relabelSupersets(day, planned);
    }

    // Pass B: no repeats within the week
    for (const day of week.days) {
      for (const entry of day.exercises) {
        const key = entry.slot_key ?? "";
        const prev = usedThisWeek.get(entry.exercise_id);
        if (!prev) {
          usedThisWeek.set(entry.exercise_id, key);
          continue;
        }
        const slot = slotByKey.get(key);
        if (opts.mode === "generate" && slot && slot.mode === "shortlist") {
          const alt = slot.candidates.find((c) => !usedThisWeek.has(c));
          if (alt) {
            pushFlag(`Auto-corrected (Week ${week.week_number}): ${entry.exercise_id} appeared twice in the week; ${DAY_LABELS[slot.day_type]} — ${slot.label} now uses ${alt}.`);
            entry.exercise_id = alt;
            usedThisWeek.set(alt, key);
            repairs++;
            continue;
          }
        }
        pushFlag(`Week ${week.week_number}: ${entry.exercise_id} is used twice in the week (${prev} and ${key || "unslotted"}) — the pool for that slot is too thin to avoid it.`);
      }
    }
  }
  for (const w of plan.warnings) pushFlag(`Plan note: ${w}`);
  return { flags, repairs };
}

function relabelSupersets(day: DayLike, planned: PlannedDay) {
  const groups = new Map<string, EntryLike[]>();
  for (const entry of day.exercises) {
    const slot = planned.slots.find((s) => s.slot_key === entry.slot_key);
    if (slot?.superset) groups.set(slot.superset, [...(groups.get(slot.superset) ?? []), entry]);
  }
  // Letters re-assigned A, B, C... in order of first appearance among groups that survived.
  let letterIdx = 0;
  const letterFor = new Map<string, string>();
  for (const entry of day.exercises) {
    const slot = planned.slots.find((s) => s.slot_key === entry.slot_key);
    if (!slot?.superset) { delete entry.circuit_label; continue; }
    const members = groups.get(slot.superset) ?? [];
    if (members.length < 2) { delete entry.circuit_label; continue; }
    if (!letterFor.has(slot.superset)) letterFor.set(slot.superset, String.fromCharCode(65 + letterIdx++));
    entry.circuit_label = `${letterFor.get(slot.superset)}${members.indexOf(entry) + 1}`;
  }
}
