-- 0018: one-off purchasable programs.
--
-- A product is a FIXED program (e.g. the 12-week "Accelerate" speed program).
-- Buying one copies its sessions into the buyer's scheduled_sessions (tagged
-- with the purchase), so the existing log screens, rest timers, swaps and
-- history work unchanged. Purchased sessions are fenced off from the
-- subscription machinery: they have no phase and no source draft, and every
-- phase/draft query already filters by phase_id (see also the purchase_id
-- IS NULL guards added in lib/review/materialize.ts and season-bridge.ts).

create table if not exists products (
  id text primary key,                    -- e.g. 'accelerate-12wk'
  title text not null,
  description text,
  days_per_week integer not null,
  week_count integer not null,
  level text,
  price_cents integer not null default 0,
  currency text not null default 'usd',
  equipment jsonb not null default '[]',  -- required equipment tags (shown on the sales page)
  space text,
  suggested_schedule text,
  tests jsonb not null default '[]',      -- [{key,label,unit,weeks:[1,12]}]
  stripe_price_id text,                   -- filled in when payments go live
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_sessions (
  id uuid primary key default uuid_generate_v4(),
  product_id text not null references products(id) on delete cascade,
  week_number integer not null,
  day_index integer not null,             -- 1..days_per_week, order within the week
  day_label text not null,
  week_type text not null check (week_type in ('build','deload','test')),
  prescribed_exercises jsonb not null,
  unique (product_id, week_number, day_index)
);

create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  product_id text not null references products(id),
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  provider text,                          -- 'free' (pre-launch) | 'stripe'
  provider_session_id text,
  start_date date,
  weekdays jsonb,                         -- chosen training weekdays (0=Sun..6=Sat), e.g. [1,2,4,6]
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists purchases_athlete_idx on purchases (athlete_id);
-- One paid purchase per athlete per product (re-buying is blocked at the API;
-- this makes the webhook idempotent too).
create unique index if not exists purchases_one_paid_per_product
  on purchases (athlete_id, product_id) where status = 'paid';

create table if not exists purchase_test_results (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  test_key text not null,
  week_number integer not null,
  value numeric not null,
  recorded_at timestamptz not null default now(),
  unique (purchase_id, test_key, week_number)
);

-- Purchased sessions: no phase, no draft, tagged with the purchase.
alter table scheduled_sessions
  alter column phase_id drop not null,
  alter column source_draft_id drop not null,
  add column if not exists purchase_id uuid references purchases(id) on delete cascade;
create index if not exists scheduled_sessions_purchase_idx on scheduled_sessions (purchase_id);

alter table products enable row level security;
alter table product_sessions enable row level security;
alter table purchases enable row level security;
alter table purchase_test_results enable row level security;
