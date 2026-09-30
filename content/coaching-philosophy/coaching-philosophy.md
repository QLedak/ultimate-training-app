# Coaching Philosophy — [App Name TBD]
### A living document that defines how programs get built, so AI-generated plans sound like a coach wrote them, not a machine.

*Draft v1 — refine this after every batch of programs you review.*

---

## 1. Mission

Build training programs for ultimate frisbee players that a real strength and conditioning coach would actually hand to an athlete — individualized, sport-specific, and grounded in how the demands of ultimate (cutting, layout, throwing, repeated sprint effort) actually stress the body. Never generic. Never "one plan for everyone with a different name at the top."

---

## 2. Core Influences & What I Take From Each

**Garage Strength (Dane Miller)**
- Structure training blocks (across weeks/phases — a periodization emphasis, not an order exercises appear within one session; see Section 5's "Exercise order within a session" for that) around **technical coordination → absolute strength → reflexive/explosive strength**, in that order within a training age-appropriate progression. Athletes need to move well before they move heavy, and move heavy before they move fast under load.
- Complex/contrast pairing (a heavy strength movement paired with an explosive movement targeting the same pattern) to convert raw strength into transferable power — highly relevant to ultimate's need for explosive cuts and jumps.
- Respect training age: a first-year player and a five-year veteran should never get the same base template, even if their goals look similar on paper.
- Periodize on three variables, not two: **volume, intensity, and variation** (how many different exercises/variants are in rotation at once). Early blocks run high volume with low variation (a small set of movements, repeated, to build competency); variation climbs through the middle of a macrocycle alongside intensity (more lift variants, more contrast pairings) as a way of keeping load manageable while still pushing the athlete; only the final taper block collapses variation back down to a handful of the most direct, highest-carryover movements.
- Don't collapse training volume as fast as intensity climbs. A block-to-block jump from moderate to heavy intensity doesn't require the same drop in total volume that classic strength-only periodization assumes — volume should stay meaningfully present through most of the macrocycle and only taper hard in the final peaking block, not ease off gradually every step of the way. (This is a principle to weigh against the existing phase dosing bands in `day-structure-templates.md`, not a mandate to rewrite them outright — when in doubt, hold volume a little longer before cutting it.)
- A loaded, scaffolded "reflexive strength" quality — a low-rep, usually unilateral chain of movements (DB/KB-loaded) that trains a specific sport movement pattern with increasing complexity across a macrocycle — is a distinct training quality from both max-strength lifting and unloaded plyometrics/reactive-strength work. See the `Reflexive Strength - Loaded Movement Pattern` category in the exercise library for this app's own version, built around ultimate's cutting/separation and marking/close-out patterns.

**THP Strength (Isaiah Rivera & John Evans)**
- Individualization starts at intake — a thorough questionnaire (goals, injury history, training history, equipment) drives the plan, not a generic template with the name swapped.
- Direct, ongoing coach-athlete communication and plan adjustment based on how the athlete is actually responding — the plan is a starting point, not a fixed document.
- Jump/explosiveness-specific programming as a distinct, deliberately trained quality — not an afterthought tacked onto a strength block. Relevant to ultimate's layout, block, and vertical jump demands.

**NSCA / CSCS Guidelines**
- Start every program with a **needs analysis**: the specific movement demands, energy systems, and common injury patterns of ultimate frisbee (repeated sprint/cut efforts, non-contact ACL and ankle injury risk, shoulder demands from throwing, hamstring strain risk from sprinting and cutting).
- Progress athletes from **general physical preparedness (GPP) to sport-specific preparedness (SPP)** across a training year — don't start highly specific work with an undertrained athlete.
- Build in **periodization** (phase potentiation: each block sets up the next) and **planned deloads**, not just continuous loading.
- Prioritize **injury risk reduction** as a programming input, not an afterthought — especially ACL/ankle prehab for cutting sports and shoulder care for throwers.

---

## 3. Sport Demands of Ultimate Frisbee (Needs Analysis)

*Draft — correct and expand this with what you actually see on the field. This is the foundation everything else in the document should trace back to.*

**Movement demands**
- Explosive multidirectional cutting and change of direction — accelerating, decelerating, and re-accelerating in a new direction, often repeatedly within a single point.
- Repeated sprint efforts with variable, often short recovery between sprints (rest depends on the point's length and stoppages, not a fixed interval).
- Jumping and landing under contest — going up for a catch or block, often landing off-balance or absorbing contact from another player.
- Layout (diving) mechanics — full-body extension followed by controlled ground contact, placing unique demand on shoulder, hip, and core control.
- Overhead and sidearm throwing mechanics (backhand/forehand) — rotational, wrist- and forearm-dominant power production, performed at high volume across a game.
- Rotational core control and power specifically for throwing — the trunk is the link between the lower-body base and the arm/disc, so rotational strength and control (not just arm strength) drives throwing power and consistency.
- Large-range-of-motion hip mobility — deep lunge and lateral lunge positions are required for both throwing mechanics and marking (defending the thrower), so hip mobility at end ranges is a distinct demand, not just general flexibility.
- Full-speed, upright sprinting mechanics — deep cuts require true top-end sprint mechanics, distinct from the shorter, more deceleration-heavy cutting seen elsewhere in the game.
- Backpedaling and lateral shuffling, particularly for defensive positioning.

**Energy system demands**
- Predominantly intermittent, repeated-sprint anaerobic work layered on top of a substantial aerobic base — points are short, high-intensity bursts, but games/tournaments are long with variable rest, so aerobic capacity determines how well those bursts repeat late in a game or tournament day.
- Points typically last 30-90 seconds, meaning the dominant work bout is short and high-intensity, with recovery between points that varies with stoppages and how quickly the next point starts.
- Tournaments typically involve 5-7 games of roughly 90 minutes each across a single weekend — this volume of repeated high-intensity effort with limited recovery between games is a defining demand of the sport and a major driver of why aerobic capacity and recovery ability matter as much as raw power.

**Common injury risk patterns**
- Non-contact ACL and other knee injuries, tied to cutting and deceleration mechanics.
- Ankle sprains, from cutting, landing, and uneven field surfaces.
- Hamstring strains, from repeated high-speed sprinting and deceleration.
- Achilles tendonitis, from the repeated sprint, cut, and jump loading placed on the lower leg across a game and tournament weekend.
- Groin strains, tied to the lateral and rotational demands of cutting, marking, and change of direction.
- Shoulder issues, from throwing volume and layout landings.
- Lower back demands from repeated rotational throwing and diving.

---

## 4. How a Program Gets Built (Structure)

1. **Needs analysis** — sport demands (Section 3) cross-referenced with the individual athlete's profile (age, experience, injury history, equipment, schedule).
2. **Phase structure** — off-season, pre-season, in-season, each with a distinct emphasis. The app builds this on a standard 4-week-block backward-fill: working backward from a peak date (season_start, or a flagged priority tournament as an in-season second peak), the cycle is Hypertrophy → Max Strength → Power Conversion → Peak Taper, repeating the middle two blocks as many times as the available time allows. GPP/Reacclimation only ever opens a fresh off-season build, directly after a season ends — never mid-cycle, never repeated.
   - Off-season: GPP (opening block only) → Hypertrophy → Max Strength → Power Conversion, cycling as needed → Peak Taper right before season_start
   - Pre-season: the Power Conversion / Peak Taper end of that same off-season sequence — higher-intensity power/speed work, reduced volume as season approaches
   - In-season: the same cycle (Hypertrophy/Max Strength/Power Conversion) continues, but dosed at maintenance strength/volume with injury resilience and managed fatigue around games/practices — no GPP, and no off-season-level loading. A flagged priority tournament gets its own backward-planned sequence ending in Peak Taper, as a second peak within the season; otherwise in-season is one continuous maintenance stretch through season_end.
3. **Weekly structure** — which qualities this phase emphasizes (technical coordination, absolute strength, reflexive/explosive work), scaled to the athlete's phase and training age. This is a phase-level emphasis, not the order exercises appear within one session — see Section 5, "Exercise order within a session," for that.
4. **Exercise selection** — pulled from an approved library, not invented per plan, so every exercise has a defined purpose, cue, regression, and progression.
5. **Deloads** — planned, not reactive — every 4th week as a default, adjusted for game schedule. When a deload lines up with a phase transition, prefer placing it at the START of the next phase rather than the end of the one finishing — a deload is a better on-ramp into a heavier block than an ending note on a lighter one, and this matters most heading into Max Strength, which should open with a lighter week rather than jumping straight to the phase's top-end loading. Secondary deload windows (optional, used when the game schedule or athlete fatigue calls for them) fit well at the end of GPP/Reacclimation or midway through Hypertrophy — both are natural volume breaks before the next step up in intensity.

---

## 5. Individualization Rules (Decision Logic)

**Training split, built around the athlete's actual schedule**
- The athlete's stated training days/week is a hard constraint, not just a starting input for Phase 1's template. Every phase in the season — and every rebuild — sticks to exactly that number of training sessions unless the athlete has explicitly told the app they want to change it. Don't silently add a day to fit in extra accessory or resilience work, and don't silently drop a day during a deload or a rebuild; adjust volume and intensity within the athlete's chosen frequency instead of the number of sessions. "Training days" here means dedicated strength/speed/conditioning sessions the athlete builds their week around — games are a fixed schedule commitment, not part of that count, and don't get added to or subtracted from it.
- Start from the athlete's fixed commitments (games, league nights, team practices) and their stated training days/week, then build the split backward from game day rather than dropping a generic split on top of their calendar.
- **League day rule:** if the athlete has a league/game day on their schedule, it satisfies the Energy System day (see `day-structure-templates.md`'s day-type priority list) — don't also program a dedicated Energy System day or fold a conditioning finisher onto another day, since the game itself is the repeated-sprint/conditioning stimulus. A league day is never counted as one of the athlete's chosen training days, in either direction — it doesn't reduce their training-day count, and it doesn't let a 4-day athlete skip straight to Impulse-day content either; the athlete still gets exactly the training days they chose, built from the day-type priority list, with ESD handled by the game instead of a training session. With no league day on the schedule (true off-season, or a break between seasons), fall back to the standard fold-in/dedicated-day behavior in `day-structure-templates.md`.
- Rank each day by proximity to a game: the day before and day of a game default to no heavy lifting (light movement prep or rest only); the day after a game is a lower-intensity or technical-focus day, not a max-effort day.
- Speed work requires a fresh CNS: never schedule a heavy leg day immediately before a dedicated speed session — sequence heavy lower-body strength work after speed work in the same day, or on a separate day entirely, so speed quality isn't compromised by residual fatigue.
- Sequence sessions by CNS demand where weekly frequency allows: separate high-CNS-demand work (max strength, speed, plyometrics) from low-CNS-demand work (hypertrophy/accessory, technical/aerobic) onto different days rather than stacking multiple high-demand qualities on the same day.
- Choose split type by training capacity, not preference: full-body sessions when weekly training frequency is low (e.g., 2 days/week, so each session needs to hit everything); upper/lower splits when volume per session is high enough to justify dedicating a full session to half the body; high/low-CNS-demand splits layered in once frequency is high enough to support the extra differentiation (e.g., 4+ days/week).
- Tiebreaker: once training frequency reaches 4 days/week, default to an upper/lower split rather than full body, even if full body would otherwise still be arguable at that frequency.
- If the athlete wants more training days than the schedule leaves "fresh," combine lower-priority work (accessory/technical volume) into practice-adjacent days at reduced intensity rather than force a 4-day heavy split into a 2-day-recovery week.
- Off-season with no games: split by movement pattern/quality (e.g., strength-focus days, power-focus days) without the game-proximity constraint.

**Movement-pattern balance within a session**
- No upper-body training day is exclusively pushing or exclusively pulling — every upper-body day includes both pushing and pulling movements. A dedicated "upper push day" or "upper pull day" is not this coach's convention, regardless of split type.
- Lower-body strength days balance movement-pattern classes the same way — don't devote an entire day to one dominant pattern (e.g., all squat-dominant or all hinge-dominant); mix squat, hinge, and single-leg/unilateral work across the day's main lifts.
- This is a session-composition rule, not a volume rule — the day can still emphasize one quality (e.g., a squat-emphasis lower day), but the complementary pattern still gets real working sets, not just a token warm-up movement.

**Exercise order within a session**
- Order exercises within a session by CNS demand, highest first. Olympic-lift variants, jumps/plyometrics, and other power/speed drills go EARLY in the session — first or near-first in the circuit numbering — while the athlete is freshest. Never bury power/speed work after strength or accessory volume; residual fatigue blunts both the training effect (you can't develop maximal power output while pre-fatigued) and the safety margin (power/speed movements are the least forgiving of degraded technique).
- After power/speed work: absolute strength (main lifts) next, then hypertrophy/accessory work, then low-CNS-demand core/isolation/mobility work last — same freshness-first logic, descending the CNS-demand ladder.
- Exception — conditioning intent: when a power-type movement (jumps, throws, sprints, Olympic-lift variants) is being used deliberately for conditioning/energy-system development rather than for its power-output quality — a metabolic finisher, a repeated-effort circuit, an intervals block — place it wherever that conditioning stimulus calls for, including at the end of the session. The question that decides placement is intent: is this exercise here to develop maximal power output (early, fresh), or to develop the athlete's ability to repeat effort under fatigue (wherever that fatigue state naturally falls, often late)? The example programs' "Intervals" and repeated-sprint blocks, placed last in their sessions, are this exception in practice, not a violation of the rule.
- This is a within-session sequencing rule, distinct from the block-level "technical coordination → absolute strength → reflexive/explosive" periodization in Sections 2 and 4 above, which describes which quality an entire TRAINING BLOCK (weeks/phases) emphasizes — not the order exercises appear on any single day.

**Speed and power in every phase — never a strength-only block**
- Every phase, in every split type, includes dedicated speed/power work — not just in a designated "power" phase. An athlete who goes several weeks of pure strength work with no speed/power exposure starts losing explosiveness, and that's true regardless of which macrocycle phase (`gpp_reacclimation` through `peak_taper`) is currently running. What changes phase to phase is the DOSE (Section 5's existing "Speed and jump training: present year-round, dosed by season" rule) and how much of the session it occupies — never whether it's present at all.

**Hypertrophy work in a running sport — dense, not bulky**
- Hypertrophy Day and any hypertrophy-emphasis dosing exist to support strength and power output, not to add bodyweight for its own sake — ultimate is a repeated-sprint, running-economy-dependent sport, and excess mass an athlete has to carry up and down the field works against the same speed and conditioning qualities the rest of the program builds. Favor rep ranges and exercise selection that build usable tissue and joint resilience (tendon/connective-tissue capacity, shoulder and hip stability for throwing and cutting) over pure bodybuilding-style isolation volume, and don't treat "more hypertrophy volume" as automatically better for an athlete who also needs to be fast deep into a tournament weekend.

**Tournament-weekend conditioning — repeated games, not just repeated points**
- Section 3's needs analysis already flags the tournament format (typically 5-7 games across a single weekend) as a defining demand. Energy System day and CONDITIONING-slot programming should reflect that the athlete needs to repeat high-level performance across multiple games in a single day, not just repeat points within one game — so as a tournament or a priority weekend approaches, conditioning work should include some repeated-effort structure at a longer time scale (e.g., simulated multi-game volume with a real recovery break built in) in addition to the standard point-length interval work, rather than assuming point-to-point conditioning alone prepares an athlete for the cumulative fatigue of a full tournament day.

**Day types, slot order, and which days appear at which training frequency**
- Superseded here by `day-structure-templates.md`, the single source of truth for session structure: six fixed day types (Lower Body Strength, Upper Body Strength, Athlete Day, Impulse Day, Hypertrophy Day, Energy System Day), used by every athlete regardless of training days/week, included from a fixed priority list as frequency allows. Read that document for the slot-by-slot order within each day type, the day-count inclusion rules, and how Energy System content folds into another day below 6 days/week.
- The single-leg squat lift (Rear Foot Elevated Split Squat) lives on Impulse Day as a heavy strength-power expression, not on Lower Body day — Lower Body day's two heavy lifts are the bilateral squat and hinge patterns.
- The movement-pattern-balance rule above (squat + hinge + unilateral work all represented across the week) and the CNS-demand sequencing rule (power/speed first, strength next, accessory/mobility last) both still govern day-structure-templates.md's slot order — that document operationalizes these rules into a fixed structure, it doesn't replace them.

**Injury-resilience home days — mandatory, not optional**
Every injury-history area gets a fixed "home day" where its resilience slot is a mandatory, non-negotiable part of the session — never left out because a day feels full, never treated as an optional accessory. The home day is chosen so it exists at every supported training frequency (2-6 days/week), so this guarantee holds regardless of how many days the athlete picked. A second, lighter exposure is added on any other day in the split that also loads the same tissue, as a caution/monitoring note rather than a second full resilience block.

| Injury history area | Home day (mandatory slot) | Second exposure (monitor/dose down) |
|---|---|---|
| Achilles / calf tendon | Lower Body day | Impulse, Athlete, Energy System days' plyometric volume |
| Groin / adductor | Lower Body day | Athlete Day's cutting/agility volume |
| ACL / knee history | Lower Body day | Impulse Day's RFESS — load/volume for this athlete follows the ACL progression below, not the standard Impulse-day band, until cleared |
| Ankle | Lower Body day | Impulse and Athlete Days' plyometric/cutting volume |
| Hamstring | Lower Body day (distinct slot from the day's HINGE_PATTERN main lift) | Athlete Day's sprint volume |
| Shoulder | Upper Body day | Hypertrophy Day (second upper-dominant exposure, when present) |
| Low back | Lower Body day (INJURY_RESILIENCE slot — anti-extension/anti-rotation and rotational-power work, per the progression below; `day-structure-templates.md` has no separate CORE_ROTATIONAL slot on Lower Body day, so this runs in the same INJURY_RESILIENCE slot as every other Lower Body day injury area) | Impulse Day's CORE_ROTATIONAL slot, when present |

Progress each one like any other trained quality (per the existing rule below) — here's the phase-by-phase progression for every area, extending the Achilles/groin progressions already established:

| Area | GPP/Reacclimation | Hypertrophy | Max Strength | Power Conversion | Peak/Taper |
|---|---|---|---|---|---|
| Achilles/calf | Bodyweight HSR calf raise | Loaded HSR calf raise | Single-leg loaded, tempo-emphasized | Reintroduce reactive/plyometric calf work | Maintenance dose only |
| Groin/adductor | Knee-supported Copenhagen plank | Full Copenhagen plank | Added hold time or external load | Added hold/load, higher intensity | Maintenance touch |
| ACL/knee | Isometric quad holds (wall sit, isometric leg extension) + terminal knee extension | Controlled-tempo single-leg work, light load | Added load/hold, single-leg strength progressing toward the main RFESS trajectory | Reintroduce reactive/plyometric single-leg landing work, controlled height | Maintenance dose only |
| Ankle | Single-leg balance/proprioception | Added perturbation (unstable surface, eyes-closed variations) | Light reactive ankle hops | Full reactive ankle hops / cutting-specific proprioception | Maintenance dose only |
| Hamstring | Eccentric-only or assisted Nordic curl | Full Nordic curl | Nordic curl + added load/tempo | Sprint-specific eccentric (deceleration-focused) work | Maintenance dose only |
| Shoulder | Light band external rotation | Loaded external rotation + scapular stability | Progressed loading, higher-intensity rotator cuff work | Throwing-volume-specific accessory | Maintenance dose only |
| Low back | Anti-extension/anti-rotation basics (dead bug, plank variations) | Added load (loaded carry, weighted plank) | Added load, more dynamic anti-rotation | Throw-specific rotational power (controlled medicine-ball work) | Maintenance dose only |

Same tracking rule as everywhere else in this section: log it, note in the Phase Performance Summary how the athlete handled the current dose, and use hit/exceed/miss to decide whether the next phase advances the variation/load or holds. If a historical area becomes reactive/painful again, the isometric-first progression below supersedes this table for that pattern and resets to its own start point — it doesn't resume wherever this table's progression had reached.

**Tendon pain → isometric-first progression**
- If the athlete reports reactive tendon pain (e.g., patellar, Achilles) tied to a specific movement, shift that pattern to isometric loading (moderate-intensity holds, 30-45s) before reintroducing dynamic loading — isometrics tend to be better tolerated and have an analgesic effect during reactive tendinopathy. Run this on that tissue's home day from the injury-resilience table above (Lower Body day for a patellar/Achilles flare, Upper Body day for a shoulder tendon flare) — it replaces that day's standing resilience slot for the affected pattern, not an extra addition on top of it.
- Progress in order: isometric holds → slow, controlled heavy resistance (full range, controlled tempo) → gradual reintroduction of plyometrics/reflexive work, only once the athlete tolerates the prior stage pain-free.
- Do not reintroduce plyometrics or reflexive/explosive work for the affected pattern until the slow-resistance stage is pain-free — jumping stages is the most common way this type of injury gets aggravated.
- Late-stage return: once an athlete has cleared the slow-resistance stage pain-free, full plyometrics, heavy squatting, and full-speed work are appropriate again — this progression is about sequencing early on, not a permanent restriction. See Example Program 4 (college track athlete, late-stage patellar tendonitis return) for what a program looks like at this end of the progression; it is not a template for an athlete with active/reactive pain.
- Always include a note that persistent or worsening tendon pain should be evaluated by a medical professional rather than programmed around indefinitely.
- **How this ends:** the athlete self-reports resolution via an injury check-in (app-level: `current_active_injuries` in Current Athlete State). When an area is marked resolved, it moves OUT of current/active status and INTO the standing resilience-work table above, entering at the stage matching the athlete's phase at the time of resolution — pick up that area's progression from the corresponding column, not from its earliest stage. Until the athlete reports it resolved, keep running the isometric-first progression for that pattern every phase — don't infer resolution from an absence of pain-related flags in the Phase Performance Summary; only an explicit athlete check-in ends this progression.
- **How this starts mid-season:** the same self-report mechanism works in reverse — an athlete can log a brand-new injury (or flag a historical area as reactive again) at any point, not just at intake. A newly-reported area starts this isometric-first progression from the very beginning regardless of what phase the athlete is in, and if it was previously a standing resilience-work area, that standing dosing is superseded and removed for as long as the area is active — don't run both protocols for the same location at once.

**Injury history → standing resilience work, every phase**
- A past injury — even one the athlete describes as fully resolved and currently pain-free — earns standing prehab/resilience work for that region in every phase, not a one-time mention at intake that quietly disappears once the reactive stage is over. This is separate from the isometric-first progression above, which is for CURRENT/active pain; this rule is for injury HISTORY with no current symptoms.
- History of Achilles tendonitis: include calf/Achilles-specific loading (e.g., eccentric or heavy-slow-resistance calf raises, ankle isometrics/pogo-style reactive work dosed appropriately for phase) as standing accessory work every phase — not just folded into general lower-leg or speed/plyo work and left to chance.
- History of groin strain: include adductor-specific strengthening (e.g., Copenhagen plank, lateral lunge, adductor-focused work) as standing accessory work every phase — the lateral/rotational demands of cutting and marking that caused the strain don't go away just because the athlete is currently asymptomatic.
- Dose this the same way speed/jump work is dosed by season (Section 5, below): it never fully drops out of the plan, but its volume and intensity flex with phase emphasis and competing priorities.
- **Progress it like any other trained quality — the goal is measurably more resilient tissue by the end of the season, not the same exercise repeated at the same dose every phase.** Advance standing resilience work along its own regression/progression chain as phases go on: e.g., Achilles history might move bodyweight HSR calf raise (Phase 0-1) → loaded HSR calf raise (Phase 2) → single-leg loaded, tempo-emphasized (Phase 3) → reintroducing reactive/plyometric calf work (Phase 4, once tolerance is demonstrated); groin history might move knee-supported Copenhagen plank → full Copenhagen plank → added hold time or external load. Don't let "standing prehab" become a synonym for "frozen at the easiest variation all year."
- Track this progression the same way main lifts are tracked: log it, note in the Phase Performance Summary how the athlete handled the current dose, and use that to decide whether the next phase advances the variation/load or holds — the same hit/exceed/miss logic used for main lifts applies here.
- If a historical injury area later becomes reactive/painful again, that supersedes standing resilience dosing and triggers the full isometric-first progression above for that pattern — progression resets to the start of that protocol, not wherever the resilience work had advanced to.

**Equipment-driven exercise selection**
- Athlete selects their available equipment (full gym, dumbbells only, bodyweight only, bands, etc.) during onboarding.
- The exercise library is filtered to that equipment before a plan is generated — the AI should never write an exercise the athlete can't actually perform, and every substitution should preserve the original exercise's primary purpose and movement pattern, not just swap in "something else in that muscle group."

**Training age → phase length, rep ranges, and movement complexity**
- Novice/first-year athletes: longer technical coordination phase (roughly 4-6 weeks vs. 1-2 for advanced lifters) before introducing complex/contrast pairing, higher rep ranges on main lifts (10-15) to build movement competency, and simpler exercise variations (e.g., goblet squat before barbell back squat, trap bar deadlift before conventional).
- Advanced/experienced lifters: shorter technical coordination phase, lower rep ranges on main strength lifts (3-6), and earlier introduction of complex/contrast pairing since movement competency is already established.
- Load progression should be more conservative week-to-week for novices regardless of how strong they feel — the limiting factor early on is tissue and motor-pattern adaptation, not motivation.

**Speed and jump training: present year-round, dosed by season**
- Never fully remove speed/jump-quality work from the plan, regardless of phase — only its frequency and intensity change.
- Off-season: higher frequency and volume, 2-3 dedicated sessions/week, used to build the underlying quality.
- Pre-season: maintained frequency, intensity trending toward game-speed demands.
- In-season: reduced to a lower "maintenance dose" (roughly 1x/week or folded into a practice warm-up), just enough to preserve the quality without adding fatigue on top of games.

---

## 6. Voice & Cueing Style

*Real phrasing, in the coach's own words — this is what an AI-generated plan should sound like when it's working.*

**Overall tone:** Professional, but fun — respects the individual needs of each athlete and understands the specific demands of training for the sport.

**Squat**
- Brace the core by breathing into the belly.
- Drive the knees out as you lower down.
- Exhale on the way back up.

**Hip hinge / deadlift**
- Brace the core.
- Drive the hips back.
- Stretch the glutes and hamstrings.
- Stay balanced on the feet.

**Explosive intent** (cueing speed/power on a fast lift)
- Push the ground away.
- Attack the ground.
- Pick the knees up.

**Correction — knees caving in on a squat**
- Push out from your hips all the way down to your feet.
- Engage the glutes.

**Explaining "why" — max strength and speed**
- "Improving your ability to produce force and push into the ground through a heavy squat will improve your speed. Athletes with up to a 2.2x bodyweight squat have been shown through research to be faster."

**Jump landing / deceleration** *(drafted — not your transcribed phrasing yet; replace with your own words)*
- Land quiet — absorb through the whole foot, not just the toes.
- Bend the knees and hips together, like sitting into a chair.
- Stick it before you move again.

**Change of direction / cutting** *(drafted)*
- Get low before the cut, not during it.
- Push off the outside foot to go the other way.
- Plant, don't skid.

**Communicating effort/intensity for a set** *(drafted)*
- "Leave 2-3 in the tank here — controlled and crisp, not grinding."
- "By the last rep it should feel hard, but if your bar speed falls apart, that's your stopping point."
- Ask "how many more could you have gotten?" rather than "how did that feel?" — gets a usable RIR number instead of a vague answer.

**A real encouragement phrase, mid-set or mid-session** *(drafted)*
- "There it is — that's the one."
- "Stay with it, one more."

**Backing off in-season without it landing as failure or punishment** *(drafted)*
- "Your job this week is to show up fresh for Saturday, not the gym."
- "We're not chasing a number today — we're protecting what you already built."
- "Lighter today keeps you available for the game — that's the win."

*Treat everything marked "drafted" above the same way the exercise library's cues were treated: a first pass to react to, not a transcription of how you actually talk — rewrite anything that doesn't sound exactly like you.*

---

## 7. Approved Exercise Library

*Maintained separately as a spreadsheet (`exercise-library.xlsx`), not in this document — the library will grow far past what's readable as a markdown table, and it also needs to be queryable (by equipment, movement pattern, training age, season) once it's wired into the app's plan-generation logic. This is the constrained set the AI selects from (per Section 5's equipment rule); it should never invent an exercise outside this list.*

**Spreadsheet structure:** Exercise ID, Exercise Name, Movement Pattern, Primary Purpose, Equipment Needed, Cue (Coach's Voice), Regression, Progression, Training Age, Season Tag, Injury Considerations, Notes. Movement patterns, training age, and season use dropdown validation to keep tagging consistent as the library grows. Full instructions are on the sheet's "How to Use" tab.

**Current state:** The library has grown to 266 exercises across every movement pattern, with a "Priority Tier" column flagging a curated Core 50 (the working set most programs should draw from first) against the wider Extended Library. Every row now has a real, written coach cue in the voice established in Section 6 — treat these as a strong first draft, not final; they should be reviewed and rewritten wherever they don't sound exactly right. The `Reflexive Strength - Loaded Movement Pattern` category (6 exercises) is the newest addition — a loaded, scaffolded sport-movement-pattern quality distinct from the `Plyometric / Jump (Reactive Strength)` category (renamed from "Reflexive Strength" for accuracy — those are unloaded depth-jump/stretch-shortening-cycle work).

---

## 7.5 Training Targets Reference

*Maintained separately (`training-targets-reference.md`) — benchmark 1RM/bodyweight ratios, strength-endurance, power, speed, conditioning, and injury-resilience standards by training age. This gives the AI a concrete sense of where an athlete's current numbers sit and what's realistic next, and feeds phase-emphasis judgment alongside everything else in Section 5 — but it never overrides a real constraint (equipment, injury, schedule, or the training-age progression rules above). A target is a compass, not a prescription.*

---

## 8. What This Is Not

- Not a plan that looks the same for a handler and a cutter.
- Not volume for volume's sake — every exercise earns its place via the needs analysis.
- Not indifferent to the game schedule — programming respects when athletes actually play.
- Not silent on injury history — it actively shapes exercise selection, not just a form field nobody reads.

---

## Next Steps

- [ ] Review the 5 drafted macro cues in Section 6 (jump landing, change of direction, effort/intensity, encouragement, backing off in-season) and rewrite any that don't sound like your actual voice — currently first-draft phrasing, not transcribed from you
- [x] Fill in the exercise library — 238 exercises across every movement pattern, all cued (`exercise-library.xlsx`)
- [x] Pull hand-written programs to use as few-shot examples — 4 collected so far (see `/programs/` in the project): an off-season progressive-overload block, a 4-week strength-testing/peaking block, a full in-season week with a built-in deload for a high school football player, and a late-stage tendon-injury return program
- [x] Draft the system prompt that combines this document, the exercise library, and the example programs, and test it against a sample athlete profile — two-tier Macrocycle Planner + Phase Builder architecture (`system-prompt-v3.md`), stress-tested against push/pull balance, injury-history resilience progression, a mid-phase injury rebuild, an athlete-requested days/week change, RIR-based load progression, and missed-load reduction
