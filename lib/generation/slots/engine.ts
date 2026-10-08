import {
  LibraryRow, PhaseGoal, chainDepth, effectivePhase, fitsLevel, fitsPhase, fitsSpace, hasTag,
  isEquipmentAvailable, LEVEL_RANK,
} from "../../library/exercise-row";
import {
  ACCEL_LADDER, ADDUCTOR_LADDER, CALF_FALLBACK, CALF_LADDER, CONDITIONING_FRAMES, LOWER_PUSH_BILATERAL_LADDER,
  LOWER_PUSH_UNILATERAL_ALL, LOWER_PUSH_UNILATERAL_LADDER, POSTERIOR_REGION_ORDER, REFLEXIVE_LADDER,
  REPEATED_SPRINT_ID, TC_DEPTH_FRACTION, TRISET_GROUPS, UPPER_COMPOUND_DIRECTION, ladderFor,
} from "./ladders";
import {
  ConditioningModality, DAY_LABELS, DAY_ORDER, DayType, InjuryAreaInput, PhasePlan, PlannedDay, PlannedSlot,
  PriorContinuity, SlotKind, SlotProfile,
} from "./types";

const MAX_CANDIDATES = 8;
const MAX_EXTRAS_PER_DAY = 2;

/** Joints to protect for an ACTIVE injury (library `joints_loaded` vocabulary). */
const INJURY_JOINTS: Record<string, string[]> = {
  achilles_calf: ["achilles", "calf", "ankle"],
  patellar_knee: ["knee"],
  acl_knee: ["knee"],
  hamstring: ["hamstring"],
  groin_adductor: ["groin"],
  shoulder: ["shoulder"],
  lower_back: ["low back"],
  ankle: ["ankle"],
  hip_flexor: ["hip flexor"],
  abdominal: ["core"],
  elbow: ["elbow"],
  wrist: ["wrist"],
};
const LOWER_LOCATIONS = new Set([
  "patellar_knee", "acl_knee", "hamstring", "groin_adductor", "ankle", "lower_back", "hip_flexor", "achilles_calf",
]);
const UPPER_LOCATIONS = new Set(["shoulder", "elbow", "wrist"]);
const HIGH_IMPACT_LOCATIONS = LOWER_LOCATIONS;

type Chosen = { row: LibraryRow; step: number | null; type: "isometric" | "hsr_start" | "hsr" | null };

