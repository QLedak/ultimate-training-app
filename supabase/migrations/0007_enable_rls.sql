-- Enables Row Level Security on every application table, as defense-in-depth
-- against direct access to Supabase's REST API using the public anon key.
--
-- Why this matters even though every API route already checks auth
-- (lib/auth/session.ts, Pass 1/2): the anon key is PUBLIC by design — it
-- ships in the browser bundle (NEXT_PUBLIC_SUPABASE_ANON_KEY) so the app can
-- sign people in. With RLS disabled (the state every table has been in since
-- 0001_init.sql — see the note in 0005_auth.sql), Supabase's PostgREST layer
-- exposes every table straight over HTTP to anyone holding that key, or even
-- an anonymous request, completely independent of the Next.js app and its
-- auth checks. In practice: right now, anyone could query
-- https://<project>.supabase.co/rest/v1/athlete_intake directly and read
-- every athlete's injury history, without ever touching this app's code.
--
-- The fix here is deliberately the simplest one that's still correct:
-- enable RLS on every table and add NO policies for anon/authenticated.
-- With RLS on and zero policies, those two roles can do nothing at all —
-- every table is fully closed off from direct REST access. This doesn't
-- change how the app behaves even slightly, because every API route already
-- reads/writes exclusively through getSupabaseAdmin() (lib/db/supabase-admin.ts),
-- which uses the SERVICE ROLE key — service role always bypasses RLS, by
-- Postgres/Supabase design, regardless of what policies exist. So this
-- migration only closes the direct-REST-access hole; the app's own data
-- access is completely unaffected.
--
-- If a future feature needs the browser to query Supabase directly (e.g. a
-- realtime subscription) rather than going through a Next.js API route,
-- that table will need real per-row policies at that point (e.g. "an
-- athlete can select rows where athlete_id = auth.uid()'s linked athlete").
-- Until then, deny-all is strictly safer than any policy that might be
-- gotten subtly wrong.

alter table athletes enable row level security;
alter table athlete_intake enable row level security;
alter table athlete_injury_reports enable row level security;
alter table athlete_catchall_restrictions enable row level security;
alter table current_athlete_state enable row level security;
alter table macrocycle_skeletons enable row level security;
alter table macrocycle_phases enable row level security;
alter table phase_performance_summaries enable row level security;
alter table program_drafts enable row level security;
alter table review_thread_entries enable row level security;
alter table corpus_entries enable row level security;
alter table scheduled_sessions enable row level security;
alter table session_logs enable row level security;
alter table logged_exercises enable row level security;
alter table testing_day_results enable row level security;
alter table bodyweight_entries enable row level security;
alter table exercise_library enable row level security;
alter table coaches enable row level security;
