# Training Targets Reference (Draft v1)

*Benchmark targets for key lifts, bodyweight strength-endurance, power, speed, conditioning, and injury-resilience markers — giving the AI (and the athlete) a concrete sense of where their numbers realistically sit for their training age, and what a reasonable next target looks like. These are compass points, not pass/fail thresholds or hard prescriptions — every number here is subordinate to the individualization rules already in the Coaching Philosophy (equipment, injury, training age progression). A target never overrides those; it just adds context to the rationale and phase-emphasis decisions.*

---

## How this gets used

- **Not a new rule engine.** This is additional static context passed alongside the Coaching Philosophy and Exercise Library to both the Macrocycle Planner and Phase Builder — the same tier as the Primary Reference Program Summary.
- **Contextualizes current numbers.** When a testing day result or an updated max comes in, the model can say something concrete: "this puts your squat solidly in the Intermediate band relative to bodyweight — Advanced sits around 2x bodyweight, which is realistic within a few more phases" — rather than a number with no frame of reference.
- **Informs phase emphasis, doesn't dictate it.** If an athlete's numbers are notably behind their training-age target in one quality (say, pulling strength) relative to everything else, that's a legitimate input into where the Macrocycle Planner leans emphasis — but it never overrides a real constraint (an Achilles flare-up still takes priority over "let's chase the vertical jump target this phase").
- **Feeds the athlete-facing intro**, giving the coach's voice something concrete and motivating to reference ("here's where this puts you, here's what's realistic next") rather than generic encouragement.

---

## 1RM strength standards (relative to bodyweight)

*Approximate, field-sport-athlete-oriented guidelines — not powerlifting-specific maxes, and meant to be refined against what you actually see, not treated as rigid.*

| Lift | Novice | Intermediate | Advanced |
|---|---|---|---|
| **Back Squat** — Male-typical | 1.0x BW | 1.5x BW | 2.0x BW+ |
| **Back Squat** — Female-typical | 0.75x BW | 1.25x BW | 1.75x BW+ |
| **Bench Press** — Male-typical | 0.75x BW | 1.1x BW | 1.5x BW+ |
| **Bench Press** — Female-typical | 0.5x BW | 0.75x BW | 1.0x BW+ |
| **Deadlift** (conventional or trap bar) — Male-typical | 1.25x BW | 1.75x BW | 2.25x BW+ |
| **Deadlift** — Female-typical | 1.0x BW | 1.5x BW | 2.0x BW+ |
| **Power Clean / Hang Clean** (full catch) — Male-typical | 0.5x BW | 0.75x BW | 1.0x BW+ |
| **Power Clean / Hang Clean** — Female-typical | 0.4x BW | 0.6x BW | 0.85x BW+ |

---

## Strength-endurance standards (bodyweight)

| Test | Novice | Intermediate | Advanced |
|---|---|---|---|
| **Push-ups** (max unbroken, standard form) — Male-typical | 15-20 | 30-40 | 50+ |
| **Push-ups** — Female-typical | 10-15 | 20-30 | 40+ |
| **Pull-ups** (dead hang to chin over bar, max reps) — Male-typical | 3-5 | 8-12 | 15+ |
| **Pull-ups** — Female-typical | 1-3 (or 5+ banded-assisted) | 5-8 | 10+ |

---

## Power / explosiveness standards

| Test | Novice | Intermediate | Advanced |
|---|---|---|---|
| **Vertical Jump** (standing, countermovement) — Male-typical | 16-20 in | 22-26 in | 28 in+ |
| **Vertical Jump** — Female-typical | 12-16 in | 18-22 in | 24 in+ |
| **Broad Jump** (standing, two-foot) — Male-typical | 6.5-7.5 ft | 8-8.5 ft | 9 ft+ |
| **Broad Jump** — Female-typical | 5.5-6.5 ft | 7-7.5 ft | 8 ft+ |

---

## Speed & change-of-direction standards

*Directly tied to Section 3's movement demands — first-step quickness for cutting and true top-end sprint mechanics for deep cuts.*

| Test | Novice | Intermediate | Advanced |
|---|---|---|---|
| **10-Yard Sprint** (3-point or athletic stance) — Male-typical | 1.9-2.0s | 1.75-1.85s | <1.7s |
| **10-Yard Sprint** — Female-typical | 2.0-2.1s | 1.85-1.95s | <1.8s |
| **Pro Agility / 5-10-5 Shuttle** — Male-typical | 5.0-5.3s | 4.6-4.9s | <4.5s |
| **Pro Agility / 5-10-5 Shuttle** — Female-typical | 5.3-5.6s | 4.9-5.2s | <4.8s |

---

## Conditioning / energy-system standard (ultimate-specific)

This is the one that has to match the sport's actual demand profile from Section 3 — intermittent, repeated high-intensity bursts (30-90 second points) on top of a substantial aerobic base, sustained across 5-7 games in a tournament weekend. A straight distance-run time (mile time, Cooper test) tests aerobic capacity alone and misses the repeated-effort/incomplete-recovery piece that actually defines the sport.

**Primary: Yo-Yo Intermittent Recovery Test, Level 1** — the standard conditioning benchmark in soccer and other intermittent field sports, and the closest existing standardized test to ultimate's actual work-to-rest pattern.

| Level | Distance |
|---|---|
| Novice | 600-1000 m |
| Intermediate | 1200-1600 m |
| Advanced | 1800 m+ |

**Accessible alternative: Multi-Stage Fitness Test ("Beep Test")** — if a Yo-Yo IR1 setup (20m shuttle, audio track) isn't practical, this is a widely available substitute with a similar intermittent-shuttle demand.

| Level | Beep Test Stage |
|---|---|
| Novice | Level 7-8 |
| Intermediate | Level 9-11 |
| Advanced | Level 12+ |

---

## Injury-resilience markers

*Ties directly into Section 5's "injury history → standing resilience work" rule — these give that rule's progression something concrete to advance toward, matching the "measurably more resilient by season's end" goal, not just an open-ended "add some accessory work."*

| Test | Novice | Intermediate | Advanced |
|---|---|---|---|
| **Front Plank Hold** | 45-60s | 90-120s | 150s+ |
| **Single-Leg Squat / Step-Down** (controlled, full range, per leg) | 3-5 reps | 8-10 reps | 12-15+ reps |

---

## Resolved: benchmark set selection at intake

Added to `intake-funnel-spec.md` Screen 1 as **"Which benchmark set should we compare your numbers against?"** — Male-typical / Female-typical / Prefer a general range — deliberately framed as a comparison choice, not an identity question, fitting ultimate's inclusive culture. All three options are first-class, not a primary path plus a fallback.

**"Prefer a general range" produces its own real target set**, not a blank or an average masquerading as precision: for every table above, the combined range spans from that tier's lower bound across both tables to its upper bound across both. For example, Intermediate Back Squat becomes **1.25x-1.5x BW** (spanning the Female-typical 1.25x and Male-typical 1.5x figures) rather than picking one table or splitting the difference into a single misleadingly precise number. This keeps the "general range" option genuinely useful context rather than a degraded one.

---

## Where this plugs into the existing system

- **`system-prompt-v3.md`** — add as a numbered source-of-truth item to both the Macrocycle Planner and Phase Builder prompts, alongside the Coaching Philosophy, Exercise Library, and Primary Reference Program Summary.
- **Coaching Philosophy** — a short pointer paragraph (similar to how §7 points to the Exercise Library spreadsheet) so the document's own "source of truth" list stays complete.
