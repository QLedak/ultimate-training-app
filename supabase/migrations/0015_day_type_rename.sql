-- Training day rename (Oct 2026) — naming only; day structure is unchanged:
--   Lower Body Strength -> Lower Strength
--   Upper Body Strength -> Upper Strength 1
--   Athlete Day         -> Athlete Day (unchanged)
--   Impulse Day         -> Lower Body Power
--   Hypertrophy Day     -> Upper Strength 2
--   Energy System Day   -> Energy Systems
-- Renames labels on already-generated sessions, skeleton template labels and
-- stored drafts so a season doesn't show a mix of old and new names.
-- Idempotent: running it twice changes nothing the second time.
create or replace function _rename_day_types(input text) returns text
language sql immutable as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(input,
              'Lower Body Strength( Day)?', 'Lower Strength', 'gi'),
            'Upper Body Strength( Day)?', 'Upper Strength 1', 'gi'),
          'Impulse Day', 'Lower Body Power', 'gi'),
        'Hypertrophy Day', 'Upper Strength 2', 'gi'),
      'Energy System Day', 'Energy Systems', 'gi'),
    'Lower/Upper/Athlete/Impulse/Hypertrophy/Energy System', 'Lower 1/Upper 1/Athlete/Lower Power/Upper 2/Energy Systems', 'gi')
$$;

update scheduled_sessions
set day_label = _rename_day_types(day_label)
where day_label ~* '(lower body strength|upper body strength|impulse day|hypertrophy day|energy system day)';

update macrocycle_phases
set weekly_template_label = _rename_day_types(weekly_template_label)
where weekly_template_label ~* '(lower body strength|upper body strength|impulse|hypertrophy|energy system)';

-- Drafts keep their day_label strings inside the output JSON.
update program_drafts
set output = _rename_day_types(output::text)::jsonb
where output::text ~* '(lower body strength|upper body strength|impulse day|hypertrophy day|energy system day)';

drop function _rename_day_types(text);
