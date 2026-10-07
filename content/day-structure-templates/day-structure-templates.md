# Day Structure Templates — Six Fixed Day Types, By Training Frequency & Phase

*Maintained separately from `coaching-philosophy.md`, same way the Training Targets Reference is — this is the concrete slot-by-slot template the Phase Builder should fill with real exercises from the filtered library. It operationalizes Section 5's rules (exercise order within a session, movement-pattern balance, speed/power year-round, injury resilience every phase, the league-day rule) into a fixed structure, so the AI is choosing WHICH exercise fills a slot, not inventing session structure from scratch each time.*

*Built from a Garage Strength-style 5-day framework (lower/upper/athlete/impulse/hypertrophy day archetypes), extended to 6 days with a dedicated Energy Systems day, this coach's own single-leg-squat-as-RFESS convention, and a loaded Reflexive Strength quality on Athlete Day (see the Slot Vocabulary below) — all reworked into this coach's own structure, slot names, and dosing, not a reproduction of any outside program.*

*Slot ORDER is fixed by day type — it does not change phase to phase. What changes by phase is dosing (sets/reps/intensity), which slots carry contrast/complex pairing, and overall session volume.*

*Revision note: every day's slot order and several slot definitions below were corrected against the coach's own exact session-order dictation (see the coach's day-by-day walkthrough and the "Olympic-lift gating" section) — this supersedes an earlier draft of this document that predated that walkthrough and diverged from it in several places (Athlete Day and Lower Body Power slot order, Upper Strength 2's missing opener, where CORE_ROTATIONAL lives, and the injury-resilience slot being swapped-in/optional on Lower Strength and Upper Strength 1 days rather than always present).*

---

> **Naming change (Oct 2026):** day types were renamed — structure is UNCHANGED. Lower Body Strength → **Lower Strength**; Upper Body Strength → **Upper Strength 1**; Athlete Day → Athlete Day; Impulse Day → **Lower Body Power**; Hypertrophy Day → **Upper Strength 2**; Energy System Day → **Energy Systems**. Older sessions/drafts may still carry the old names.

## The six day types and their priority order

**Every athlete uses these same six day types, in this order, regardless of how many training days/week they picked.** Lower frequency doesn't mean a different split — it means fewer of these appear, dropped from the bottom of the priority list.

| Priority | Day type | Appears at ≥ this many days/week |
|---|---|---|
| 1 | **Lower Strength** | 2 |
| 2 | **Upper Strength 1** | 2 |
| 3 | **Athlete Day** (speed/acceleration + agility) | 3 |
| 4 | **Lower Body Power** (Olympic lift + RFESS + plyometrics) | 4 |
| 5 | **Upper Strength 2** | 5 |
| 6 | **Energy Systems** | 6 |

| Days/week | Days included, in weekly order |
|---|---|
| 2 | Lower Strength, Upper Strength 1 |
| 3 | Lower Strength, Upper Strength 1, Athlete |
| 4 | Lower Strength, Upper Strength 1, Athlete, Lower Body Power |
| 5 | Lower Strength, Upper Strength 1, Athlete, Lower Body Power, Upper Strength 2 |
| 6 | Lower Strength, Upper Strength 1, Athlete, Lower Body Power, Upper Strength 2, Energy Systems |

This priority order is also the week's sequence — Lower Strength day first, Upper Strength 1 day second, and so on. It applies to every athlete at every training age and every phase; only dosing changes, never which days exist at a given frequency.

**League day rule (see `coaching-philosophy.md` Section 5):** if the athlete has a league/game day on their schedule, it satisfies the Energy Systems day's role entirely — don't program a dedicated Energy Systems day or fold a conditioning finisher into another day on top of it. The athlete still trains exactly the number of days they chose; the league day covers the conditioning stimulus instead of a training session. Only fold in or dedicate Energy System content per the rules below when the athlete has no league day on their schedule.

---

## Olympic-lift gating (TECHNICAL_COORDINATION and OLY_OR_EXPLOSIVE slots)

