# Ultimate Training App

AI-generated strength & conditioning programs for ultimate frisbee players, built on the
two-tier Macrocycle Planner + Phase Builder architecture from `system-prompt-v3.md`.

## What's built so far (v1)

This is the **backend foundation**, not yet a full app with screens for every flow in the
specs. Specifically working:

- Full Postgres schema (`supabase/migrations/`) covering every entity across all four specs
  (intake, review/approval, workout logging, corpus retrieval) plus the Macrocycle Skeleton,
  Phase Performance Summary, and Current Athlete State.
- The Exercise Library, converted from your spreadsheet and ready to seed.
- Live API routes that actually call Claude:
  - `POST /api/intake` — submits an athlete's intake, seeds their Current Athlete State
  - `POST /api/macrocycle-planner` — runs Call 1, writes a draft for review
  - `POST /api/phase-builder` — runs Call 2 (including the equipment pre-filter and corpus
    retrieval scoring), writes a draft for review
- A one-line marketing landing page at `/`.

**Not yet built:** the actual intake form UI, the review/approval screen (chat edits + direct
overrides), the workout logging UI, and the Phase Performance Summary auto-compile job. Those
are the natural next slices — this first pass proves the core AI integration works end to end
before spending effort on screens.

## One-time setup

### 1. Install dependencies

This was written without running `npm install` (this session's sandbox blocks the npm
registry) — so this is the first thing to run once you have the code on a machine with normal
internet access:

```bash
npm install
```

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), sign up (free), and create a new project.
2. In the project dashboard, go to **SQL Editor**, and run the contents of
   `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_exercise_library.sql`,
   in that order.
3. Go to **Settings > API**. You'll need three values from this page for the next step:
   - Project URL
   - `anon` `public` key
   - `service_role` key (click "Reveal" — keep this one secret, it bypasses all access rules)

### 3. Create your Anthropic API key

This is separate from your claude.ai subscription — a different account with its own
usage-based billing.

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up.
2. Go to **API Keys**, create a new key.
3. Add a small amount of credit (a few dollars covers a lot of testing at this volume).

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the four values from steps 2-3.

### 5. Seed the Exercise Library

```bash
npm run seed
```

This reads `content/exercise-library/exercise-library.json` (already converted from your
spreadsheet) and loads all 253 exercises into Supabase. Safe to re-run any time you update the
spreadsheet — just re-run `python3 scripts/convert_exercise_library.py` first to regenerate the
JSON, then `npm run seed` again.

### 6. Run it locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Deploying

1. Push this code to a GitHub repo.
2. Go to [vercel.com](https://vercel.com), sign up (free), and import the repo.
3. In the Vercel project's **Settings > Environment Variables**, add the same four values from
   your `.env.local`.
4. Deploy. Vercel runs `npm install` and the build for you — this is where the npm registry
   block from this sandbox doesn't matter at all.
5. Once you have a domain, add it under **Settings > Domains** — Vercel handles the DNS
   instructions for whichever registrar you bought it from.

## Testing the AI integration without a UI yet

Since the intake form UI doesn't exist yet, you can exercise the whole pipeline with `curl`
once the app is running (locally or deployed) and you've created an athlete row manually:

```bash
# 1. Create an athlete (do this once, directly in Supabase's Table Editor,
#    or via the SQL Editor: insert into athletes (email, name) values (...)).

# 2. Submit intake
curl -X POST http://localhost:3000/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "athleteId": "<the athlete uuid>",
    "age": 24,
    "benchmark_set": "male_typical",
    "years_playing_ultimate": 5,
    "years_structured_training": 4,
    "lifting_experience_selfdescribe": "very_experienced",
    "season_start": "2026-09-28",
    "season_end": "2027-05-30",
    "training_days_per_week": 5,
    "equipment": ["barbell_rack", "bench", "dumbbells", "pullup_bar"],
    "bodyweight_lb": 170,
    "back_squat_weight": 205, "back_squat_reps": 1,
    "bench_press_weight": 155, "bench_press_reps": 1,
    "goals": "Get faster and stronger for winter league",
    "injuryReports": [
      {"location": "achilles_calf", "report_type": "history"},
      {"location": "groin_adductor", "report_type": "history"}
    ]
  }'

# 3. Run the Macrocycle Planner
curl -X POST http://localhost:3000/api/macrocycle-planner \
  -H "Content-Type: application/json" \
  -d '{"athleteId": "<the athlete uuid>"}'

# This returns a draft with the generated skeleton. From here, the next real
# piece of work is the review/approval screen so you can actually approve it
# (which is what turns the draft into an active macrocycle_skeletons +
# macrocycle_phases row) — right now, approving would need to be done by hand
# in Supabase's Table Editor as a stand-in until that screen exists.
```

## Project structure

```
app/
  page.tsx                     marketing landing page
  api/
    intake/route.ts            Call: submit intake, seed Current Athlete State
    macrocycle-planner/route.ts   Call 1
    phase-builder/route.ts        Call 2
lib/
  anthropic-client.ts           Claude API client
  prompts/
    system-prompt-v3.md         the actual spec doc — source of truth for prompt text
    extract-system-prompts.ts   pulls CALL 1 / CALL 2 prompts out of that doc
    macrocycle-planner.ts       assembles context + calls Claude (tool use)
    phase-builder.ts            same, for Call 2
    static-content.ts           loads Coaching Philosophy / Training Targets
  corpus/
    retrieve.ts                 scoring logic from corpus-retrieval-spec.md
    fallback-examples.ts        hand-written example fallback
  db/
    supabase-admin.ts           server-only Supabase client
    exercise-filter.ts          equipment pre-filter query
  training/
    epley.ts                    the one Epley formula, used everywhere
    training-age.ts             years-trained -> Novice/Intermediate/Advanced
content/
  coaching-philosophy/          coaching-philosophy.md
  training-targets/             training-targets-reference.md
  example-programs/             the 4 hand-written examples + primary reference summary
  exercise-library/             source .xlsx + converted .json
supabase/migrations/            the full schema, run these in order
scripts/
  convert_exercise_library.py   .xlsx -> .json (run when the spreadsheet changes)
  seed.ts                       loads the .json into Supabase
```

## What's next

Roughly in order of what unlocks the most:
1. **Review/approval screen** — right now a generated draft has nowhere to be approved except
   Supabase's Table Editor. This is the highest-value next slice.
2. **Intake form UI** — replace the `curl` workflow with the actual funnel from
   `intake-funnel-spec.md`.
3. **Phase Performance Summary auto-compile** — currently there's no job that turns logged
   sessions into a summary; Phase Builder calls after the first one need this to exist.
4. **Workout logging UI** — the athlete-facing side, per `workout-logging-schema-spec.md`.
