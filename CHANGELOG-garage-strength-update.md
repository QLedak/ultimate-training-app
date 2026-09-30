# Garage Strength Program Design — What Changed in the Corpus

Context: I read the *Garage Strength Program Design* ebook you uploaded and cross-checked it
against the corpus. The good news is that a lot of what it advocates was already baked in —
`coaching-philosophy.md` already names Garage Strength as a core influence, and
`day-structure-templates.md` was already explicitly built from a Garage Strength-style 5-day
framework (technical coordination → absolute strength → hypertrophy/accessory ordering, sled
work, deceleration drills, extensive rotational/throwing and change-of-direction work were all
already there). So this update is targeted refinements + one genuinely new exercise category,
not a rebuild.

**None of the book's own proprietary names, phase names, or branded drill names were reused.**
Everything below is rewritten in this app's own terms, or is generic exercise-science vocabulary
the book itself didn't invent (rep ranges, day archetypes, the exercise-type taxonomy).

---

## 1. `content/exercise-library/exercise-library.json` (260 → 266 exercises)

**New: `Reflexive Strength - Loaded Movement Pattern` category (6 new exercises, `RS-001`–`RS-006`)**

The one real gap the book surfaced: a *loaded*, low-rep, usually unilateral, deliberately
scaffolded chain of movements that trains a specific sport movement pattern with rising
complexity across a macrocycle — distinct from both max-strength lifting and from unloaded
plyometrics. Our existing "reflexive strength" tag was actually mislabeling something else (see
below), so this was missing entirely.

I built two 3-exercise progressions themed around ultimate's own movement patterns (this is my
own adaptation, not the book's example, which was basketball-specific):

- **Separation-cut chain** (offense creating space from a mark): `RS-001` DB Loaded Lateral Bound
  (Entry) → `RS-002` DB Loaded Lateral Bound to Vertical Stick → `RS-003` Single-Leg RDL to
  Loaded Lateral Bound (Full Expression)
- **Mark/close-out chain** (defense closing distance and contesting): `RS-004` KB Loaded
  Deceleration Step (Entry) → `RS-005` KB Loaded Deceleration Step to Reactive Redirect →
  `RS-006` Loaded Single-Arm Deceleration to Overhead Reach

Each links to the next via the existing `regression`/`progression` fields, same as every other
exercise in the library, so the Phase Builder can advance an athlete along the chain the same
way it already advances anything else.

**Renamed: fixed a mislabeled existing category**

`PJ-002`, `PJ-026`, `PJ-027` (depth jumps and their regressions/progressions) were tagged
`Plyometric / Jump (Reflexive Strength)`. Those are actually **Reactive Strength** work
(unloaded, stretch-shortening-cycle, ground-contact-time-focused) — a different quality from the
new loaded category above, which is the book's real "reflexive strength" concept. Renamed the
category to `Plyometric / Jump (Reactive Strength)` and cleaned up `PJ-002`'s purpose text
(it previously name-dropped Garage Strength directly).

**Confirmed — no changes needed:** sled work (`SM-006`), deceleration drills (`CD-001`),
rotational/throwing-power work (`CR-002`, `CR-020`–`CR-027`), and change-of-direction/cutting
drills (`CD-001`–`CD-012`) already cover what the book emphasizes in those areas. Didn't add
duplicates.

---

## 2. `content/coaching-philosophy/coaching-philosophy.md`

- **Section 2 (Garage Strength influences):** added periodization on a third variable —
  **variation** (how many exercise variants are in rotation), alongside volume and intensity —
  low variation early, rising through the middle of a macrocycle, collapsing back down only in
  the final taper. Also added a principle that volume shouldn't drop as fast as intensity climbs
  block to block — it should stay meaningfully present through most of the macrocycle and only
  taper hard at the very end, not ease off gradually every step (flagged as a principle to weigh
  against the existing phase dosing tables, not a mandate to rewrite their numbers). Added a
  one-line pointer to the new Reflexive Strength category.
- **Section 4 (deloads):** added guidance that a deload should open the NEXT phase rather than
  close out the one ending — especially heading into Max Strength, which should start with a
  lighter week rather than jumping straight to peak loading. Named two optional secondary deload
  windows (end of GPP/Reacclimation, mid-Hypertrophy).
- **Section 5, new — "Hypertrophy work in a running sport":** hypertrophy volume should build
  usable tissue/tendon/joint capacity, not bodyweight for its own sake, given ultimate's
  running-economy demands — don't treat more hypertrophy volume as automatically better.
- **Section 5, new — "Tournament-weekend conditioning":** conditioning should account for
  repeating high-level performance across multiple games in a single tournament day, not just
  repeating points within one game, as a priority weekend approaches.
- **Section 7:** exercise count updated (238 → 266) and a note added about the new category and
  the Reactive Strength rename.

## 3. `content/day-structure-templates/day-structure-templates.md`

- Header comment reworded to drop the reference to "Peak Strength" (the book's own branded
  companion app name) and to name the new Reflexive Strength slot as this coach's own build.
- **New slot: `REFLEXIVE_STRENGTH`** — added to the Slot Vocabulary table and wired into
  **Athlete Day**'s slot order (now `NEURO_PRIMING → PLYOMETRICS → SPEED_ACCEL → AGILITY →
  REFLEXIVE_STRENGTH`), with its own phase-by-phase dosing row advancing the athlete along
  whichever RS-chain fits their situation (entry-level in GPP, up through the full-expression
  exercise by Power Conversion, light touch or omitted at Peak/Taper). The CONDITIONING finisher
  (3-5 days/week, no league day) now appends after this slot instead of after AGILITY.
- **`TECHNICAL_COORDINATION` slot:** added a default preference for hang/high-pull Olympic-lift
  variants over full-floor pulls at this slot's light-moderate coordination loads.
- **`HINGE_PATTERN` slot:** added a default preference for trap bar deadlift/RDL variants over
  conventional deadlift when either is a reasonable option, for load-position and season-long
  durability reasons — conventional deadlift stays fine where that's what's available or already
  trained.

---

## Not changed (and why)

- No numeric dosing bands were rewritten wholesale — the volume/variation principles above are
  framed as judgment calls layered onto the existing tables, since the exact %/rep numbers are
  already tuned and load-bearing for the generation pipeline.
- No proprietary phase names (their 5-phase cycle), athlete-typology system, or any of their
  named drills/equipment brands were used anywhere in this update.
