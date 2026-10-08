# Day Structure Templates — Six Fixed Day Types, By Training Frequency & Phase (v2 slot-fill)

*This is the slot-level layer between `coaching-philosophy.md` (why) and the Phase Builder's exercise selection (what). The app turns it into a per-athlete **slot plan** before the model runs (`lib/generation/slots`): for each slot it either picks the exercise by rule (RULE) or builds a short list of eligible options (SHORTLIST). The model's job is the prescription — sets, reps, tempo, rest, loading, cues — and choosing from shortlists. Slot ORDER is fixed by day type and never changes phase to phase; what changes by phase is dosing, which exercises the rules select, and overall session volume.*

*Categories used throughout (the library's v2 tags): Technical coordination (Olympic-lift family, loaded jumps, push press / jerk, upper ballistics) · Absolute strength (lower push, lower pull, upper push, upper pull) · Hypertrophy (upper compound, lower compound, upper isolation, lower isolation) · Injury resilience (isometric → heavy slow resistance chains per area) · Speed (acceleration, change of direction) · Plyometrics (bilateral, unilateral) · Core (sagittal, frontal, transverse) · Reflexive strength · Conditioning (by time frame). Mobility is not part of the library or any day.*

---

## The six day types and their priority order

**Every athlete uses these same six day types, in this order, regardless of how many training days/week they picked.** Lower frequency doesn't mean a different split — it means fewer of these appear, dropped from the bottom of the list.

| Priority | Day type | Appears at ≥ this many days/week |
|---|---|---|
| 1 | **Lower Strength** | 2 |
| 2 | **Upper Strength 1** | 2 |
| 3 | **Athlete Day** (speed, agility, jumps, reflexive strength) | 3 |
| 4 | **Lower Body Power** | 4 |
| 5 | **Upper Strength 2** | 5 |
| 6 | **Energy Systems** | 6 |

| Days/week | Days included, in weekly order |
|---|---|
| 2 | Lower Strength, Upper Strength 1 |
| 3 | Lower Strength, Upper Strength 1, Athlete Day |
| 4 | + Lower Body Power |
| 5 | + Upper Strength 2 |
| 6 | + Energy Systems |

**League day rule (see `coaching-philosophy.md` Section 5):** if the athlete has a league/game day on their schedule, it satisfies the Energy Systems role entirely — no dedicated Energy Systems day and no conditioning finisher on top of it. The athlete still trains exactly the number of days they chose.

---

## Global rules the plan already applies

- **RULE vs SHORTLIST.** RULE slots are picked by the app and stay fixed for the whole phase (chains advance phase to phase, never within a phase). SHORTLIST slots offer 3–8 eligible options; choose one and hold it for the phase unless progression needs a change. The model may break either only with a stated reason, which becomes a coach review flag. The coach can pin an exercise to a slot for an athlete. Athletes can swap within the same category while logging.
- **No repeats in a week.** The same exercise is never used twice in one week.
- **Eligibility** is applied before the model sees anything: equipment, available space (minimal ≤ 5 yd, standard ≈ 5–20 yd, large 20+ yd), lifting-experience level (N / C / VE), the exercise's phase window, and — for an ACTIVE injury — preference for options that do not load the injured joint.
- **Chains end where the athlete's ability ends.** A regression/progression chain stops at the last rung the athlete can do (equipment or experience). There are no substitute rungs.
- **Rest comes from the slot, not the exercise.** Speed slots take full recovery between reps. Conditioning slots use conditioning work:rest ratios. Pause, tempo and box-height variations are prescription modifiers, not separate exercises.
- **Olympic-lift gating** is encoded in each exercise's minimum experience. A NEW lifter's first 6 months on the app use the lower TC pool of med ball scoop toss, dumbbell jump squat and backpack jump squat; after 6 months they are re-evaluated as Comfortable.

---

## Slot Vocabulary

| Slot | Intent |
|---|---|
| **Speed — acceleration** | RULE by phase. Early: sprint mechanics and wall drills. Middle: starts and resisted work. Late: flying sprints and full-speed starts. Full recovery between reps. At exactly 2 days/week it opens Lower Strength; at 3+ days it lives on Athlete Day. Never on both. |
| **Speed — change of direction** | SHORTLIST. Cutting and COD work (shuttles, cone drills, resisted lateral bounds, hurdle hops with stick landings). At exactly 2 days/week it opens Upper Strength 1; at 3+ days it lives on Athlete Day. Full recovery between reps. |
| **Technical coordination (lower)** | RULE, gated by experience. Lower Strength = the HEAVIER exposure (top eligible rung of the Olympic-lift chain for the phase; clean pull in Max Strength). Lower Body Power = LIGHTER / FASTER (loaded jumps or a lower rung, lower-rep faster scheme) and never the same exercise as Lower Strength. |
| **Technical coordination (upper)** | RULE by experience. Press/jerk chain (novice: kneeling plyo push-up or kneeling DB push press; advanced: push press; jerks only in Power/Peak for very experienced). Upper Strength 2 uses a different exercise from Upper Strength 1. |
| **Absolute strength** | Lower push (RULE): the day's featured strength move. Unilateral (rear-foot-elevated family) at 2–3 days/week and on Lower Body Power; bilateral at 4+ days/week on Lower Strength. Upper push/pull (SHORTLIST) are supersetted in the SAME plane. |
| **Lower hypertrophy (compound)** | SHORTLIST on Lower Strength: balance the day's absolute-strength move (squat/lunge-dominant → pick a hinge/posterior-chain compound). Includes lower-pull rows. Below 4 days/week hamstring rows join this pool; at 4+ days hamstring work lives on Lower Body Power in early phases. |
| **Upper compound** | SHORTLIST, push/pull superset in the OTHER plane from Upper Strength 1's absolute-strength superset. |
| **Core** | Sagittal with the lower hypertrophy move (Core injury chain replaces it if core is injured). Frontal OR transverse with shoulder health on Upper Strength 1. |
| **Lower isolation 1 / 2** | RULE. Injured area's chain if one applies (priority: active > recent history > older), otherwise adductor work, then posterior chain (hamstring/glute/low back by phase). |
| **Calf isolation** | RULE on Athlete Day, injured or not (Achilles/calf chain if injured). At exactly 2 days/week calf/Achilles work rides on Lower Strength's isolation slots. |
| **Shoulder health (or elbow / wrist chain)** | RULE on Upper Strength 1, superset with core. Defaults to shoulder maintenance when no upper-body injury is flagged. |
| **Plyometrics** | SHORTLIST. Bilateral jump supersetted with a unilateral jump on Athlete Day. On Lower Body Power the jump is contrast-paired with the unilateral strength move. |
| **Reflexive strength** | RULE by phase ladder. FAST, loaded, sport-pattern movements — drop-and-catch (e.g. dumbbell drop snatch to a box), hip lock (e.g. single-leg RDL to hip lock), quick reversal, and rotational/rebound med ball work (rotational power throws, wall rebounds). 2–5 reps, maximal intent, heavier expressions in later phases. NOT carries or slow loaded holds. |
| **Upper isolation tri-set** | SHORTLIST on Upper Strength 2: three of biceps / triceps / forearm / shoulder, rotating which group sits out phase to phase. |
| **Conditioning** | RULE by phase and time frame; default modality is running drills unless the athlete set another (bike, rower, ski erg, jump rope, incline walk); space, equipment and injury filters apply. |
| **Injury resilience (extra)** | RULE. Added automatically when an injured area is not covered by a primary slot; light dose at the end of the session; at most 2 extras per session. |

**Conditioning by phase:** GPP > 10 min · Hypertrophy > 10 min and 2–10 min · Max Strength 2–10 min and 30 s–2 min · Power Conversion 30 s–2 min and 10–30 s · Peak/Taper repeated sprint sets, < 10 s and 10–30 s (minimal near a priority event).

**Reflexive strength ladder:** GPP RS-008, 011, 012, 001, 004, 015 · Hypertrophy RS-012, 013, 002, 004/005, 015 · Max RS-013, 003, 005, 006, 007, 014, 016 · Power/Peak RS-006, 007, 009, 010, 014, 017, 018 (Peak: light touch, omitted in the final 5–7 days). Athlete Day and Lower Body Power never share an exercise.

---

## Day 1 — Lower Strength

**Slot order:** [Speed — acceleration, only at exactly 2 days/week] → Technical coordination (lower, heavier) → Absolute strength (lower push) → Lower hypertrophy ⟷ Core sagittal (superset) → Lower isolation 1 → Lower isolation 2 → [extra injury slots]

Present at every training frequency. This is the one day every athlete always has, so it is the primary home for lower-body injury chains.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | Absolute strength + hypertrophy compound 3–4x8–12 @ RPE 6–7 (~60–70%); technical coordination technique-priority, light-moderate, 3–4x3–5; core 3x10–15; acceleration (2 days/wk) sub-maximal, technical; isolation 2–3x10–15; injury work at its standing dose |
| Hypertrophy | Strength + hypertrophy compound 3–4x8–12 @ RPE 7–8 (~65–75%); TC 3–4x3–5, load builds as technique holds; core 3x10–15; isolation 3x10–15 |
| Max Strength | Strength + compound wave-loaded 4–6→2–3 reps @ RPE 8–9.5 (~80–92%); TC 4–5x2–3 (clean pull allowed), heaviest technically sound load of the year; contrast pairing for advanced/intermediate; core 3x6–10; isolation 3x8–12 |
| Power Conversion | Strength + compound ~75–85%, volume down; TC 3–4x2–3, moderate load, maximal bar speed; core 2–3x8–10; isolation 2–3x8–10 |
| Peak/Taper | Sharp cut (~40–60% of Power Conversion volume) across every slot; TC 2–3x2–3, light, technique-clean; isolation light |

---

## Day 2 — Upper Strength 1

**Slot order:** [Speed — change of direction, only at exactly 2 days/week] → Technical coordination (upper) → Absolute strength push ⟷ pull (superset, plane A) → Upper compound push ⟷ pull (superset, plane B) → Shoulder health (or elbow/wrist chain) ⟷ Core frontal or transverse (superset) → [extra injury slots] → Conditioning finisher (2–5 days/week, no league day)

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | Absolute-strength superset 3–4x8–12 @ RPE 6–7; upper compound 3x10–15; TC technique-focus, light-moderate; shoulder health + core at standing-maintenance dose; COD opener (2 days/wk) = single-leg hurdle hops with controlled stick landings, technical and unhurried; finisher short and aerobic |
| Hypertrophy | Absolute-strength superset 3–4x8–12 @ RPE 7–8; upper compound 3–4x10–12 (extra volume if tolerated); COD opener continues the stick-landing progression with volume building |
| Max Strength | Absolute-strength superset wave-loaded 4–6→2–3 @ RPE 8–9.5; upper compound 3x8–10; TC stays light/technical even as the superset gets heavy; COD opener adds continuous multidirectional hopping and resisted lateral bounds/decel |
| Power Conversion | Absolute-strength superset ~75–85%, volume down; upper compound 2–3x8–10; TC maximal intent, low volume; COD opener = true cutting drills |
| Peak/Taper | Sharp cut across every slot; TC present but minimal; COD light touch, technique-clean; finisher minimal near a priority event |

---

## Day 3 — Athlete Day

**Slot order:** Speed — acceleration → Speed — change of direction → Plyometrics: bilateral jump ⟷ unilateral jump (superset) → Reflexive strength → Calf isolation (Achilles chain if injured) → [extra injury slots]

The dedicated speed/jump session — appears at 3+ days/week. At exactly 2 days/week acceleration and COD relocate to Lower Strength and Upper Strength 1.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | Acceleration sub-maximal (~85–95% effort), technical, 4–6 reps of 10–20 yd (or wall/in-place drills in minimal space); COD stick-landing hops, unhurried; jumps low-intensity bilateral + entry unilateral, 2–3x4–6; reflexive entry-level, 2–3x3/side, light; calf 3x10–15 |
| Hypertrophy | Acceleration volume builds, intent trending to 95–100%; COD volume building; jumps moderate intensity; reflexive advances one rung if technique is sound, 3x3–4/side; calf 3x8–12 |
| Max Strength | True acceleration/sprinting, 95–100%+ effort, full recovery, lower volume; COD resisted lateral work and continuous hops; jumps higher intensity (depth jumps appear), 3x3–5; reflexive mid-ladder, 3x3–4/side; calf heavy 3x6–8 |
| Power Conversion | Maximal-intent acceleration (flying sprints, full-speed starts); true COD sprinting/cutting; jumps maximal-intent, contrast-paired, very low volume; reflexive full-expression, 2–3x3/side, maximal intent |
| Peak/Taper | Technique-clean sprint touches only; COD light; jumps no new stimulus; reflexive light touch, omitted in the final ~5–7 days before a priority event; calf maintenance |

---

## Day 4 — Lower Body Power

**Slot order:** Technical coordination (lower, LIGHTER/FASTER) → Absolute strength (unilateral) ⟷ jump (contrast superset) → Early phases (GPP, Hypertrophy, Max): Lower compound with hamstring work · Late phases (Power, Peak): Reflexive strength → [extra injury slots]

Appears at 4+ days/week. The rear-foot-elevated family is the featured unilateral strength move (front squat is an equally valid alternate when knees or equipment demand it).

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | TC loaded jump 3x4–5, light, fast; unilateral strength 3x8–10, moderate; jump 2–3x5; lower compound + hamstring 2–3x8–10 |
| Hypertrophy | TC 3x3–5; unilateral 3–4x6–8; contrast pairing introduced late (advanced only); lower compound + hamstring 3x8–10 |
| Max Strength | TC high intent 3–4x2–4; unilateral 3–5x3–5 @ 80–85% (the primary unilateral strength expression of the macrocycle); contrast pairing for advanced/intermediate; hamstring work 2–3x6–8, load building |
| Power Conversion | TC maximal velocity 3x2–3; unilateral 3x3–5, maximal intent, contrast prioritized; finisher is reflexive strength 2–3x3/side |
| Peak/Taper | TC light touch; unilateral light (2x3 @ ~70%) or omitted in the final ~5–7 days before a priority event; reflexive light touch |

**ACL/knee history:** unilateral load and volume follow `coaching-philosophy.md`'s ACL-history progression instead of the standard band above until the athlete has been cleared through it.

---

## Day 5 — Upper Strength 2

**Slot order:** Technical coordination (upper, different from Day 2) → Absolute strength push ⟷ pull (superset, OPPOSITE plane from Day 2's) → Upper isolation tri-set (three of biceps / triceps / forearm / shoulder) → [extra injury slots]

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | TC technique-focus; superset 3–4x10–15, moderate load; tri-set 3x12–15 |
| Hypertrophy | Peak volume of the macrocycle — 3–4x10–15, some isolation sets to 15–20; TC load builds as technique holds |
| Max Strength | Tapering from peak — 3x8–10, maintenance dosing; TC stays light/technical |
| Power Conversion | Often the first day cut if the schedule compresses around games |
| Peak/Taper | Usually dropped entirely |

---

## Day 6 — Energy Systems

**Slot order:** Conditioning (by phase) → injury-resilience slot if an injury is active (isometric steps allowed) → [extra injury slots]

Appears only at 6 days/week and only when the athlete has no league day.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | Aerobic base, > 10 min continuous, low intensity (RPE 4–5) |
| Hypertrophy | Aerobic-to-mixed: > 10 min and 2–10 min intervals (RPE 6–7) |
| Max Strength | 2–10 min and 30 s–2 min intervals, anaerobic capacity (RPE 7–8) |
| Power Conversion | 30 s–2 min and 10–30 s repeated efforts matching point/tournament demands (RPE 8–9) |
| Peak/Taper | Minimal — repeated sprint sets and short sprint touches; none within ~5–7 days of a priority event |

---

## Extra injury-resilience slots

When an injured area is not covered by a primary slot, the app adds a light-dose slot at the end of a session (maximum two extras per session). Active injuries get priority, then recent history, then older history. Isometric steps are for ACTIVE injuries only; a historical area starts at the first heavy-slow-resistance step and advances one rung per phase when the Phase Performance Summary says it was handled well.

| Days/wk | Lower extras land on | Upper extras land on |
|---|---|---|
| 2 | Lower Strength | Upper Strength 1 |
| 3 | Lower Strength, then Athlete Day | Upper Strength 1 |
| 4–5 | Lower Body Power, Athlete Day, Lower Strength | Upper Strength 1 (4 days) · Upper Strength 2 then Upper Strength 1 (5 days) |
| 6 | Energy Systems, Lower Body Power, Athlete Day, Lower Strength | Upper Strength 2, Energy Systems, Upper Strength 1 |

---

## Notes for implementation

- A reduced-recovery week (e.g. a game week that leaves room for fewer "fresh" sessions) doesn't silently drop a day — combine that week's lower-priority content into practice-adjacent days at reduced intensity instead, per `coaching-philosophy.md` Section 5, and say so in the coach review flags.
- Where a slot's pool is empty for an athlete (no equipment, no space), the plan drops it and records a warning; the coach sees it in the review flags.
- Mobility/recovery work is intentionally absent from every day type.
