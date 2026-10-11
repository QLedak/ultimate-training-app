-- 0019: phone push notification tokens (Expo push). One row per device token.
-- A token that moves to another account on the same phone is re-pointed (token is unique).
create table if not exists push_tokens (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_tokens_athlete on push_tokens(athlete_id);
alter table push_tokens enable row level security;
