-- Ultimate Training App — initial schema
-- Direct translation of the entity map in data-architecture-spec.md,
-- pulling in every field defined across intake-funnel-spec.md,
-- review-approval-flow-spec.md, workout-logging-schema-spec.md,
-- corpus-retrieval-spec.md, and system-prompt-v3.md.
--
-- Run this in the Supabase SQL editor (or via `supabase db push` once you
-- have the CLI set up) against a fresh project.

create extension if not exists "uuid-ossp";

-- ============================================================
-- ATHLETES
-- ============================================================

create table athletes (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INTAKE  (intake-funnel-spec.md)
-- ============================================================

create table athlete_intake (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,

  age integer,
  benchmark_set text check (benchmark_set in ('male_typical', 'female_typical', 'general_range')),

  years_playing_ultimate integer,
  years_structured_training integer,
  lifting_experience_selfdescribe text check (
    lifting_experience_selfdescribe in ('new', 'comfortable_with_basics', 'very_experienced')
  ),

  season_start date,
  season_end date,
  recurring_commitments jsonb not null default '[]',   -- [{day_of_week, time, label}]
  tournament_weekends jsonb not null default '[]',      -- [{start_date, end_date, label}]
  season_calendar_confirmed boolean not null default false, -- false = "not yet released" per the funnel spec

  training_days_per_week integer not null check (training_days_per_week between 2 and 6),

  equipment jsonb not null default '[]',
  -- e.g. ["barbell_rack","bench","dumbbells","kettlebell","pullup_bar",
  --       "cable_machine","bands","med_ball","boxes","sled","turf_track",
  --       "cardio_machine","bodyweight_only"]

  bodyweight_lb numeric,
  back_squat_weight numeric, back_squat_reps integer,
  bench_press_weight numeric, bench_press_reps integer,
  deadlift_or_clean_weight numeric, deadlift_or_clean_reps integer,
  pullup_max_reps integer,
  vertical_jump_in numeric,

  goals text,

  submitted_at timestamptz not null default now()
);

-- Structured injury screening (Screen 7 of the funnel spec) — one row per
-- reported area, supporting both current/active (Part A) and history (Part B).
create table athlete_injury_reports (
  id uuid primary key default uuid_generate_v4(),
  intake_id uuid not null references athlete_intake(id) on delete cascade,
  location text not null check (
    location in ('achilles_calf','patellar_knee','acl_knee','hamstring',
                 'groin_adductor','shoulder','lower_back','ankle','other')
  ),
  location_other_text text,
  report_type text not null check (report_type in ('current_active','history')),
  -- Part A fields (current_active only):
  character text check (character in ('sharp_sudden','tight_sore_gradual')),
  duration_text text,
  -- shared:
  notes text,
  created_at timestamptz not null default now()
);

create table athlete_catchall_restrictions (
  id uuid primary key default uuid_generate_v4(),
  intake_id uuid not null references athlete_intake(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CURRENT ATHLETE STATE  (system-prompt-v3.md — "Stored objects")
-- One living row per athlete. Seeded from intake, then permanently
-- overwritten by real Phase Performance Summary data from the athlete's
-- second phase onward (see the lifecycle note in system-prompt-v3.md).
-- ============================================================

create table current_athlete_state (
  athlete_id uuid primary key references athletes(id) on delete cascade,

  bodyweight_lb numeric,
  back_squat_1rm numeric,
  bench_press_1rm numeric,
  deadlift_or_clean_1rm numeric,
  pullup_max_reps integer,
  vertical_jump_in numeric,
  maxes_source text not null default 'intake_estimate' check (
    maxes_source in ('intake_estimate', 'testing_day', 'epley_estimate')
  ),

  equipment jsonb not null default '[]',
  training_days_per_week integer not null,

  -- Injury state: current/active flags carry into the reactive isometric-first
  -- rule; standing_resilience_regions carry into the standing resilience-work
  -- rule and its progression (Coaching Philosophy §5).
  current_active_injuries jsonb not null default '[]',       -- [{location, character, since}]
  standing_resilience_regions jsonb not null default '[]',   -- [{location, current_stage}]

  updated_at timestamptz not null default now()
);

-- ============================================================
-- MACROCYCLE SKELETON
-- Note per data-architecture-spec.md: this table is a *read-side
-- projection* of the latest approved macrocycle_planner ProgramDraft, not
-- an independently-edited object. It's written only by the approval flow
-- (see program_drafts.status transition to 'approved' below).
-- ============================================================

create table macrocycle_skeletons (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  source_draft_id uuid not null,   -- FK added after program_drafts exists, see below
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table macrocycle_phases (
  id uuid primary key default uuid_generate_v4(),
  skeleton_id uuid not null references macrocycle_skeletons(id) on delete cascade,
  phase_number integer not null,
  phase_name text not null,
  goal text not null check (
    goal in ('gpp_reacclimation','hypertrophy','max_strength',
             'power_conversion','peak_taper','injury_return','testing_block')
  ),
  start_date date not null,
  end_date date not null,
  week_count integer not null,
  weekly_template_label text not null,   -- athlete-specific generic label, not "4A"/"4B"
  deload_test_note text,
  status text not null default 'upcoming' check (
    status in ('upcoming','active','completed','superseded')
  ),
  unique (skeleton_id, phase_number)
);

-- ============================================================
-- PHASE PERFORMANCE SUMMARY  (system-prompt-v3.md spec table)
-- One per phase transition or rebuild interruption. Historical — never
-- overwritten.
-- ============================================================

create table phase_performance_summaries (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  phase_id uuid not null references macrocycle_phases(id),

  adherence jsonb not null,               -- {completed, partial, skipped, skip_reasons: {...}}
  updated_maxes jsonb not null,           -- {lift: {value, source: testing_day|epley_estimate}}
  performance_vs_prescription jsonb not null, -- per-lift hit/exceed/miss + last_clean_set anchor
  flags jsonb not null default '[]',
  resilience_progression_state jsonb not null default '{}', -- {location: {stage, last_result}}

  reason text not null check (
    reason in ('normal_transition','rebuild_phase_scoped','rebuild_skeleton_scoped')
  ),
  reason_detail text,

  upcoming_schedule jsonb not null default '[]',

  created_at timestamptz not null default now()
);

-- ============================================================
-- REVIEW & APPROVAL  (review-approval-flow-spec.md)
-- ============================================================

create table program_drafts (
  id uuid primary key default uuid_generate_v4(),
  lineage_id uuid not null default uuid_generate_v4(), -- shared across versions of "the same draft"
  athlete_id uuid not null references athletes(id) on delete cascade,
  call_type text not null check (call_type in ('macrocycle_planner','phase_builder')),
  phase_id uuid references macrocycle_phases(id), -- null for macrocycle_planner drafts
  version integer not null default 1,
  parent_version integer,

  status text not null default 'pending_review' check (
    status in ('pending_review','approved','rejected')
  ),
  publish_to_athlete boolean,   -- set at approval time, independent of add_to_corpus
  add_to_corpus boolean,

  input_snapshot jsonb not null, -- exact references: skeleton version, PPS id, intake/state version, corpus entries used
  output jsonb not null,          -- {rationale, program_table, athlete_intro, coach_review_flags}

  edit_source text check (edit_source in ('chat','direct_override')),
  edit_request jsonb, -- text (chat) or {field_path, old_value, new_value} (direct_override)

  reviewed_by text default 'primary_coach', -- single-coach project; kept for future-proofing only

  created_at timestamptz not null default now()
);

alter table macrocycle_skeletons
  add constraint macrocycle_skeletons_source_draft_fk
  foreign key (source_draft_id) references program_drafts(id);

create table review_thread_entries (
  id uuid primary key default uuid_generate_v4(),
  lineage_id uuid not null, -- matches program_drafts.lineage_id
  entry_type text not null check (entry_type in ('chat','direct_override')),
  role text check (role in ('coach','model')),          -- chat entries only
  text text,                                             -- chat entries only
  field_path text, old_value jsonb, new_value jsonb,     -- direct_override entries only
  resulting_version integer not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SELF-CONSISTENCY CORPUS  (review-approval-flow-spec.md + corpus-retrieval-spec.md)
-- ============================================================

create table corpus_entries (
  id uuid primary key default uuid_generate_v4(),
  source_draft_id uuid not null references program_drafts(id),
  call_type text not null check (call_type in ('macrocycle_planner','phase_builder')),

  situation_tags jsonb not null,
  -- {phase_goal, training_age, injury_individualization: [location,...],
  --  days_per_week, equipment_context}

  retired boolean not null default false,
  added_at timestamptz not null default now()
);

-- ============================================================
-- WORKOUT LOGGING  (workout-logging-schema-spec.md)
-- ============================================================

create table scheduled_sessions (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  phase_id uuid not null references macrocycle_phases(id),
  source_draft_id uuid not null references program_drafts(id), -- copied at publish time
  date date not null,
  week_number integer not null,
  day_label text not null,
  week_type text not null check (week_type in ('build','deload','test')),
  prescribed_exercises jsonb not null, -- snapshot, not a live reference
  unique (athlete_id, date)
);

create table session_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null unique references scheduled_sessions(id) on delete cascade,
  status text not null check (status in ('completed','partially_completed','skipped')),
  skip_reason text check (
    skip_reason in ('pain_injury','schedule_conflict','illness','no_equipment','other')
  ),
  skip_reason_other_text text,
  overall_notes text,
  logged_at timestamptz not null default now()
);

create table logged_exercises (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references scheduled_sessions(id) on delete cascade,
  exercise_id text not null,          -- references the Exercise Library (see content/exercise-library)
  tier integer not null check (tier in (1,2,3)),
  prescribed_target text not null,

  substituted_exercise_id text,
  substitution_reason text,

  weight_used numeric,
  reps_completed integer,
  sets_completed integer,
  rir integer check (rir between 0 and 5),
  est_1rm numeric, -- calculated (Epley), never entered directly — see lib/training/epley.ts

  load_descriptor text, -- band/vest/pin notation — NOT read by any AI rule, presentation only
  notes text,

  logged_at timestamptz not null default now()
);

create table testing_day_results (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  phase_id uuid not null references macrocycle_phases(id),
  exercise_id text not null,
  result_weight numeric,
  result_reps integer,
  result_value numeric, -- non-load tests (vertical jump, sprint time, Yo-Yo distance)
  is_true_max boolean not null default false,
  logged_at timestamptz not null default now()
);

create table bodyweight_entries (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  date date not null,
  bodyweight_lb numeric not null,
  unique (athlete_id, date)
);

-- ============================================================
-- Indexes worth having from day one
-- ============================================================

create index idx_program_drafts_lineage on program_drafts(lineage_id);
create index idx_program_drafts_athlete on program_drafts(athlete_id, call_type, status);
create index idx_scheduled_sessions_athlete_date on scheduled_sessions(athlete_id, date);
create index idx_logged_exercises_exercise on logged_exercises(exercise_id);
create index idx_corpus_entries_situation on corpus_entries using gin (situation_tags);
