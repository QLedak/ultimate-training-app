-- Trap Bar is now its own equipment option (previously folded into barbell_rack,
-- so every athlete with a barbell was offered trap bar lifts). Run this BEFORE
-- deploying the matching code, then run `npm run seed` to reload the library
-- (Trap Bar Deadlift HG-001 and Trap Bar Jump PJ-029 now need `trap_bar`).
--
-- Backfill (coach decision): athletes who have a barbell + rack keep access to
-- trap bar lifts by getting `trap_bar` added to their equipment, so nothing
-- changes for them until they edit it on the new /app/equipment page.
update current_athlete_state
set equipment = equipment || '["trap_bar"]'::jsonb
where equipment ? 'barbell_rack'
  and not (equipment ? 'trap_bar');

update athlete_intake
set equipment = equipment || '["trap_bar"]'::jsonb
where equipment ? 'barbell_rack'
  and not (equipment ? 'trap_bar');
