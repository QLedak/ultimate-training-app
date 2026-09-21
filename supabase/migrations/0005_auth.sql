-- Adds real authentication (Supabase Auth, email+password) — Pass 1 of the
-- two-pass authorization plan. This migration just adds the identity
-- linkage; it does NOT enable Row Level Security. Every API route still
-- reads/writes through the service-role key (lib/db/supabase-admin.ts),
-- which bypasses RLS entirely, so RLS policies here would give a false
-- sense of security until Pass 2 also locks down the API routes themselves
-- to check the caller's identity against the data they're asking for.
-- Enabling RLS as defense-in-depth is a reasonable Pass 2/3 addition once
-- that's done, not before.
--
-- Run this in the Supabase SQL editor after the prior migrations.

-- One row per coach account. Single-coach project today (per existing
-- comments on program_drafts.reviewed_by), but modeled as a table rather
-- than a hardcoded check so a second coach is just another row later.
create table coaches (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  created_at timestamptz not null default now()
);

-- Links an existing athletes row to its real login. Nullable: an athlete
-- created before this migration (or via any future non-signup path) simply
-- has no login yet, and can't sign into /app/log until this gets set.
alter table athletes
  add column auth_user_id uuid unique references auth.users(id) on delete set null;
