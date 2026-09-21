-- Exercise Library table — the queryable, filterable version of
-- exercise-library.xlsx. This is what the server-side equipment pre-filter
-- (Coaching Philosophy §5) actually queries before either AI call.

create table exercise_library (
  exercise_id text primary key,             -- e.g. "UP-013"
  exercise_name text not null,
  priority_tier text not null check (priority_tier in ('core_50','extended')),
  movement_pattern text not null,
  primary_purpose text,
  equipment_needed jsonb not null default '[]',  -- matches the intake equipment vocabulary
  equipment_needed_raw text,  -- original spreadsheet text, kept for human reference
  space_requirements text,
  cue text,
  regression text,
  progression text,
  training_age text,     -- dropdown-validated in the source sheet: novice/intermediate/advanced/all
  season_tag text,
  injury_considerations jsonb not null default '[]', -- matches the injury location vocabulary
  contrast_pairing_tendon_specific text,
  notes text
);

create index idx_exercise_library_equipment on exercise_library using gin (equipment_needed);
create index idx_exercise_library_pattern on exercise_library (movement_pattern);
create index idx_exercise_library_injury on exercise_library using gin (injury_considerations);
