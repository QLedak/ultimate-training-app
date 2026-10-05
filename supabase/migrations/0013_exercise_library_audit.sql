-- Exercise library audit (Oct 2026). Run this BEFORE deploying the matching
-- code, then run `npm run seed` to load the corrected library data.
--
--  * equipment_all: items an athlete must ALSO have (e.g. Dumbbell Bench Press
--    = any-of [dumbbells] + all-of [bench]). equipment_needed stays the
--    ANY-OF list. Previously both meanings were flattened into one any-of list.
--  * is_active: false = retired. Retired rows stay in the table so old
--    sessions and logged history still resolve, but are never prescribed by
--    the Phase Builder or offered in the swap dropdown. Replaces deleting.
alter table exercise_library
  add column equipment_all jsonb not null default '[]',
  add column is_active boolean not null default true;