export function buildPhasePlan(params: {
  library: LibraryRow[];
  goal: string;
  profile: SlotProfile;
  prior?: PriorContinuity | null;
}): PhasePlan {
  const { library, profile } = params;
  const goal: PhaseGoal = effectivePhase(params.goal);
  const prior: PriorContinuity = params.prior ?? { picks: {}, chainSteps: {}, advance: [] };
  const warnings: string[] = [];
  const byId = new Map(library.map((r) => [r.exercise_id, r]));
  const used = new Set<string>(); // ids already placed this week (rule picks)
  const days = new Map<DayType, PlannedSlot[]>();

  const hasDay = (d: DayType) => DAY_ORDER.indexOf(d) < profile.daysPerWeek && (d !== "energy_systems" || !profile.hasLeagueDay);
  const activeLocations = profile.injuries.filter((i) => i.status === "active").map((i) => i.location);
  const avoidJoints = new Set(activeLocations.flatMap((l) => INJURY_JOINTS[l] ?? []));

  // ---------- eligibility ----------
  const eligible = (r: LibraryRow) =>
    r.is_active &&
    isEquipmentAvailable(r, profile.equipment) &&
    fitsSpace(r, profile.space) &&
    fitsLevel(r, profile.level) &&
    fitsPhase(r, goal);
  const elig = library.filter(eligible);
  const safe = (r: LibraryRow) => !(r.joints_loaded ?? []).some((j) => avoidJoints.has(j));
  const depth = (r: LibraryRow) => chainDepth(r, byId);

  const pool = (category: string, sub?: string) =>
    elig.filter((r) => r.category === category && (!sub || r.subcategory === sub));
  const tagged = (category: string, sub?: string) =>
    elig.filter((r) => r.category !== "Conditioning" && hasTag(r, category, sub));

  const rank = (rows: LibraryRow[], priorId?: string): LibraryRow[] => {
    const successors = new Set(priorId ? byId.get(priorId)?.progress_to ?? [] : []);
    return [...rows].sort((a, b) => {
      const score = (r: LibraryRow) =>
        (safe(r) ? 0 : 100) +
        (successors.has(r.exercise_id) ? -10 : 0) +
        ((r.phases ?? []).length > 0 ? -2 : 0); // rows built for this phase window first
      return score(a) - score(b) || a.exercise_id.localeCompare(b.exercise_id);
    });
  };
  const noteUnsafe = (slot: string, ids: string[]) => {
    const unsafe = ids.filter((id) => byId.get(id) && !safe(byId.get(id)!));
    if (unsafe.length && unsafe.length === ids.length)
      warnings.push(`${slot}: every option loads a joint with an ACTIVE injury — coach review.`);
  };

  // ---------- slot construction ----------
  const allSlots: PlannedSlot[] = [];
  const addSlot = (day: DayType, s: Omit<PlannedSlot, "order" | "day_type" | "notes"> & { notes?: string[] }) => {
    const slot: PlannedSlot = { ...s, day_type: day, order: 0, notes: s.notes ?? [] };
    const list = days.get(day) ?? [];
    list.push(slot);
    days.set(day, list);
    allSlots.push(slot);
    return slot;
  };
  const rule = (
    day: DayType, key: string, label: string, kind: SlotKind, intent: string, pick: string | null,
    extra: Partial<PlannedSlot> = {}
  ) => {
    const pinId = profile.pins[key] && byId.has(profile.pins[key]) ? profile.pins[key] : null;
    const finalPick = pinId ?? pick;
    if (!finalPick) {
      warnings.push(`${DAY_LABELS[day]} — ${label}: no eligible exercise for this athlete's equipment/space/experience; slot left out.`);
      return null;
    }
    used.add(finalPick);
    const slot = addSlot(day, { slot_key: key, label, kind, mode: "rule", picked: finalPick, candidates: [], superset: null, intent, pinned: !!pinId, ...extra });
    if (pinId && !isEquipmentAvailable(byId.get(pinId)!, profile.equipment))
      slot.notes.push("Coach-pinned exercise needs equipment the athlete has not listed.");
    return slot;
  };
  const shortlist = (
    day: DayType, key: string, label: string, kind: SlotKind, intent: string, rows: LibraryRow[],
    extra: Partial<PlannedSlot> = {}
  ) => {
    const slot = addSlot(day, {
      slot_key: key, label, kind, mode: "shortlist", picked: null,
      candidates: rows.map((r) => r.exercise_id), superset: null, intent, ...extra,
    });
    if (rows.length === 0) warnings.push(`${DAY_LABELS[day]} — ${label}: shortlist is empty for this athlete.`);
    return slot;
  };

  // ---------- pick helpers ----------
  /** First ladder entry that is eligible and unused; prefers entries that don't load an actively injured joint. */
  const pickLadder = (ids: string[], exclude: Set<string> = new Set()): string | null => {
    const ok = ids
      .map((id) => byId.get(id))
      .filter((r): r is LibraryRow => !!r && eligible(r) && !used.has(r.exercise_id) && !exclude.has(r.exercise_id));
    return (ok.find(safe) ?? ok[0])?.exercise_id ?? null;
  };

  /** Pick from a chain by depth fraction, never lower than the previous phase's rung (except at peak). */
  const pickByDepth = (rows: LibraryRow[], key: string, exclude: Set<string> = new Set()): string | null => {
    const cands = rows.filter((r) => !used.has(r.exercise_id) && !exclude.has(r.exercise_id));
    if (cands.length === 0) return null;
    const pool2 = cands.some(safe) ? cands.filter(safe) : cands;
    const depths = pool2.map((r) => ({ r, d: depth(r) })).sort((a, b) => a.d - b.d || a.r.exercise_id.localeCompare(b.r.exercise_id));
    const maxD = depths[depths.length - 1].d;
    const minD = depths[0].d;
    const frac = ladderFor(TC_DEPTH_FRACTION, goal, 0.7);
    let target = minD + Math.round(frac * (maxD - minD));
    const priorRow = prior.picks[key] ? byId.get(prior.picks[key]) : null;
    if (priorRow && goal !== "peak_taper") target = Math.max(target, Math.min(depth(priorRow) + 1, maxD));
    const atOrBelow = depths.filter((x) => x.d <= target);
    if (atOrBelow.length === 0) return depths[0].r.exercise_id;
    const bestDepth = atOrBelow[atOrBelow.length - 1].d;
    return atOrBelow.find((x) => x.d === bestDepth)!.r.exercise_id; // lowest id among ties
  };

  // ---------- injury chains ----------
  const chainRowsFor = (location: string) =>
    library
      .filter((r) => r.is_active && (r.chain_memberships ?? []).some((m) => m.location === location))
      .map((r) => ({ row: r, m: r.chain_memberships!.find((x) => x.location === location)! }))
      .sort((a, b) => a.m.step - b.m.step);

  const pickChain = (inj: InjuryAreaInput, exclude: Set<string> = new Set()): Chosen | null => {
    const rows = chainRowsFor(inj.location).filter(
      (x) => eligible({ ...x.row, phases: [] } as LibraryRow) && !used.has(x.row.exercise_id) && !exclude.has(x.row.exercise_id)
    );
    const wantIso = inj.status === "active";
    const kinds = wantIso ? ["isometric"] : ["hsr_start", "hsr"];
    let usable = rows.filter((x) => kinds.includes(x.m.type));
    let isoFallback = false;
    if (usable.length === 0 && !wantIso) {
      usable = rows.filter((x) => x.m.type === "isometric");
      isoFallback = true;
      if (usable.length) warnings.push(`${inj.location}: no equipment for heavy slow resistance — fell back to an isometric hold (coach review).`);
    }
    if (usable.length === 0) return null;
    const last = prior.chainSteps[inj.location];
    const sameClass = last && (wantIso || isoFallback ? last.type === "isometric" : last.type !== "isometric");
    const startStep = usable[0].m.step;
    let desired = sameClass ? last.step + (prior.advance.includes(inj.location) ? 1 : 0) : startStep;
    if (!sameClass && !wantIso && !isoFallback) desired = chainRowsFor(inj.location).find((x) => x.m.type === "hsr_start")?.m.step ?? startStep;
    if (!sameClass && (wantIso || isoFallback)) desired = 1;
    const atOrBelow = usable.filter((x) => x.m.step <= desired);
    const chosen = atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : usable[0];
    return { row: chosen.row, step: chosen.m.step, type: chosen.m.type };
  };

  // Injury areas, de-duplicated by chain area (patellar_knee + acl_knee share one chain), priority ordered.
  const areaOf = (loc: string) => chainRowsFor(loc)[0]?.m.area ?? loc;
  const injuries: InjuryAreaInput[] = [];
  const seenAreas = new Map<string, number>();
  const sortedInj = [...profile.injuries].sort((a, b) => {
    const rankOf = (i: InjuryAreaInput) => (i.status === "active" ? 0 : i.monthsAgo != null && i.monthsAgo < 12 ? 1 : 2);
    return rankOf(a) - rankOf(b);
  });
  for (const inj of sortedInj) {
    const area = areaOf(inj.location);
    if (seenAreas.has(area)) continue;
    seenAreas.set(area, injuries.length);
    injuries.push(inj);
  }

  const hasDay3 = hasDay("athlete_day");
  const hasDay4 = hasDay("lower_body_power");
  const coreInj = injuries.find((i) => i.location === "abdominal") ?? null;
  const calfInj = hasDay3 ? injuries.find((i) => i.location === "achilles_calf") ?? null : null;
  const lowerInj = injuries.filter((i) => LOWER_LOCATIONS.has(i.location) && i !== calfInj);
  const upperInj = injuries.filter((i) => UPPER_LOCATIONS.has(i.location));
  const placed = new Set<InjuryAreaInput>();
  let lowerOverflow: InjuryAreaInput[] = [];
  let upperOverflow: InjuryAreaInput[] = [];

  const chainSlot = (
    day: DayType, key: string, label: string, inj: InjuryAreaInput, opts: { extra?: boolean } = {}
  ): PlannedSlot | null => {
    const pinned = profile.pins[key] ? byId.get(profile.pins[key]) : null;
    const chosen = pinned ? { row: pinned, step: null, type: null } as Chosen : pickChain(inj);
    if (!chosen) {
      warnings.push(`${DAY_LABELS[day]} — ${label}: no ${inj.status === "active" ? "isometric" : "heavy-slow-resistance"} rung is available for ${inj.location} with this athlete's equipment/experience.`);
      return null;
    }
    placed.add(inj);
    const rung = chosen.step != null ? ` (step ${chosen.step})` : "";
    return rule(
      day, key, label, "injury_resilience",
      inj.status === "active"
        ? `ACTIVE ${inj.location} injury: isometric stage${rung}. Dose by the injury-resilience table — never HSR until the athlete reports it resolved.`
        : `Historical ${inj.location}: heavy slow resistance${rung}. ${opts.extra ? "Light standing dose, end of session." : "Standing resilience dose."}`,
      chosen.row.exercise_id,
      {
        injury: { location: inj.location, status: inj.status, step: chosen.step },
        extra_injury: opts.extra, pinned: !!pinned,
      }
    );
  };

  const pairPlaneFor = (planeIdx: 0 | 1): "horizontal" | "vertical" => {
    const first = profile.phaseNumber % 2 === 1 ? "horizontal" : "vertical";
    const second = first === "horizontal" ? "vertical" : "horizontal";
    return planeIdx === 0 ? first : second;
  };
  const planeFamily = (plane: "horizontal" | "vertical") => (plane === "horizontal" ? ["horizontal", "incline"] : ["vertical"]);

  const upperPush = (plane: "horizontal" | "vertical", source: "abs" | "cmp") => {
    const rows = upperPushRaw(plane, source);
    return rows.length ? rows : upperPushRaw(plane === "horizontal" ? "vertical" : "horizontal", source);
  };
  const upperPull = (plane: "horizontal" | "vertical", source: "abs" | "cmp") => {
    const rows = upperPullRaw(plane, source);
    return rows.length ? rows : upperPullRaw(plane === "horizontal" ? "vertical" : "horizontal", source);
  };
  const upperPushRaw = (plane: "horizontal" | "vertical", source: "abs" | "cmp") =>
    elig.filter((r) =>
      planeFamily(plane).includes(r.plane ?? "") &&
      (source === "abs"
        ? r.category === "Absolute strength" && r.subcategory === "Upper push"
        : hasTag(r, "Hypertrophy", "Upper compound") && ((r.category === "Absolute strength" && r.subcategory === "Upper push") || UPPER_COMPOUND_DIRECTION[r.exercise_id] === "push"))
    );
  const upperPullRaw = (plane: "horizontal" | "vertical", source: "abs" | "cmp") =>
    elig.filter((r) =>
      planeFamily(plane).includes(r.plane ?? "") &&
      (source === "abs"
        ? r.category === "Absolute strength" && r.subcategory === "Upper pull"
        : hasTag(r, "Hypertrophy", "Upper compound") && ((r.category === "Absolute strength" && r.subcategory === "Upper pull") || UPPER_COMPOUND_DIRECTION[r.exercise_id] === "pull"))
    );

  // ---------- modality / conditioning ----------
  const modalityOf = (r: LibraryRow): ConditioningModality => {
    const tags = new Set((r.equipment_groups ?? []).flat());
    if (tags.has("bike")) return "bike";
    if (tags.has("rower")) return "rower";
    if (tags.has("ski_erg")) return "ski_erg";
    if (tags.has("jump_rope")) return "jump_rope";
    if (tags.has("treadmill")) return "incline_walk";
    return "running";
  };
  const lowerActive = activeLocations.some((l) => HIGH_IMPACT_LOCATIONS.has(l));
  const pickConditioning = (frames: string[], exclude: Set<string> = new Set()): string | null => {
    for (const frame of frames) {
      if (frame === "REPEATED_SPRINT") {
        const rs = byId.get(REPEATED_SPRINT_ID);
        if (rs && eligible(rs) && !used.has(rs.exercise_id) && !(lowerActive && rs.impact === "high")) return rs.exercise_id;
        continue;
      }
      let rows = pool("Conditioning").filter(
        (r) => (r.time_frames ?? []).includes(frame) && !used.has(r.exercise_id) && !exclude.has(r.exercise_id)
      );
      if (lowerActive) {
        const lowImpact = rows.filter((r) => r.impact !== "high");
        if (lowImpact.length) rows = lowImpact;
      }
      const pref = rows.filter((r) => modalityOf(r) === profile.modality);
      const choose = pref.length ? pref : rows.filter((r) => modalityOf(r) === "running").length ? rows.filter((r) => modalityOf(r) === "running") : rows;
      const sorted = rank(choose);
      if (sorted.length) return sorted[0].exercise_id;
    }
    // Nothing in the phase's time frames fits this athlete's equipment/space: use any conditioning row they can do.
    const any = rank(pool("Conditioning").filter((r) => !used.has(r.exercise_id) && !exclude.has(r.exercise_id)));
    if (any.length) {
      warnings.push(`Conditioning: nothing in this phase's time frames (${frames.join(", ")}) fits the athlete's equipment/space — used ${any[0].exercise_id} (${(any[0].time_frames ?? []).join(", ")}) instead.`);
      return any[0].exercise_id;
    }
    return null;
  };

  // =====================================================================
  // PASS 1 — build days, rule picks first-come in day order
  // =====================================================================
  const exactlyTwo = profile.daysPerWeek === 2;
  const frames = ladderFor(CONDITIONING_FRAMES, goal, [">10 min"]);

  // ---- Day 1: Lower Strength ----
  if (hasDay("lower_strength")) {
    const D: DayType = "lower_strength";
    if (exactlyTwo) {
      rule(D, "D1.accel", "Speed — acceleration", "speed_accel",
        "Brief technical sprint-mechanics opener (only at exactly 2 days/week). Full recovery between reps.",
        pickLadder(ladderFor(ACCEL_LADDER, goal, [])));
    }
    // Technical coordination (lower) — heavier day
    const tcChain = pool("Technical coordination", "Chain");
    const tcLoaded = pool("Technical coordination", "Loaded jumps");
    let tcPick: string | null = null;
    const cleanPull = byId.get("TC-029");
    if (goal === "max_strength" && cleanPull && eligible(cleanPull) && !used.has("TC-029")) tcPick = "TC-029";
    if (!tcPick) tcPick = pickByDepth(tcChain, "D1.tc");
    if (!tcPick) tcPick = pickByDepth(tcLoaded, "D1.tc");
    rule(D, "D1.tc", "Technical coordination (lower)", "technical_coordination",
      "HEAVIER of the week's two lower TC exposures: top eligible rung for this phase, technique first.", tcPick);

    // Absolute strength (lower push)
    const uni = profile.daysPerWeek <= 3;
    const lad = uni ? ladderFor(LOWER_PUSH_UNILATERAL_LADDER, goal, []) : ladderFor(LOWER_PUSH_BILATERAL_LADDER, goal, []);
    let absPick = pickLadder(lad);
    if (!absPick) absPick = pickLadder(LOWER_PUSH_UNILATERAL_ALL);
    rule(D, "D1.abs", `Absolute strength — lower push (${uni ? "unilateral" : "bilateral"})`, "absolute_strength",
      `The day's featured strength move (${uni ? "rear-foot-elevated family" : "bilateral squat"}); main working sets.`, absPick);

    // Lower hypertrophy (S) + core (S or chain)
    const hypPool = rank(
      elig.filter((r) =>
        (r.category === "Hypertrophy" && r.subcategory === "Lower compound") ||
        (r.category === "Absolute strength" && r.subcategory === "Lower pull") ||
        (!hasDay4 && r.category === "Hypertrophy" && r.subcategory === "Lower isolation" && r.region === "hamstring")
      )
    );
    // hinge rows first so the slot balances a squat-dominant slot 3
    const hinge = (r: LibraryRow) => (r.category === "Absolute strength" || (r.joints_loaded ?? []).includes("hamstring") ? 0 : 1);
    const hypSorted = [
      ...hypPool.filter((r) => hinge(r) === 0).slice(0, 5),
      ...hypPool.filter((r) => hinge(r) === 1).slice(0, 3),
    ];
    // placeholder: candidate trim happens in pass 2 (after rule picks are known)
    shortlist(D, "D1.hyp", "Lower hypertrophy (compound)", "lower_hypertrophy",
      "Balances slot 3: if the absolute-strength move is squat/lunge-dominant, choose a hinge/posterior-chain compound.",
      hypSorted, { superset: "A" });
    const coreChain = coreInj && !profile.pins["D1.core"] ? chainSlot(D, "D1.core", "Core (injury chain)", coreInj) : null;
    if (coreChain) {
      coreChain.superset = "A";
    } else {
      shortlist(D, "D1.core", "Core — sagittal plane", "core",
        "Anti-extension / sagittal core work supersetted with the hypertrophy move.",
        rank(pool("Core", "Sagittal")), { superset: "A" });
    }

    // Isolation 1 and 2
    const lowerQueue = [...lowerInj];
    const iso1Inj = lowerQueue.shift() ?? null;
    const iso2Inj = lowerQueue.shift() ?? null;
    if (iso1Inj) chainSlot(D, "D1.iso1", "Lower isolation 1 (injury chain)", iso1Inj);
    else rule(D, "D1.iso1", "Lower isolation 1 — adductors", "lower_isolation",
      "Adductor isolation (cable adduction / Copenhagen dips).", pickLadder(ladderFor(ADDUCTOR_LADDER, goal, [])));
    if (iso2Inj) chainSlot(D, "D1.iso2", "Lower isolation 2 (injury chain)", iso2Inj);
    else {
      const regionOrder = ladderFor(POSTERIOR_REGION_ORDER, goal, ["glute", "low back", "hamstring"]).filter(
        (r) => hasDay4 ? r !== "hamstring" : true
      );
      const postPool = pool("Hypertrophy", "Lower isolation").filter((r) => regionOrder.includes(r.region ?? "") && !used.has(r.exercise_id));
      const sorted = [...postPool].sort((a, b) => {
        const ra = regionOrder.indexOf(a.region ?? ""), rb = regionOrder.indexOf(b.region ?? "");
        return ra - rb || LEVEL_RANK[b.min_experience ?? "N"] - LEVEL_RANK[a.min_experience ?? "N"] || a.exercise_id.localeCompare(b.exercise_id);
      });
      const safeSorted = sorted.some(safe) ? sorted.filter(safe) : sorted;
      rule(D, "D1.iso2", "Lower isolation 2 — posterior chain", "lower_isolation",
        "Posterior-chain isolation (glute / low back / hamstring by phase).", safeSorted[0]?.exercise_id ?? null);
    }
    lowerOverflow = lowerInj.filter((i) => ![iso1Inj, iso2Inj].includes(i));
  }

  // ---- Day 2: Upper Strength 1 ----
  if (hasDay("upper_strength_1")) {
    const D: DayType = "upper_strength_1";
    if (exactlyTwo) {
      shortlist(D, "D2.cod", "Speed — change of direction / agility", "speed_cod",
        "COD opener (only at exactly 2 days/week). Full recovery; technique-clean.",
        rank(tagged("Speed", "Change of direction")).slice(0, MAX_CANDIDATES));
    }
    const press = pool("Technical coordination", "Press/Jerk");
    const ballistic = pool("Technical coordination", "Upper ballistic");
    let upTc = pickByDepth(press, "D2.tc");
    if (!upTc) upTc = pickByDepth(ballistic, "D2.tc");
    rule(D, "D2.tc", "Technical coordination (upper)", "technical_coordination",
      "Explosive upper-body coordination touch; novice = kneeling plyo push-up / kneeling DB push press, advanced = push press.", upTc);

    const p0 = pairPlaneFor(0), p1 = pairPlaneFor(1);
    shortlist(D, "D2.abs_push", `Absolute strength — upper push (${p0})`, "absolute_strength",
      `Heavy push paired with the pull below (same plane: ${p0}).`, rank(upperPush(p0, "abs")), { superset: "B" });
    shortlist(D, "D2.abs_pull", `Absolute strength — upper pull (${p0})`, "absolute_strength",
      `Heavy pull paired with the push above (same plane: ${p0}).`, rank(upperPull(p0, "abs")), { superset: "B" });
    shortlist(D, "D2.cmp_push", `Upper compound — push (${p1})`, "upper_compound",
      `Hypertrophy-oriented push, the OTHER plane (${p1}) from the superset above.`, rank(upperPush(p1, "cmp")), { superset: "C" });
    shortlist(D, "D2.cmp_pull", `Upper compound — pull (${p1})`, "upper_compound",
      `Hypertrophy-oriented pull, the OTHER plane (${p1}) from the superset above.`, rank(upperPull(p1, "cmp")), { superset: "C" });

    // Shoulder health (or elbow / wrist chain) + core frontal/transverse
    let upInj = upperInj[0] ?? null;
    if (!upInj) upInj = { location: "shoulder", status: "historical", monthsAgo: null }; // default maintenance
    const maintenanceOnly = !upperInj[0];
    const slot5 = chainSlot(D, "D2.health", "Shoulder health / elbow / wrist", upInj);
    if (slot5) {
      slot5.superset = "D";
      if (maintenanceOnly) slot5.intent = "Shoulder-health maintenance (no flagged upper-body injury). Light standing dose.";
      if (maintenanceOnly) { slot5.injury = undefined; }
    }
    if (!maintenanceOnly && upInj) placed.add(upInj);
    shortlist(D, "D2.core", "Core — frontal or transverse plane", "core",
      "Anti-lateral-flexion (frontal) or rotational/anti-rotation (transverse) core work superset with the slot above.",
      rank([...pool("Core", "Frontal"), ...pool("Core", "Transverse")]).slice(0, MAX_CANDIDATES), { superset: "D" });
    upperOverflow = upperInj.slice(1);
  }

  // ---- Day 3: Athlete Day ----
  if (hasDay3) {
    const D: DayType = "athlete_day";
    rule(D, "D3.accel", "Speed — acceleration", "speed_accel",
      "Dedicated acceleration/sprint work; full recovery between reps (Speed rest, not conditioning rest).",
      pickLadder(ladderFor(ACCEL_LADDER, goal, [])));
    shortlist(D, "D3.cod", "Speed — change of direction", "speed_cod",
      "COD / cutting work; full recovery between reps.",
      rank(tagged("Speed", "Change of direction")).slice(0, MAX_CANDIDATES));
    shortlist(D, "D3.jump_bi", "Plyometrics — bilateral jump", "plyometrics",
      "Bilateral jump superset with the unilateral jump below; quality over volume.",
      rank(pool("Plyometrics", "Bilateral")).slice(0, MAX_CANDIDATES), { superset: "A" });
    shortlist(D, "D3.jump_uni", "Plyometrics — unilateral jump", "plyometrics",
      "Unilateral jump paired with the bilateral jump above.",
      rank(pool("Plyometrics", "Unilateral")).slice(0, MAX_CANDIDATES), { superset: "A" });
    const refl = pickLadder(ladderFor(REFLEXIVE_LADDER, goal, []));
    rule(D, "D3.reflex", "Reflexive strength", "reflexive_strength",
      "Fast, loaded, sport-pattern movement (hip lock / quick reversal / drop-and-catch / rotational rebound), low reps, maximal intent.", refl);
    // Calf / Achilles
    if (calfInj) chainSlot(D, "D3.calf", "Calf isolation (Achilles chain)", calfInj);
    else {
      let calf = pickLadder(ladderFor(CALF_LADDER, goal, []));
      if (!calf) { calf = pickLadder(CALF_FALLBACK); if (calf) warnings.push("Athlete Day — calf slot fell back to isometric calf holds (no dumbbell/barbell available)."); }
      rule(D, "D3.calf", "Calf isolation", "calf", "Calf isolation work, controlled tempo.", calf);
    }
  }

  // ---- Day 4: Lower Body Power ----
  if (hasDay4) {
    const D: DayType = "lower_body_power";
    const d1tc = days.get("lower_strength")?.find((s) => s.slot_key === "D1.tc")?.picked ?? null;
    const loaded = pool("Technical coordination", "Loaded jumps");
    let tc4 = pickByDepth(loaded, "D4.tc");
    if (!tc4) {
      // no loaded jump available: one rung below Day 1's pick, if there is one
      const d1row = d1tc ? byId.get(d1tc) : null;
      const below = (d1row?.regress_from ?? []).find((id) => byId.get(id) && eligible(byId.get(id)!) && !used.has(id));
      tc4 = below ?? null;
    }
    if (tc4) {
      rule(D, "D4.tc", "Technical coordination (lower, lighter/faster)", "technical_coordination",
        "LIGHTER / FASTER than Day 1: lower-rep, higher-velocity scheme. Never the same exercise as Day 1.", tc4);
    } else {
      const sl = shortlist(D, "D4.tc", "Jump / power opener (TC fallback)", "plyometrics",
        "No loaded-jump or lower-rung TC exercise is available for this athlete; use a bilateral jump as the fast opener.",
        rank(pool("Plyometrics", "Bilateral")).slice(0, MAX_CANDIDATES));
      sl.notes.push("Fallback for technical coordination.");
    }
    const uniAll = [...ladderFor(LOWER_PUSH_UNILATERAL_LADDER, goal, []), ...LOWER_PUSH_UNILATERAL_ALL];
    // Day 4 must differ from Day 1 (`used` already contains Day 1's pick)
    const abs4 = pickLadder(uniAll);
    rule(D, "D4.abs", "Absolute strength — lower push (unilateral)", "absolute_strength",
      "Unilateral strength (rear-foot-elevated family; front squat if knee/equipment demands), paired with the jump below as contrast.",
      abs4, { superset: "A" });
    shortlist(D, "D4.jump", "Plyometrics — contrast jump", "plyometrics",
      "Jump contrast-paired with the unilateral strength move above.",
      rank([...pool("Plyometrics", "Bilateral"), ...pool("Plyometrics", "Unilateral")]).slice(0, MAX_CANDIDATES), { superset: "A" });
    if (goal === "power_conversion" || goal === "peak_taper") {
      rule(D, "D4.reflex", "Reflexive strength", "reflexive_strength",
        "Fast, loaded sport-pattern movement; different exercise from Athlete Day's.", pickLadder(ladderFor(REFLEXIVE_LADDER, goal, [])));
    } else {
      const hamIso = pool("Hypertrophy", "Lower isolation").filter((r) => r.region === "hamstring");
      const comp = elig.filter((r) =>
        (r.category === "Hypertrophy" && r.subcategory === "Lower compound") ||
        (r.category === "Absolute strength" && r.subcategory === "Lower pull"));
      const rows = rank([...hamIso, ...comp]);
      const sorted = [...rows].sort((a, b) => (a.region === "hamstring" ? 0 : 1) - (b.region === "hamstring" ? 0 : 1));
      shortlist(D, "D4.lower", "Lower compound + hamstring", "lower_hypertrophy",
        "Early-phase lower compound; hamstring work lives here (Day 4) when the athlete trains 4+ days/week.", sorted);
    }
  }

  // ---- Day 5: Upper Strength 2 ----
  if (hasDay("upper_strength_2")) {
    const D: DayType = "upper_strength_2";
    const d2tc = days.get("upper_strength_1")?.find((s) => s.slot_key === "D2.tc")?.picked;
    const exclude = new Set(d2tc ? [d2tc] : []);
    let tc5 = pickByDepth(pool("Technical coordination", "Upper ballistic"), "D5.tc", exclude);
    if (!tc5) tc5 = pickByDepth(pool("Technical coordination", "Press/Jerk"), "D5.tc", exclude);
    rule(D, "D5.tc", "Technical coordination (upper)", "technical_coordination",
      "Upper explosive touch, different exercise from Upper Strength 1's.", tc5);
    const p = pairPlaneFor(1); // opposite plane from Day 2's absolute-strength superset
    shortlist(D, "D5.abs_push", `Absolute strength — upper push (${p})`, "absolute_strength",
      `Heavy push, OPPOSITE plane (${p}) from Upper Strength 1's absolute-strength superset.`, rank(upperPush(p, "abs")), { superset: "A" });
    shortlist(D, "D5.abs_pull", `Absolute strength — upper pull (${p})`, "absolute_strength",
      `Heavy pull, plane ${p}.`, rank(upperPull(p, "abs")), { superset: "A" });
    const omit = profile.phaseNumber % TRISET_GROUPS.length;
    const groups = TRISET_GROUPS.filter((_, i) => i !== omit);
    groups.forEach((g, i) => {
      shortlist(D, `D5.iso${i + 1}`, `Upper isolation — ${g}`, "upper_isolation",
        "Tri-set arm/shoulder isolation: three groups rotate across phases; higher reps, controlled tempo.",
        rank(pool("Hypertrophy", "Upper isolation").filter((r) => r.region === g)).slice(0, MAX_CANDIDATES),
        { superset: "B" });
    });
  }

  // ---- Day 6 + conditioning finisher ----
  const d6 = hasDay("energy_systems");
  if (d6) {
    const D: DayType = "energy_systems";
    rule(D, "D6.cond", "Conditioning (energy systems)", "conditioning",
      "Phase-mapped energy-system session; rest comes from conditioning work:rest ratios, not from the library.",
      pickConditioning(frames));
  }
  if (hasDay("upper_strength_1") && profile.daysPerWeek <= 5 && !profile.hasLeagueDay) {
    const D: DayType = "upper_strength_1";
    const second = frames.length > 1 ? frames.slice(1) : frames;
    rule(D, "D2.cond", "Conditioning finisher", "conditioning",
      "Short finisher dose (shorter than a full Energy Systems session). Skip within ~5-7 days of a priority event.",
      pickConditioning([...second, ...frames]));
  }

  // ---------- extra injury slots ----------
  const lowerHosts: Record<number, DayType[]> = {
    2: ["lower_strength", "lower_strength"],
    3: ["lower_strength", "athlete_day", "lower_strength"],
    4: ["lower_body_power", "athlete_day", "lower_strength"],
    5: ["lower_body_power", "athlete_day", "lower_strength"],
    6: ["energy_systems", "lower_body_power", "athlete_day", "lower_strength"],
  };
  const upperHosts: Record<number, DayType[]> = {
    2: ["upper_strength_1", "upper_strength_1"],
    3: ["upper_strength_1", "upper_strength_1"],
    4: ["upper_strength_1", "upper_strength_1"],
    5: ["upper_strength_2", "upper_strength_1"],
    6: ["upper_strength_2", "energy_systems", "upper_strength_1"],
  };
  const extrasOn = (d: DayType) => (days.get(d) ?? []).filter((s) => s.extra_injury).length;
  const placeExtra = (inj: InjuryAreaInput, hosts: DayType[], times: number) => {
    let n = 0;
    const tried = new Set<DayType>();
    for (const host of hosts) {
      if (n >= times) break;
      if (!hasDay(host) || tried.has(host) || extrasOn(host) >= MAX_EXTRAS_PER_DAY) continue;
      tried.add(host);
      const key = `${dayKeyPrefix(host)}.inj_${inj.location}`;
      const s = chainSlot(host, key, `Injury resilience — ${inj.location.replace(/_/g, " ")}`, inj, { extra: true });
      if (s) n++;
      else break;
    }
    if (n === 0) warnings.push(`No session had room for an extra ${inj.location} resilience slot (max ${MAX_EXTRAS_PER_DAY} per session).`);
  };
  for (const inj of lowerOverflow) placeExtra(inj, lowerHosts[profile.daysPerWeek] ?? lowerHosts[2], inj.status === "active" ? 2 : 1);
  for (const inj of upperOverflow) placeExtra(inj, upperHosts[profile.daysPerWeek] ?? upperHosts[2], inj.status === "active" ? 2 : 1);
  // Day 6: "injury chain if an injury is active" — give it the top active injury if it has no extra slot there yet.
  if (hasDay("energy_systems") && extrasOn("energy_systems") === 0) {
    const act = injuries.find((i) => i.status === "active");
    if (act) {
      const s6 = chainSlot("energy_systems", `D6.inj_${act.location}`, `Injury resilience — ${act.location.replace(/_/g, " ")}`, act, { extra: true });
      void s6;
    }
  }
  // The conditioning finisher closes Upper Strength 1; extras go ahead of it.
  const d2 = days.get("upper_strength_1");
  if (d2) {
    const i = d2.findIndex((x) => x.slot_key === "D2.cond");
    if (i >= 0) d2.push(...d2.splice(i, 1));
  }
  void placed;

  // =====================================================================
  // PASS 2 — shortlists: drop rule picks, enforce size, record unsafe
  // =====================================================================
  for (const s of allSlots) {
    if (s.mode !== "shortlist") continue;
    s.candidates = s.candidates.filter((id) => !used.has(id));
    const priorId = prior.picks[s.slot_key];
    if (priorId && s.candidates.includes(priorId)) {
      // keep the previous phase's pick available but rank its successors first
      const successors = new Set(byId.get(priorId)?.progress_to ?? []);
      s.candidates.sort((a, b) => Number(successors.has(b)) - Number(successors.has(a)));
    }
    s.candidates = s.candidates.slice(0, MAX_CANDIDATES);
    noteUnsafe(`${DAY_LABELS[s.day_type]} — ${s.label}`, s.candidates);
    if (s.candidates.length > 0 && s.candidates.length < 3) s.notes.push(`Only ${s.candidates.length} eligible option(s) for this athlete.`);
    // coach pin on a shortlist slot converts it to a rule slot
    const pin = profile.pins[s.slot_key];
    if (pin && byId.has(pin)) {
      s.mode = "rule"; s.picked = pin; s.candidates = []; s.pinned = true;
      used.add(pin);
    }
  }
  // Slots whose shortlist is empty cannot be filled by the model either — drop them.
  for (const [d, list] of days) {
    days.set(d, list.filter((s) => !(s.mode === "shortlist" && s.candidates.length === 0)));
  }

  // Isometric rung in a slot that is NOT an active injury = equipment fallback; surface it.
  for (const s of allSlots) {
    if (s.mode !== "rule" || !s.picked || s.injury?.status === "active") continue;
    const r = byId.get(s.picked);
    const ms = r?.chain_memberships ?? [];
    if (ms.length > 0 && ms.every((m) => m.type === "isometric") && !s.pinned)
      warnings.push(`${DAY_LABELS[s.day_type]} — ${s.label}: isometric hold used as an equipment fallback (no active injury).`);
  }

  // ---------- assemble ----------
  const out: PlannedDay[] = [];
  for (const d of DAY_ORDER) {
    if (!hasDay(d)) continue;
    const slots = (days.get(d) ?? []);
    slots.forEach((s, i) => (s.order = i + 1));
    out.push({ day_type: d, label: DAY_LABELS[d], slots });
  }
  return { phase_goal: params.goal, days: out, warnings };

  function dayKeyPrefix(d: DayType) {
    return { lower_strength: "D1", upper_strength_1: "D2", athlete_day: "D3", lower_body_power: "D4", upper_strength_2: "D5", energy_systems: "D6" }[d];
  }
}