Both Lower Strength (TECHNICAL_COORDINATION) and Lower Body Power (OLY_OR_EXPLOSIVE) include an Olympic-lifting variation as a technical-coordination step. Which variation — or whether one is used at all yet — is gated by the athlete's self-described lifting experience from intake (`athlete_intake.lifting_experience_selfdescribe`), not by the exercise library's own `training_age` tag:

| Self-described experience | Rule |
|---|---|
| **New** (beginner) | No Olympic-lift variations at all for this athlete's first **6 months** of training on the app, measured from their intake date (`athlete_intake.submitted_at`). Use a DB or trap-bar jump in both slots instead. Once 6 months have passed, re-evaluate as "Comfortable with basics." |
| **Comfortable with basics** (moderate) | Beginner Olympic-lift variations — DB variations, hang cleans — are introduced right away, no waiting period. |
| **Very experienced** (advanced) | All Olympic-lift variations are available right away. |

This is a hard time/experience gate, not a phase-emphasis note — it applies identically regardless of which of the five phase goals is currently active. It supersedes any gating implied by an exercise's own `training_age` tag (novice/advanced/both) in the library — that tag describes the movement's own difficulty, not when an individual athlete is allowed to use it.

---

## Slot Vocabulary

| Slot | Intent |
|---|---|
| **SPEED_ACCEL** | Linear acceleration / sprint mechanics. Lives on Athlete Day (3+ days/week) as the full, dedicated speed session (sprint mechanics early in the macrocycle, true acceleration/sprinting later; longer sprints, hill sprints, higher intent). At exactly 2 days/week, where Athlete Day doesn't exist, it moves to Lower Strength day instead — a brief, technical-focus sprint-mechanics opener, not the full session. Never appears on both days in the same week. |
| **TECHNICAL_COORDINATION** | A technical/coordination-focus explosive movement that opens Lower Strength day — present at every training frequency and every phase (including GPP), not just when Lower Body Power is also in the week. Gated by the Olympic-lift gating table above: a genuine Olympic-lift-family movement (power clean, hang clean, clean high pull — default to a hang or high-pull variant over a full-floor pull when both are reasonable, since the shorter pull is easier to keep technically clean at this slot's light-moderate loads) once the athlete's gating tier allows it; a DB or trap-bar jump before then. It is lighter and more technique-focused than Lower Body Power's OLY_OR_EXPLOSIVE main lift when both appear in the same week — a coordination touch, not the day's heavy power expression. |
| **NEURO_PRIMING** | Light elastic/reactive prep (skips, pogo hops, ankling drills) that opens Athlete Day — wakes up the nervous system before the speed and change-of-direction work that follows. |
| **PLYOMETRICS** | Jumps/bounds. On Athlete Day: a complex bilateral jump supersetted with a unilateral jump, sitting after AGILITY — the session's peak-intensity jump expression, once speed and COD work are done. On Lower Body Power: low-amplitude, high-intent plyo (pogo-hop variations are the default) that OPENS the day, before the Olympic lift — and, depending on phase, can be supersetted with the day's lower-body strength lift as contrast training. These are two distinct placements/intents for the same quality, not the same block reused. |
| **AGILITY** | Change-of-direction and cutting work (5-10-5 shuttle, cone drills, curved/banana cuts, reactive mirror and cued-cut drills, mark close-out and backpedal-to-sprint transitions, resisted lateral bounds/shuffles/deceleration steps) — added to Athlete Day beyond the source framework, since cutting/COD is one of ultimate's defining movement demands (Section 3). On Athlete Day (3+ days/week), sits after SPEED_ACCEL and before PLYOMETRICS. At exactly 2 days/week, where Athlete Day doesn't exist, it moves to Upper Strength 1 day instead, as that day's opener. Never appears on both days in the same week. Vary the drill week to week rather than repeating the same one or two every session; several options (juke/hip-turn, lateral shuffle, cone/ladder footwork, band-resisted lateral work) are confined-space-friendly for athletes without field access. |
| **REFLEXIVE_STRENGTH** | Loaded, low-rep (2-5), usually unilateral work from the `Reflexive Strength - Loaded Movement Pattern` exercise category — a distinct quality from PLYOMETRICS above (loaded and lower-CNS-cost vs. unloaded and maximal), used to scaffold a specific sport movement pattern (cutting/separation, or marking/close-out) with increasing complexity as the athlete progresses through the exercise's own regression/progression chain across the macrocycle. Closes Athlete Day, after PLYOMETRICS — sub-maximal and fatigue-tolerant enough to sit last in the session without compromising the max-effort SPEED_ACCEL/PLYOMETRICS work earlier on. Also used as Lower Body Power's finisher in later phases (see HAMSTRING_FINISHER below) — same exercise family, different day, different role. |
| **OLY_OR_EXPLOSIVE** | An Olympic-lift variation (power clean, push press, power jerk) — this day's heaviest/highest-intent Olympic-lift exposure, distinct from Lower Strength day's lighter TECHNICAL_COORDINATION touch. Gated by the Olympic-lift gating table above, same as TECHNICAL_COORDINATION. Sits second on Lower Body Power, after the PLYOMETRICS opener. |
| **SQUAT_PATTERN** | The day's primary bilateral squat-pattern lift (back squat, front squat, goblet squat, scaled to training age/equipment) — or, on Lower Strength day specifically, a Rear Foot Elevated Split Squat used as the day's primary lower-body strength movement instead of a bilateral squat, per the coach's explicit naming of all three as valid primary-movement options. Avoid using RFESS here in the same week Lower Body Power's UNILATERAL slot also uses it, to avoid redundant loading of the identical lift twice in one week. Lives on Lower Strength day. |
| **SECONDARY_PATTERN** | The day's secondary lower-body lift — RDL, Nordic hamstring curl, walking lunge, or other quad work — chosen to balance whatever pattern SQUAT_PATTERN used that day (squat-dominant, hinge-dominant, unilateral; see the movement-pattern-balance rule in `coaching-philosophy.md` Section 5). Generally supersetted with CORE_SAGITTAL. Lives on Lower Strength day, right after SQUAT_PATTERN. (Renamed from an earlier, hinge-only HINGE_PATTERN slot — this is deliberately broader, since the coach named lunge and quad work as equally valid secondary-pattern fillers, not just hinge variations.) |
| **CORE_SAGITTAL** | Sagittal-plane anti-extension core work — plank, dead bug, crunch variations (including their loaded/advanced forms) — supersetted with SECONDARY_PATTERN on Lower Strength day. Distinct from CORE_ROTATIONAL below (sagittal control vs. rotational/throwing-relevant power). |
| **UNILATERAL** | The Rear Foot Elevated Split Squat, loaded as a genuine main strength-power lift, not a token accessory — this coach's standing convention for the "single-leg squat" this split calls for. Lives on Lower Body Power, third in that day's order, after OLY_OR_EXPLOSIVE — can be supersetted with PLYOMETRICS for contrast training depending on phase (see Lower Body Power below). Front squat is an equally valid filler for this slot on Lower Body Power, per the coach's "mostly front squat or RFESS" framing — the slot is "the day's lower-body absolute-strength lift," not RFESS exclusively. |
| **UPPER_POWER** | An explosive upper-body technical/coordination movement that opens Upper Strength 1 day AND Upper Strength 2 day, present at every training frequency and every phase (including GPP), same freshness-first logic as TECHNICAL_COORDINATION on Lower Strength day. For advanced athletes, favor push press or kneeling push press (genuine Olympic-lift-family, coordination-demanding movements) at light-moderate loads. For novice or less-experienced athletes, use a simpler explosive option — kneeling plyo push-up, band-assisted plyo push-up, clap/plyo push-up, or a kneeling DB push press — that trains the same explosive-intent quality without the technical demand of a standing, leg-driven barbell movement; progress a novice toward push press as their technical competency allows. Not governed by the Olympic-lift gating table above (that table is specific to the TECHNICAL_COORDINATION/OLY_OR_EXPLOSIVE Olympic-lift-family slots) — use training-age-appropriate exercise selection here instead. |
| **UPPER_PUSH_PULL_SUPERSET** | A heavy push paired with a heavy pull as a superset (push set → pull set → rest → repeat), not two separate blocks. The day's main upper-body strength work. Appears on both Upper Strength 1 day and Upper Strength 2 day. |
| **SECONDARY_PUSH_PULL** | A second, lighter push/pull pairing or isolation accessory (face pulls, dips, curls, triceps work) rounding out upper-body volume — isolated arm work (biceps/triceps/shoulders) on Upper Strength 2 day specifically. Appears twice on Upper Strength 2 day, once on Upper Strength 1 day, per the source framework's "high-volume, arm-focused" description of that day. |
| **CORE_ROTATIONAL** | Anti-rotation or rotational-power core work hitting the obliques — throwing-relevant per the needs analysis (Section 3). Pairs with Upper Strength 1 day's INJURY_RESILIENCE slot as a superset (shoulder-area injury prevention + rotational/sagittal core), not a standalone slot of its own and not on Lower Body Power. |
| **INJURY_RESILIENCE** | Standing prehab/resilience work. Mandatory, every session, on Lower Strength day and Upper Strength 1 day — not swapped in only when the athlete has a flagged injury area, and never optional. When the athlete has a real injury-history area, use it per `coaching-philosophy.md`'s injury-resilience table and progression (that table governs dosing/progression whenever it applies). When the athlete has NO flagged injury history, default to calf/Achilles or groin/adductor work on Lower Strength day, and shoulder-area work (supersetted with CORE_ROTATIONAL) on Upper Strength 1 day — the most commonly injured areas for ultimate players — at a light, standing-maintenance dose. Never frozen at one variation all year regardless of which case applies. |
| **CONDITIONING** | Energy-system work (repeated-sprint intervals, tempo runs). Dedicated on Energy Systems day (6 days/week, no league day); folded as a finisher onto Athlete Day (3-5 days/week) or Upper Strength 1 day (2 days/week) when the athlete has no league day; optionally also added to Upper Strength 1 day at 4 days/week, or to Upper Strength 2 day at 5 days/week when there's no Day 6, per the coach's note on those days below; absent entirely when a league day already covers it. |
| **HAMSTRING_FINISHER** | A hamstring/knee-flexion movement (e.g. a Nordic curl or leg-curl variation) that closes Lower Body Power in earlier phases, replaced by REFLEXIVE_STRENGTH as the closer in later phases. Same movement family as Lower Strength day's standing hamstring-injury-resilience work, but a different purpose (general posterior-chain/deceleration capacity here, not injury-history-specific dosing) and a different day. |
| ~~MOBILITY_RECOVERY~~ | **Paused for now — do not include this slot.** Mobility/recovery programming is being redesigned; leave it out of every day type until it's reintroduced here with real guidance. Don't substitute general stretching or mobility exercises from the library in its place, and don't shift another slot's exercise selection to compensate for its absence. |

---

## Day 1 — Lower Strength

**Slot order (3+ days/week):** TECHNICAL_COORDINATION → SQUAT_PATTERN → SECONDARY_PATTERN + CORE_SAGITTAL (superset) → INJURY_RESILIENCE

**Slot order (exactly 2 days/week):** SPEED_ACCEL → TECHNICAL_COORDINATION → SQUAT_PATTERN → SECONDARY_PATTERN + CORE_SAGITTAL (superset) → INJURY_RESILIENCE

Present at every training frequency (2-6 days/week) — this is where the injury-resilience guarantee lives for Achilles/calf, groin/adductor, ACL/knee, ankle, hamstring, and low-back history, since it's the one day every athlete always has. TECHNICAL_COORDINATION is likewise present at every frequency and every phase — an advanced athlete's Olympic-lift-family exposure on Lower Strength day never disappears, even in GPP or when Lower Body Power isn't in the week. INJURY_RESILIENCE is now always present here too, not just for athletes with a flagged injury area — see that slot's definition above for the no-injury default.

**SPEED_ACCEL only appears on this day at exactly 2 days/week** (Lower + Upper only, no Athlete Day in the split) — it opens the session, before TECHNICAL_COORDINATION, as a brief, technical-focus sprint-mechanics touch (the coaching-philosophy "speed and jump training: present year-round" guarantee, covered by Athlete Day at 3+ days/week). At 3+ days/week, this slot is dropped from Lower Strength day entirely — the athlete gets their dedicated speed/acceleration work on Athlete Day instead, and Lower Strength day opens straight at TECHNICAL_COORDINATION.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | SQUAT_PATTERN/SECONDARY_PATTERN 3-4x8-12 @ RPE 6-7 (~60-70%); SPEED_ACCEL (2 days/week only) sub-maximal, technical-focus; TECHNICAL_COORDINATION technique-priority, light-moderate load, 3-4x3-5; CORE_SAGITTAL 3x10-15; INJURY_RESILIENCE standing-maintenance dose |
| Hypertrophy | SQUAT_PATTERN/SECONDARY_PATTERN 3-4x8-12 @ RPE 7-8 (~65-75%); SPEED_ACCEL (2 days/week only) building toward higher intent; TECHNICAL_COORDINATION 3-4x3-5, load builds as technique holds; CORE_SAGITTAL 3x10-15 |
| Max Strength | SQUAT_PATTERN/SECONDARY_PATTERN wave-loaded 4-6→2-3 reps @ RPE 8-9.5 (~80-92%); SPEED_ACCEL (2 days/week only) maximal intent, low volume; TECHNICAL_COORDINATION 4-5x2-3, heaviest technically-sound load of the year; contrast pairing (heavy squat + jump) for advanced/intermediate athletes; CORE_SAGITTAL 3x6-10 |
| Power Conversion | SQUAT_PATTERN/SECONDARY_PATTERN ~75-85%, volume down further; SPEED_ACCEL (2 days/week only) maximal intent; TECHNICAL_COORDINATION 3-4x2-3, moderate load, maximal bar speed/intent; CORE_SAGITTAL 2-3x8-10 |
| Peak/Taper | Sharp cut (~40-60% of Power Conversion volume) across every slot; SPEED_ACCEL (2 days/week only) present but very low volume, technique-clean only; TECHNICAL_COORDINATION 2-3x2-3, light load, technique-clean only |

INJURY_RESILIENCE dosing on this day follows `coaching-philosophy.md`'s phase-by-phase progression table for the athlete's specific injury-history area when one is flagged; otherwise it stays at a light standing-maintenance dose across all phases rather than following the ACCESSORY/CORE_SAGITTAL band above.

---

## Day 2 — Upper Strength 1

**Slot order (3+ days/week):** UPPER_POWER → UPPER_PUSH_PULL_SUPERSET → SECONDARY_PUSH_PULL → INJURY_RESILIENCE + CORE_ROTATIONAL (superset)

**Slot order (exactly 2 days/week):** AGILITY → UPPER_POWER → UPPER_PUSH_PULL_SUPERSET → SECONDARY_PUSH_PULL → INJURY_RESILIENCE + CORE_ROTATIONAL (superset)

Present at every training frequency (2-6 days/week) — the guaranteed home day for shoulder-history resilience work. INJURY_RESILIENCE is always present here too (see that slot's definition above for the no-injury default — shoulder-area work, superset with CORE_ROTATIONAL's rotational/oblique core work).

**AGILITY only appears on this day at exactly 2 days/week** (no Athlete Day in the split) — it's the athlete's only change-of-direction exposure at that frequency, so it opens the session (fresh-athlete, high-CNS-demand work, same freshness-first logic as everything else that opens a day), ahead of UPPER_POWER. It's a lower-body movement quality grafted onto an otherwise upper-body day purely to guarantee COD exposure at this frequency — don't let it influence exercise selection elsewhere in the session. At 3+ days/week, this slot is dropped from Upper Strength 1 day entirely — the athlete gets their dedicated change-of-direction work on Athlete Day instead.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | UPPER_PUSH_PULL_SUPERSET 3-4x8-12 @ RPE 6-7; UPPER_POWER technique-focus, light-moderate; SECONDARY_PUSH_PULL 3x10-15; INJURY_RESILIENCE/CORE_ROTATIONAL standing-maintenance dose; AGILITY (2 days/week only) single-leg lateral/medial or forward/backward hurdle hops with a controlled stick landing, technical and unhurried |
| Hypertrophy | UPPER_PUSH_PULL_SUPERSET 3-4x8-12 @ RPE 7-8; a second SECONDARY_PUSH_PULL added if the athlete tolerates the extra volume well; AGILITY (2 days/week only) continuing the stick-landing hop progression, volume building |
| Max Strength | UPPER_PUSH_PULL_SUPERSET wave-loaded 4-6→2-3 @ RPE 8-9.5; UPPER_POWER stays light/technical even as the superset gets heavy; contrast pairing for advanced/intermediate; AGILITY (2 days/week only) continuous multidirectional single-leg hopping for speed, plus resisted lateral bounds/resisted lateral deceleration work |
| Power Conversion | UPPER_PUSH_PULL_SUPERSET ~75-85%, volume down; UPPER_POWER maximal intent, low volume; AGILITY (2 days/week only) true COD sprinting/agility drills |
| Peak/Taper | Sharp cut across every slot; UPPER_POWER present but minimal; AGILITY (2 days/week only) light touch, technique-clean only |

**At 2 days/week with no league day**, append a CONDITIONING finisher after INJURY_RESILIENCE/CORE_ROTATIONAL — ultimate-relevant repeated-effort work, dosed per the Energy System phase bands below. **At 4 days/week with no league day**, a brief CONDITIONING touch may also be added here (in addition to, or as an alternative to, the fold-in on Athlete Day below) — a coach's-judgment call on where the athlete tolerates it better, not a mandatory second dose.

---

## Day 3 — Athlete Day (speed/acceleration + agility)

**Slot order:** NEURO_PRIMING → SPEED_ACCEL → AGILITY → PLYOMETRICS → REFLEXIVE_STRENGTH

The dedicated speed/acceleration session — appears at 3+ days/week. At exactly 2 days/week, where this day doesn't exist, SPEED_ACCEL and AGILITY relocate to Lower Strength day and Upper Strength 1 day respectively instead — see each day's section above. Band-resisted high-knee/A-skip work (in place) is the standard no-space substitute for SPEED_ACCEL at any phase, for athletes training in a confined area.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | SPEED_ACCEL: sub-maximal (~85-95% effort), technical-focus, sprint-mechanics drills; 4-6 reps of 10-20yd acceleration; AGILITY: single-leg lateral/medial or forward/backward hurdle hops with a controlled stick landing, technical and unhurried; PLYOMETRICS: low-intensity bilateral jump (e.g. squat jump) + an entry-level unilateral hop, superset; REFLEXIVE_STRENGTH: entry-level exercise in the chain (e.g. RS-001/RS-004), 2-3x3/side, light load, technique-priority |
| Hypertrophy | SPEED_ACCEL: volume builds, intent trending toward 95-100% by the phase's end, sprint mechanics transitioning toward true acceleration; AGILITY: continuing the stick-landing hop progression, volume building; PLYOMETRICS: moderate-intensity bilateral jump (bound, low-to-moderate depth jump) + unilateral hop superset; REFLEXIVE_STRENGTH: advances one step in its chain if the entry-level exercise is technically sound, 3x3-4/side |
| Max Strength | SPEED_ACCEL: true acceleration/sprinting, max-velocity work (95-100%+ effort), full recovery between reps, lower total volume; AGILITY: continuous multidirectional single-leg hopping for speed, plus resisted lateral bounds/resisted lateral deceleration work; PLYOMETRICS: higher-intensity bilateral jump (depth jump, bound for distance) + more advanced unilateral hop superset; REFLEXIVE_STRENGTH: mid-chain exercise, 3x3-4/side, load builds as technique holds |
| Power Conversion | SPEED_ACCEL: maximal intent, true acceleration/sprinting; AGILITY: true COD sprinting/agility drills (cutting, shuttle, reactive-cue work); PLYOMETRICS: maximal-intent complex bilateral + unilateral jump superset, contrast-paired, very low volume, highest quality; REFLEXIVE_STRENGTH: progresses to its full-expression exercise where the athlete's chain progress supports it, 2-3x3/side, maximal intent |
| Peak/Taper | SPEED_ACCEL: technique-clean sprint touches only; AGILITY: true COD work, light touch, technique-clean only; PLYOMETRICS: no new stimulus; REFLEXIVE_STRENGTH: light touch at whatever stage the athlete has reached, or omitted within the final ~5-7 days before a priority event |

**At 3-5 days/week with no league day**, append a CONDITIONING finisher after REFLEXIVE_STRENGTH.

---

## Day 4 — Lower Body Power (Olympic lift + RFESS + plyometrics)

**Slot order:** PLYOMETRICS → OLY_OR_EXPLOSIVE → UNILATERAL (Barbell RFESS or front squat) → HAMSTRING_FINISHER (early/middle phases) or REFLEXIVE_STRENGTH (later phases)

Appears at 4+ days/week. This is where the Rear Foot Elevated Split Squat lives as a genuine main strength-power lift (front squat is an equally valid filler for this slot, per the coach's "mostly front squat or RFESS" framing). This day's OLY_OR_EXPLOSIVE is the week's heaviest/highest-intent Olympic-lift exposure; Lower Strength day's TECHNICAL_COORDINATION slot is a separate, lighter, technique-focus exposure of the same lift family and stays in the week even when this day is also present — don't merge or drop one in favor of the other. PLYOMETRICS opens the day as low-amplitude, high-intent work (pogo-hop variations are the default) — a different placement and intent than Athlete Day's PLYOMETRICS, which closes that day at peak intensity.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | PLYOMETRICS: low-amplitude pogo-hop work, 2-3x10-15; OLY 3-4x5-6, technique-priority, light-moderate load; UNILATERAL (RFESS/front squat) 3x8-10, moderate load; HAMSTRING_FINISHER: knee-flexion work, 2-3x8-10 |
| Hypertrophy | PLYOMETRICS: pogo-hop work builds slightly; OLY 4x4-6, building load; UNILATERAL 3-4x6-8; contrast pairing (UNILATERAL + PLYOMETRICS) introduced late, advanced athletes only; HAMSTRING_FINISHER: 2-3x8-10 |
| Max Strength | PLYOMETRICS: pogo-hop work, higher intent; OLY 3-5x2-4, high intent; UNILATERAL 3-5x3-5 @ 80-85% — this becomes the primary unilateral strength expression of the macrocycle; contrast pairing (UNILATERAL + a jump variation) for advanced/intermediate; HAMSTRING_FINISHER: 2-3x6-8, load building |
| Power Conversion | PLYOMETRICS: maximal-intent pogo-hop/contrast opener; OLY 3-4x3-4, maximal intent; UNILATERAL 3x3-5, maximal intent, contrast prioritized; finisher transitions to REFLEXIVE_STRENGTH: 2-3x3/side |
| Peak/Taper | PLYOMETRICS: light touch only; OLY light-moderate, technique-clean only; UNILATERAL light touch (2x3 @ ~70%) or omitted within the final ~5-7 days before a priority event; finisher stays REFLEXIVE_STRENGTH, light touch |

**For an athlete with ACL/knee history**, UNILATERAL load and volume on this day follow `coaching-philosophy.md`'s ACL-history progression table instead of the standard band above, until the athlete has been cleared through that progression.

---

## Day 5 — Upper Strength 2

**Slot order:** UPPER_POWER → UPPER_PUSH_PULL_SUPERSET → SECONDARY_PUSH_PULL → SECONDARY_PUSH_PULL (or INJURY_RESILIENCE, second exposure for shoulder history)

Appears at 5+ days/week. High-volume, arm-focused, per the source framework — this is a day type distinct from the Hypertrophy *phase* (which affects every day's dosing); Upper Strength 2 exists in every phase it's scheduled for, its own dosing just changes phase to phase like everything else. Opens with UPPER_POWER (the same upper-body technical-coordination slot as Upper Strength 1 day) — this day is not purely accessory volume, it still gets a freshness-first coordination touch before the push/pull work.

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | UPPER_POWER: technique-focus, light-moderate; UPPER_PUSH_PULL_SUPERSET and SECONDARY_PUSH_PULL slots: 3-4x10-15, moderate load |
| Hypertrophy | Peak volume of the macrocycle here — 3-4x10-15, some isolation sets to 15-20; UPPER_POWER load builds as technique holds |
| Max Strength | Tapering from peak — 3x8-10, maintenance dosing; UPPER_POWER stays light/technical |
| Power Conversion | Often the first day cut if the schedule compresses around games, per its lowest-priority ranking |
| Peak/Taper | Usually dropped entirely — exactly the volume you shed before peaking |

**At 5 days/week with no league day and no Day 6**, a brief CONDITIONING touch may be added after the final SECONDARY_PUSH_PULL/INJURY_RESILIENCE slot.

---

## Day 6 — Energy Systems

**Slot order:** CONDITIONING → INJURY_RESILIENCE (if the athlete has an active injury)

Appears only at 6 days/week, and only when the athlete has no league day on their schedule (see the league-day rule above — a league day satisfies this day's role entirely, so it isn't separately programmed).

| Phase | Dosing |
|---|---|
| GPP/Reacclimation | Aerobic-base emphasis, tempo runs, longer duration/lower intensity |
| Hypertrophy | Aerobic-to-mixed transition, tempo intervals |
| Max Strength | Repeated-sprint ability / anaerobic capacity emphasis — shorter, higher-intensity intervals mimicking point duration |
| Power Conversion | Game-specific conditioning — repeated high-intensity efforts matching point/tournament demands |
| Peak/Taper | Minimal — technique/movement-quality reminders only, no fatiguing conditioning within ~5-7 days of a priority event |

---

## Notes for implementation

- This document is the slot-level layer between `coaching-philosophy.md` (why) and the Phase Builder's actual exercise selection (what) — read alongside both, not in place of either. Injury history, equipment, and the athlete's real logged performance still govern which specific exercise fills each slot and at what load.
- A reduced-recovery week (e.g., a game week that only leaves room for fewer "fresh" sessions) doesn't silently drop a day — combine that week's lower-priority content into practice-adjacent days at reduced intensity instead, per `coaching-philosophy.md` Section 5.
- Where OLY_OR_EXPLOSIVE has no real substitute available (no equipment access at all, or the athlete is still within the Olympic-lift gating table's 6-month "New" window), it becomes a second PLYOMETRICS exposure on Lower Body Power rather than an empty slot — the freshness-first, explosive-first sequencing principle still applies even without a barbell-family movement available.
- **Speed/acceleration and change-of-direction coverage at 2 days/week.** With no Athlete Day at this frequency, SPEED_ACCEL moves to Lower Strength day (as its opener) and AGILITY moves to Upper Strength 1 day (as its opener) — this is how `coaching-philosophy.md` Section 5's "speed and jump training: present year-round" guarantee is satisfied at 2 days/week, not by folding both qualities into Athlete Day the way 3+ days/week does. At 3+ days/week, both slots move back to Athlete Day and are dropped from Lower Strength/Upper Strength 1 day entirely — never present on more than one day in the same week.
- TECHNICAL_COORDINATION (Lower Strength day) and OLY_OR_EXPLOSIVE (Lower Body Power day) are gated by athlete lifting experience, not training age per se — see the Olympic-lift gating table above. UPPER_POWER (Upper Strength 1 day and Upper Strength 2 day) is never dropped for a novice athlete either — it's filled with the simpler substitute named in its slot definition (kneeling plyo push-up, band-assisted plyo push-up, clap push-up, kneeling DB push press) instead of a barbell push-press movement. As the athlete's technical competency grows (via coaching, via Lower Body Power's OLY_OR_EXPLOSIVE work if that day is in their split, or dedicated instruction the coach provides outside the app), advance them toward the full movement in these slots rather than leaving them on the novice substitute indefinitely.
- **Mobility/recovery work is intentionally absent from every day type right now** (the MOBILITY_RECOVERY slot above is paused, not deleted by accident) — this is a temporary state while the coach reworks that part of the programming, not a gap to fill from general knowledge. Don't add a mobility, stretching, or "active recovery" exercise anywhere in a generated program, even to round out a day that otherwise ends on a working set, until this document says otherwise.
