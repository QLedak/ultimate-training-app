# PRIMARY REFERENCE PROGRAM — 9-Month Off-Season Tracker (Ultimate Frisbee)

*Uploaded by the coach as their own real program (built for themselves as the athlete), spanning Sept 28, 2026 -> late May 2027. Per the coach's instruction, this is the PRIMARY resource for future AI-generated programs — Example Programs 1-4 (in `/programs/`) are secondary context only, useful for structural variety but subordinate to this one whenever they conflict. This document extracts the reusable structure and conventions from the full 780-row workbook; the original file (`primary-program-offseason-tracker.xlsx`) was returned to the coach and is not duplicated here in full — this summary is what should actually be fed to the model as a few-shot reference, since the full sheet is far larger than a useful prompt payload.*

---

## Athlete Snapshot (Sept 28, 2026 baseline)

| Metric | Starting Value |
|---|---|
| Bodyweight | 170 lbs |
| Back Squat | 205 lbs |
| Power Clean | 175 lbs |
| Bench Press | 155 lbs |
| Pull-ups (max reps) | 4 |
| Vertical Jump | 24 in |

Equipment: full barbell gym (no trap bar), 20-yard turf strip, treadmill.

---

## Macrocycle — 5 Phases, 35 Weeks

| Phase | Dates | Weeks | Primary Goal | Weekly Template |
|---|---|---|---|---|
| Phase 0 — Reacclimation | Sep 28 – Oct 18 | 3 | Rebuild tissue tolerance, groove technique | 4A (pre-league) |
| Phase 1 — Hypertrophy | Oct 19 – Dec 13 | 8 | 170 → 175 lbs, build work capacity | 4A wks 1-3, 4B wks 4-8 |
| Phase 2 — Max Strength | Dec 14 – Feb 7 | 8 | Squat/bench/pull-up PRs, clean refinement | 4B (in-season) |
| Phase 3 — Power Conversion | Feb 8 – Apr 4 | 8 | Convert strength to power — jump/sprint/COD | 4B (in-season) |
| Phase 4 — Peak & Sharpen | Apr 5 – May 30 | 8 | Taper volume, max speed, season-ready | 4B (in-season) |

**Weekly templates:**
- **4A — Pre-League** (Sep 28 – Nov 9): Mon Lower A / Tue Upper B / Wed Speed-Plyo / Thu Lower C / Fri Upper D / Sat Conditioning / Sun Rest
- **4B — In-Season** (Nov 10 on, winter league Tuesdays): Mon Upper A / Tue GAME / Wed Lower A / Thu Upper B / Fri Lower C / Sat Speed-Plyo / Sun Rest

Note the split changes shape at the same point the game schedule starts (winter league begins ~week 7-8) — this is the clearest real example yet of the Coaching Philosophy's "build the split backward from game day" rule actually happening: the template itself restructures around a fixed weekly game slot (Tuesday), not just an intensity adjustment on existing days.

---

## THE KEY STRUCTURAL CONVENTION: Deload and Test placement are anchored to phase boundaries, not a fixed week count

This is the single most valuable pattern in this program, and it upgrades the "guess from the schedule" deload logic in the system prompt into a concrete default:

