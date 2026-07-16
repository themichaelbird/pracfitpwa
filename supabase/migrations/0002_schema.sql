-- Practical Fitness Coach Platform
-- Week 1-2: core schema. 19 tables from PRD Section 8.1 / Appendix A.
--
-- Naming: snake_case throughout (confirmed).
--
-- Flagged assumptions (not explicit in the PRD, called out per standing
-- preference to distinguish fact / inference / assumption):
--   1. client_exercise_settings.settings is jsonb rather than fully
--      normalized columns, since fields vary by machine type (PRD 6.5).
--   2. client_exercise_order is one row per client-per-exercise, tracking
--      rotation index individually (behavior described in 8.3, not literal
--      columns).
--   3. clients.location_id is a single FK (one primary/home location).
--      PRD 8.1 lists "location(s)" plural for Clients, but the confirmed
--      19-table list has no client_locations join table. Revisit if a
--      client is genuinely trained out of more than one location.
--   4. exercises has no location_id. PRD Appendix B notes other locations'
--      exercise lists are a separate open gap (machine settings may vary)
--      -- not modeled yet, since Westlake is the only list in scope.

-- ============================================================
-- Core
-- ============================================================

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- Coaches / managers / owner. This is an app-layer roster, NOT a 1:1 mapping
-- to Supabase Auth identities -- see 0003_rls_policies.sql for the Option B
-- auth model (shared per-location Supabase Auth login; PIN is attribution
-- only, checked against pin_hash after that shared login already succeeded).
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role user_role not null,
  pin_hash text not null,
  home_location_id uuid references locations (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index users_home_location_id_idx on users (home_location_id);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date_of_birth date not null,
  sex text,
  height text,
  location_id uuid not null references locations (id),
  color_code color_code not null default 'E',
  is_minor boolean not null default false,
  parental_contact text,
  music_preference text,
  fan_preference text,
  physical_limitations text,
  personal_details text,
  customization_notes text,
  goal_tags text[] not null default '{}',
  goal_notes text,
  membership_package_type text,
  membership_completion_date date,
  is_special_rotation boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index clients_location_id_idx on clients (location_id);
create index clients_name_idx on clients using gin (name gin_trgm_ops);

-- ============================================================
-- Exercise system
-- ============================================================

-- Structure only -- DO NOT seed rows. PRD Appendix A/B: canonical exercise
-- list (names, abbreviations, default movement classification) is a hard
-- blocker for Week 1-2 seeding, pending Michael's master log.
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text not null,
  exercise_type exercise_type not null,
  default_movement_classification movement_classification not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table client_exercise_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  exercise_id uuid not null references exercises (id),
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (client_id, exercise_id)
);

-- One row per client-per-exercise; rotation_index tracks Type B position
-- (0-3 across the 4-session cycle) and movement_classification is the
-- client's current standing default (initialized from the exercise default
-- at consultation, coach-updatable going forward per PRD 21.2).
create table client_exercise_order (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  exercise_id uuid not null references exercises (id),
  rotation_index integer not null default 0,
  movement_classification movement_classification not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (client_id, exercise_id)
);

-- Type C auxiliary A/B/C slot assignments. History retained: reverting
-- replaces the current config going forward (Appendix C), so past rows are
-- kept with is_current = false rather than deleted.
create table auxiliary_config (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  slot text not null check (slot in ('A', 'B', 'C')),
  exercise_id uuid not null references exercises (id),
  is_current boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);

create index auxiliary_config_client_current_idx
  on auxiliary_config (client_id, slot)
  where is_current;

