-- Season transitions (year-over-year): seasons table, bridge (rolling off-season) phases,
-- completed-season review. Safe to re-run.

-- ---------------------------------------------------------------- seasons
create table if not exists seasons (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  label text not null,
  season_start date,
  season_end date,
  recurring_commitments jsonb not null default '[]',
  tournament_weekends jsonb not null default '[]',
  calendar_confirmed boolean not null default false,
  status text not null default 'planned' check (status in ('planned','active','completed')),
  -- Intake-level changes the athlete asked for alongside next season's dates
  -- (training_days_per_week, goals). Applied when that season's plan is approved.
  intake_changes jsonb not null default '{}',
  skeleton_id uuid references macrocycle_skeletons(id) on delete set null,
  -- phase_number (within skeleton_id) of this season's first phase; set when its plan is approved.
  first_phase_number integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists seasons_athlete_idx on seasons (athlete_id, status);
alter table seasons enable row level security;

-- Backfill: one season per athlete from their latest intake calendar.
insert into seasons (athlete_id, label, season_start, season_end, recurring_commitments,
                     tournament_weekends, calendar_confirmed, status)
select i.athlete_id,
       coalesce(extract(year from i.season_start)::text, extract(year from now())::text),
       i.season_start, i.season_end, i.recurring_commitments, i.tournament_weekends,
       i.season_calendar_confirmed, 'active'
from (
  select distinct on (athlete_id) *
  from athlete_intake
  order by athlete_id, submitted_at desc
) i
where not exists (select 1 from seasons s where s.athlete_id = i.athlete_id);

-- ---------------------------------------------------------------- skeletons / phases
-- Bridge skeletons are built by the app (no planner draft behind them).
alter table macrocycle_skeletons alter column source_draft_id drop not null;
alter table macrocycle_skeletons add column if not exists season_id uuid references seasons(id) on delete set null;
alter table macrocycle_skeletons add column if not exists status text not null default 'active'
  check (status in ('active','completed','superseded'));
alter table macrocycle_skeletons add column if not exists completed_at timestamptz;
alter table macrocycle_skeletons add column if not exists is_bridge boolean not null default false;
update macrocycle_skeletons set status = 'superseded' where is_active = false and status = 'active';

alter table macrocycle_phases add column if not exists is_bridge boolean not null default false;

-- Link the backfilled active season to each athlete's active skeleton.
update macrocycle_skeletons k
set season_id = s.id
from seasons s
where k.athlete_id = s.athlete_id and s.status = 'active' and k.is_active and k.season_id is null;

-- ---------------------------------------------------------------- season reviews
create table if not exists season_reviews (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  season_id uuid references seasons(id) on delete set null,
  skeleton_id uuid references macrocycle_skeletons(id) on delete set null,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists season_reviews_athlete_idx on season_reviews (athlete_id, created_at desc);
alter table season_reviews enable row level security;
