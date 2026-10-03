-- Testing feedback: athletes want to manually schedule more than one
-- workout on the same calendar day (e.g. a makeup session alongside the
-- day's regular one). scheduled_sessions has had a hard
-- unique (athlete_id, date) constraint since 0001_init.sql, which blocked
-- that outright — any INSERT/UPDATE landing a second session on a date
-- already taken (including a drag-and-drop reschedule onto an occupied day)
-- failed at the database level, regardless of what the app's own code
-- allowed.
--
-- The app has never relied on "at most one session per athlete per day"
-- for correctness elsewhere (sessions are always looked up/joined by their
-- own id, and the schedule views already group by date into a list), so
-- dropping this is safe. The old supporting index stays — multiple rows per
-- date is now a normal case it should still serve well.

alter table scheduled_sessions
  drop constraint scheduled_sessions_athlete_id_date_key;