**Every phase ends with the same two-week sequence: a Deload week, immediately followed by a Test week.** Not "every 4th week" — the deload/test pair is tied to the *phase transition*, regardless of how many build weeks preceded it (Phase 0 has no deload/test of its own since it's a short ramp-in phase feeding straight into Phase 1; Phases 1-4 each end in Deload → Test):

| Phase | Build weeks | Deload week | Test week |
|---|---|---|---|
| Phase 0 | Weeks 1-3 | *(none — phase is a short ramp-in)* | *(none)* |
| Phase 1 | Weeks 4-9 | Week 10 | Week 11 |
| Phase 2 | Weeks 12-17 | Week 18 | Week 19 |
| Phase 3 | Weeks 20-25 | Week 26 | Week 27 |
| Phase 4 | Weeks 28-34 (Taper, not Build) | *(taper absorbs the deload role)* | Week 35 |

**Deload week mechanics:** every exercise's target gets an explicit `[DELOAD: cut volume ~40%]` tag appended to its normal prescription — the exercise selection and structure stay identical to the build weeks before it, only the volume/intensity note changes. This is a clean, simple mechanical rule: same session skeleton, tagged volume cut, not a redesigned week.

**Test week mechanics:** the week's first training day (Monday) becomes a dedicated "Testing Day" with its own row set — a fixed battery of true max-effort tests (see below), followed by a note to log results on the Testing & PRs tab. The rest of that week's normal sessions continue as scheduled (tagged `[Test week - Testing Day is Monday]`), including games — testing doesn't cancel the rest of the week, it replaces one day's normal content.

**Testing battery grows with the phase** — later phases test more qualities as they become more trained/relevant:
- Phase 1 test (week 11): Back Squat 1-3RM, Bench Press 1-3RM, Weighted Pull-up max, Vertical Jump
- Phase 2 test (week 19): adds Power Clean 1-2RM and 20-yd Sprint to the above
- Phase 3 test (week 27): same full battery as Phase 2
- Phase 4 test (week 35): same full battery, as the final season-readiness checkpoint

**Recommendation for the system prompt's deload/testing logic:** treat "deload the week before a phase transition, test on the first day of the transition week, with the rest of that week continuing normally" as the strong default whenever the athlete's block has a defined phase structure — this is a more concrete and battle-tested rule than open-ended schedule reasoning, and should be tried first before falling back to a generic week-4 default.

---

## Representative sessions by phase (structure, not to be copied verbatim)

**Phase 0, Week 1 (Build) — 4A template, pre-league:**
- Lower A: Back Squat 4x5 @ 65-70%, Bulgarian Split Squat 3x8/leg, Copenhagen Plank (knee-supported) 3x20-30s/side, Dead Bug 3x10/side
- Upper B: Bench Press 4x6 @ 65-70%, Weighted/Assisted Pull-up 4x5, DB Incline Press 3x10, Face Pull 3x15, Pallof Press 3x10/side
- Speed/Plyo: Banded Hip Flexor March, Sprint mechanics + build-ups (full 20yd) 4-6 reps, Ankle Pogo Hops 3x15, HSR Calf Raise 3x12
- Lower C: Barbell Deadlift (conventional) 4x6 @ moderate, Lateral Lunge, Single Leg RDL, Side Plank
- Upper D: Pull-up Protocol volume (15-25 total reps, banded assist), Weighted Push-up (light), Seated Row, DB Shoulder Press, Band Pull-Apart
- Conditioning: Treadmill Tempo Intervals, 8-10x 30-45s hard / 90s walk

**Phase 1, Week 4 (Build, early) — 4B begins, still no games yet:**
- Lower A: Power Clean (full catch) 5x3 @ 70-75%, Back Squat (3-1-1 tempo) 4x8 @ 70%, Bulgarian Split Squat (DB loaded), Copenhagen Plank, Weighted Plank
- Upper B: Bench Press (3-0-1 tempo) 4x8 @ 70-75%, Weighted Dip, DB Incline Press, Triceps Pushdown, Rear Delt Fly
- Speed/Plyo: Sprint mechanics + build-ups to 85%, Pogo Hops → Low Box Pogos, HSR Calf Raise (single-leg), Med Ball Rotational Throw
- Lower C: Front Squat (alternates weekly with Barbell Deadlift), Walking Lunge, Cossack Squat, Hamstring Curl, Hanging Knee Raise, Cable Anti-Rotation Press
- Upper D: Pull-up Protocol (weighted begins), Weighted Push-up, Pendlay Row, DB Floor Press, Biceps Curl/Face Pull superset
- Conditioning: Treadmill Intervals + Turf Sprint Build-ups

**Phase 1, Week 9 (Build, late) — games now integrated into the week:**
Same Lower A/Upper B/Speed-Plyo/Lower C/Upper D skeleton as week 4, PLUS a "GAME" day (Winter League Game) inserted into the week per the 4B template — confirming games are treated as their own day-type in the split, not squeezed around lifting days.

**Phase 2, Week 12 (Build) — max strength phase, wave loading introduced:**
- Upper A: Bench Press (wave) 5x5 → 3x3 @ 80-90%, Weighted Dip, Close-Grip Bench, Face Pull
- Lower A: Power Clean 5x2 @ 80-85%, Back Squat (wave) 5x5 → 3x3 @ 80-90%, Bulgarian Split Squat (heavier), Copenhagen Plank (full)
- Upper B: Weighted Pull-up (now the main strength lift, 5x3-5 adding weight), Weighted Push-up, Pendlay Row, DB Shoulder Press
- Lower C: Barbell Deadlift (wave) 5x5 → 3x3 @ 80-90%, Lateral Lunge (loaded), Single Leg RDL (loaded), Weighted Hanging Knee Raise, Weighted Side Plank
- Speed/Plyo: Max-velocity build-ups (8-10 reps), Pogo → single-leg pogo → low depth drop, HSR Calf Raise (loaded), Med Ball Rotational Throw
- Note the "wave" loading notation (`5x5 -> 3x3 @ 80-90%`) — a single week's prescription spans a rep/intensity wave within the session, not just a flat sets x reps.

**Phase 3, Week 20 (Build) — power conversion, contrast/complex training introduced:**
- Upper A: **Contrast: Bench heavy single (85%) → Plyo Push-up x5 → MB Chest Throw x5, 4 rounds** — a direct, explicit contrast pairing (heavy strength lift immediately followed by an explosive expression of the same pattern), exactly matching the Garage Strength complex/contrast principle from the Coaching Philosophy's Section 2.
- Lower A: **French Contrast: Back Squat heavy single (85-90%) → Box Jump x3 → Loaded Jump Squat x3 → Broad Jump x3, 4 rounds** — a more advanced 4-stage contrast complex (heavy lift, loaded jump, unloaded jump, max-distance jump) for an advanced athlete in this phase.
- Lower C: Loaded Jump Squat, Lateral Bound, Cossack Squat (fast eccentric), Banded Resisted March (fast), Cutting Drills (45° cut, plant-and-go)
- Speed/Plyo: Max velocity build-ups/flying starts, Depth Jumps (low box), Reactive Bounds, **Repeated Sprint Ability (15m, 8 reps, 30s rest)** — directly matches the Coaching Philosophy's energy-system demands (repeated short sprint efforts).

**Phase 4, Week 28 (Taper) — peak & sharpen, volume tapering, day names shift toward sport-specific labels:**
- Upper A: Bench Press 3x3 @ 85%, Weighted Pull-up 3x4, Light accessory (athlete's choice — this phase explicitly hands some selection autonomy back to the athlete)
- Lower A: Power Clean 4x2 @ 80%, Back Squat 3x3 @ 85%, Depth Jump/Bound
- Speed (renamed from Speed/Plyo): Max velocity build-ups, **Cutting/COD drills, game patterns** (4x4 each direction) — most sport-specific framing of any phase
- Reactive/Plyo (new day label, replacing some Lower C/Upper D volume): Bounds, hurdle hops, reactive broad jumps; HSR Calf Raise (maintenance only)
- Overall volume is visibly lower than any prior phase — fewer exercises per day, no isolation/accessory-heavy days — consistent with a true taper.

---

## What this program confirms or sharpens about the existing system prompt / philosophy doc

1. **Deload/test placement**: use the phase-boundary convention above as the strong default (see the recommendation box), not an open-ended schedule inference.
2. **Contrast/complex training terminology**: this coach uses "Contrast:" and "French Contrast:" as explicit labels in the exercise name/notation itself — future generated programs should use this same labeling convention when prescribing a contrast pairing, so it's unambiguous to the athlete what's happening.
3. **Wave loading notation** (`5x5 -> 3x3 @ 80-90%`) is a real prescription pattern this coach uses in a max-strength phase — distinct from the straight rep-max testing protocol used in Example Program 2. Both are valid; which one applies depends on phase (wave for build weeks, true rep-max only on dedicated test days).
4. **Alternating exercises week-to-week** (e.g., "Front Squat (alt weeks w/ Barbell Deadlift)") is a real pattern for managing variety/fatigue across a long block — worth the system prompt explicitly allowing this rather than assuming one fixed exercise per slot for an entire phase.
5. **Games get their own day-type in the split** once the season starts, not just an intensity adjustment — the template itself changes shape (4A → 4B) at the point games begin.
6. **Late-phase day labels shift to sport-specific naming** (Speed/Plyo → "Speed" and "Reactive/Plyo") as the season approaches — a small but real voice/labeling detail worth carrying into generated programs during a peak phase.
