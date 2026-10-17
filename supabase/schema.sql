-- Run this once in the Supabase dashboard: SQL Editor > New query > Run.

create extension if not exists "pgcrypto";

create table if not exists public.alerts (
  id               uuid primary key default gen_random_uuid(),
  api_name         text not null,
  severity         text not null check (severity in ('low','medium','high','critical')),
  anomaly_types    text[] not null,
  anomaly_key      text not null,              -- sorted anomaly types joined with "+"
  message          text not null,              -- human-readable alert (LLM or rule-based)
  ai_generated     boolean not null default false,
  status_code      integer,
  response_time_ms numeric,
  records_returned integer,
  details          jsonb not null default '[]'::jsonb,
  status           text not null default 'active' check (status in ('active','resolved')),
  occurrence_count integer not null default 1,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  resolved_at      timestamptz
);

-- At most one ACTIVE alert per API and issue. Repeats bump occurrence_count instead.
create unique index if not exists alerts_one_active_per_issue
  on public.alerts (api_name, anomaly_key) where status = 'active';

create index if not exists alerts_status_last_seen_idx
  on public.alerts (status, last_seen_at desc);

-- The backend uses the service_role key, which bypasses RLS.
-- With RLS on and no policies, the public anon key cannot read or write this table.
alter table public.alerts enable row level security;
