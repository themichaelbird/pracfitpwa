-- Practical Fitness Coach Platform
-- Week 10: permanent storage for generated daily recaps (PRD 6.7/15.1:
-- "Historical recap storage -- All recaps stored permanently -- P0"). No
-- table for this existed in the confirmed 19-entity list (0002_schema.sql)
-- -- recap generation itself is a pure read from sessions/coach_notes/
-- follow_up_flags, so this is the only new table Week 10 needs.
--
-- follow_up_flags and body_measurements already have full schema + RLS
-- from Week 1-2 (0002_schema.sql, 0003_rls_policies.sql) -- this migration
-- only adds what's new.

create table daily_recaps (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id),
  generated_by uuid not null references users (id),
  recap_date date not null,
  block text not null check (block in ('AM', 'PM')),
  recap_text text not null,
  created_at timestamptz not null default now()
);

create index daily_recaps_location_date_idx
  on daily_recaps (location_id, recap_date desc);

alter table daily_recaps enable row level security;

-- Same location-scoping pattern as sessions_select/sessions_insert
-- (0003_rls_policies.sql) -- direct location_id column, no join needed.
create policy daily_recaps_select on daily_recaps
  for select using (is_owner() or location_id = auth_location_id());

create policy daily_recaps_insert on daily_recaps
  for insert with check (is_owner() or location_id = auth_location_id());
