-- Lets an athlete request a change to their training days/week and have the
-- coach approve or decline it, instead of the days/week change only being
-- possible via a coach manually editing the database. Modeled the same way
-- as every other athlete-initiated change in this app (schedule edits,
-- rebuild requests): the athlete's ask is recorded and reviewable, nothing
-- reaches the athlete's actual plan until a coach acts on it.
--
-- One row per request. `current_days_per_week` is snapshotted at request
-- time purely for the coach's own context on the review card (so they see
-- "4 -> 6" at a glance) -- it plays no role in resolving the request.

create table athlete_days_change_requests (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,

  current_days_per_week integer not null,
  requested_days_per_week integer not null check (requested_days_per_week between 2 and 6),
  note text, -- athlete's own reason, shown to the coach

  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),

  resolved_at timestamptz,
  resolved_by uuid references coaches(id) on delete set null,
  coach_note text
);

-- The app enforces "at most one pending request per athlete" itself (same
-- pattern as the single-priority-tournament check in the schedule route)
-- rather than a partial unique index, so a coach can freely decline and let
-- the athlete resubmit without any special-casing here.
create index idx_athlete_days_change_requests_athlete on athlete_days_change_requests (athlete_id);
create index idx_athlete_days_change_requests_status on athlete_days_change_requests (status);

alter table athlete_days_change_requests enable row level security;