-- ============================================================
-- Sessions
-- ============================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  coach_id uuid not null references users (id),
  location_id uuid not null references locations (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status session_status not null default 'completed',
  set_type set_type not null,
  pin_override_used boolean not null default false,
  next_session_booked boolean,
  is_six_session_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index sessions_client_id_idx on sessions (client_id);
create index sessions_location_id_idx on sessions (location_id);
create index sessions_coach_id_idx on sessions (coach_id);

-- One row per exercise per session. failure_time is mandatory (PRD 8.4:
-- gates cell advance in the UI) -- modeled NOT NULL since a session_exercise_logs
-- row is only ever written once the coach has logged failure time.
create table session_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  exercise_id uuid not null references exercises (id),
  original_exercise_id uuid references exercises (id),
  swap_reason text,
  weight decimal(6, 2),
  movement_classification movement_classification not null,
  movement_classification_override boolean not null default false,
  set_type_override boolean not null default false,
  set_type_override_value set_type,
  stopwatch_elapsed integer,
  failure_time integer not null,
  failure_time_source failure_time_source not null,
  progression text check (progression in ('up', 'down', 'hold')),
  progression_amount decimal(6, 2),
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index session_exercise_logs_session_id_idx
  on session_exercise_logs (session_id);

-- ============================================================
-- Baselines & review
-- ============================================================

-- Founding muscle-failure weight per client-per-exercise. Locked
-- permanently at initial consultation -- see immutability trigger below.
create table original_baselines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  exercise_id uuid not null references exercises (id),
  movement_classification movement_classification not null,
  weight decimal(6, 2) not null,
  failure_time integer,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references users (id),
  unique (client_id, exercise_id)
);

-- Append-only: one entry per 6-session cycle, plus 2-month-absence
-- baselines (review_type = 'absence_return'). Never overwrites
-- original_baselines. See immutability trigger below.
create table review_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  exercise_id uuid not null references exercises (id),
  session_id uuid references sessions (id),
  review_type text not null check (review_type in ('six_session', 'absence_return')),
  weight decimal(6, 2) not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references users (id)
);

create index review_history_client_exercise_idx
  on review_history (client_id, exercise_id);

create table review_decline_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  session_id uuid not null references sessions (id),
  coach_id uuid not null references users (id),
  decline_reason review_decline_reason not null,
  decline_reason_other text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Body & notes
-- ============================================================

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  measured_at date not null default current_date,
  weight decimal(6, 2),
  body_fat_pct decimal(5, 2),
  waist decimal(6, 2),
  recorded_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index body_measurements_client_id_idx on body_measurements (client_id);

-- Four structured fields per PRD 5.6 / 6.3. One row per session.
create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) unique,
  execution_notes text,
  physical_notes text,
  machine_changes_notes text,
  personal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pain_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  body_area text not null,
  severity integer not null check (severity between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index pain_reports_session_id_idx on pain_reports (session_id);

-- ============================================================
-- Audit & ops
-- ============================================================

create table settings_audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  exercise_id uuid not null references exercises (id),
  changed_by uuid not null references users (id),
  previous_settings jsonb,
  new_settings jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table color_code_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  changed_by uuid not null references users (id),
  previous_color_code color_code,
  new_color_code color_code not null,
  created_at timestamptz not null default now()
);

create table follow_up_flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  session_id uuid references sessions (id),
  flagged_by uuid not null references users (id),
  reason text not null,
  resolved boolean not null default false,
  resolved_by uuid references users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index follow_up_flags_unresolved_idx
  on follow_up_flags (client_id)
  where not resolved;

create table auto_save_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  field_name text not null,
  previous_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index auto_save_history_session_id_idx on auto_save_history (session_id);

-- ============================================================
-- Immutability: PRD 6.4 / Appendix A -- ORIGINAL baseline is "Never" editable
-- once set; ReviewHistory is append-only. Enforced at the DB level, not just
-- app-layer, since corrupting this data is explicitly called out (15.3) as
-- permanent and unrecoverable.
-- ============================================================

create function prevent_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception '% is immutable / append-only and cannot be updated or deleted', TG_TABLE_NAME;
end;
$$;

create trigger original_baselines_immutable
  before update or delete on original_baselines
  for each row execute function prevent_update_delete();

create trigger review_history_append_only
  before update or delete on review_history
  for each row execute function prevent_update_delete();
