-- Exercise Library v2 + slot-fill day structure (Oct 2026).
-- Run this BEFORE deploying the matching code, then run `npm run seed`
-- (loads the 286-row v2 library). Safe to run once; the legacy-rename block
-- guards itself against a second run.
--
-- 1. exercise_library: new tag columns for the v2 scheme (category / subcategory,
--    laterality, plane, region, space tier, experience gate, phase window,
--    injury-chain membership, conditioning time frame, fill mode, ...).
-- 2. Legacy (v1) rows: three v1 prefixes (CN-, CR-, RS-) collide with v2 ids, so
--    those rows are renamed LEG-<old id> and every reference to them is rewritten
--    (logged history, scheduled sessions, drafts). ALL v1 rows are then marked
--    inactive: they still resolve for history but are never prescribed or swapped in.
-- 3. athlete_intake / current_athlete_state: available_space and
--    conditioning_modality; equipment vocabulary migrated (cardio_machine is
--    split into treadmill / bike / rower; barbell athletes get weight_plates).
-- 4. New injury areas: hip_flexor, elbow, wrist (abdominal already existed).
-- 5. athlete_slot_pins: coach pins an exercise to a slot for one athlete.

-- ---------------------------------------------------------------- 1. columns
alter table exercise_library
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists also_tagged jsonb not null default '[]',
  add column if not exists equipment_groups jsonb not null default '[]',
  add column if not exists min_experience text check (min_experience in ('N','C','VE')),
  add column if not exists phases jsonb not null default '[]',
  add column if not exists space_tier text check (space_tier in ('minimal','standard','large')),
  add column if not exists laterality text check (laterality in ('bilateral','unilateral')),
  add column if not exists plane text check (plane in ('horizontal','incline','vertical')),
  add column if not exists region text,
  add column if not exists joints_loaded jsonb not null default '[]',
  add column if not exists regress_from jsonb not null default '[]',
  add column if not exists progress_to jsonb not null default '[]',
  add column if not exists fill_mode text check (fill_mode in ('R','S')),
  add column if not exists chain_memberships jsonb not null default '[]',
  add column if not exists time_frames jsonb not null default '[]',
  add column if not exists impact text,
  add column if not exists logging_tier smallint check (logging_tier in (1,2,3)),
  add column if not exists library_version smallint not null default 1;

create index if not exists idx_exercise_library_category on exercise_library (category, subcategory);
create index if not exists idx_exercise_library_chain on exercise_library using gin (chain_memberships);

-- ------------------------------------------------- 2. legacy rows: rename + retire
do $$
begin
  if exists (
    select 1 from exercise_library
    where library_version = 1 and exercise_id ~ '^(CN|CR|RS)-'
  ) then
    -- history tables
    update logged_exercises set exercise_id = 'LEG-' || exercise_id where exercise_id ~ '^(CN|CR|RS)-';
    update logged_exercises set substituted_exercise_id = 'LEG-' || substituted_exercise_id
      where substituted_exercise_id ~ '^(CN|CR|RS)-';
    update testing_day_results set exercise_id = 'LEG-' || exercise_id where exercise_id ~ '^(CN|CR|RS)-';

    -- JSON snapshots that embed exercise ids
    update scheduled_sessions
      set prescribed_exercises = regexp_replace(
        prescribed_exercises::text, '"exercise_id": ?"(CN|CR|RS)-', '"exercise_id": "LEG-\1-', 'g')::jsonb
      where prescribed_exercises::text ~ '"exercise_id": ?"(CN|CR|RS)-';
    update program_drafts
      set output = regexp_replace(
        output::text, '"exercise_id": ?"(CN|CR|RS)-', '"exercise_id": "LEG-\1-', 'g')::jsonb
      where output is not null and output::text ~ '"exercise_id": ?"(CN|CR|RS)-';

    -- the library rows themselves
    update exercise_library set exercise_id = 'LEG-' || exercise_id
      where library_version = 1 and exercise_id ~ '^(CN|CR|RS)-';
  end if;
end $$;

-- every v1 row stops being prescribed; v2 rows arrive via `npm run seed`
update exercise_library set is_active = false where library_version = 1;

-- -------------------------------------- 3. intake / state: space, modality, equipment
alter table athlete_intake
  add column if not exists available_space text not null default 'standard'
    check (available_space in ('minimal','standard','large')),
  add column if not exists conditioning_modality text not null default 'running'
    check (conditioning_modality in ('running','bike','rower','ski_erg','jump_rope','incline_walk'));
alter table current_athlete_state
  add column if not exists available_space text not null default 'standard'
    check (available_space in ('minimal','standard','large')),
  add column if not exists conditioning_modality text not null default 'running'
    check (conditioning_modality in ('running','bike','rower','ski_erg','jump_rope','incline_walk'));

-- Existing athletes: running room on file means a large space; everyone else stays "standard".
update current_athlete_state set available_space = 'large' where equipment ? 'turf_track';
update athlete_intake set available_space = 'large' where equipment ? 'turf_track';

-- cardio_machine ("Treadmill/Bike/Rower") is split into three options; keep what they had.
update current_athlete_state
  set equipment = (
    select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
    from jsonb_array_elements_text(equipment || '["treadmill","bike","rower"]'::jsonb) v
    where v <> 'cardio_machine')
  where equipment ? 'cardio_machine';
update athlete_intake
  set equipment = (
    select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
    from jsonb_array_elements_text(equipment || '["treadmill","bike","rower"]'::jsonb) v
    where v <> 'cardio_machine')
  where equipment ? 'cardio_machine';

-- Weight plates are a new option; anyone with a barbell + rack has plates.
update current_athlete_state set equipment = equipment || '["weight_plates"]'::jsonb
  where equipment ? 'barbell_rack' and not (equipment ? 'weight_plates');
update athlete_intake set equipment = equipment || '["weight_plates"]'::jsonb
  where equipment ? 'barbell_rack' and not (equipment ? 'weight_plates');

-- ------------------------------------------------------------ 4. injury areas
alter table athlete_injury_reports drop constraint if exists athlete_injury_reports_location_check;
alter table athlete_injury_reports
  add constraint athlete_injury_reports_location_check
  check (location in ('achilles_calf','patellar_knee','acl_knee','hamstring','groin_adductor','abdominal',
                      'shoulder','lower_back','ankle','hip_flexor','elbow','wrist','other'));

-- ----------------------------------------------------------- 5. coach slot pins
create table if not exists athlete_slot_pins (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  slot_key text not null,            -- e.g. 'D1.abs' (see lib/generation/slots)
  exercise_id text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (athlete_id, slot_key)
);
alter table athlete_slot_pins enable row level security;
