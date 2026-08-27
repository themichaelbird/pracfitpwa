-- Practical Fitness Coach Platform
-- v0.2: Exercise Setup screen removed in favor of configuring everything from
-- inside a live session; session creation decoupled from opening the session
-- view (Open -> prep freely -> Begin Session); machine settings restructured
-- to be keyed by machine rather than exercise (fixes the HP/MHP duplicate
-- settings problem); auxiliary assignment opened up to any exercise with a
-- coach-chosen movement classification; manually-added exercises supported.

-- ============================================================
-- Incline/OHP: a second, independently-selectable catalog row.
-- PRD 6.2 describes OHP and INC as interchangeable exercises sharing one
-- Type B slot, but only OHP existed in the seed data (0009_seed_exercises.sql)
-- -- there was no INC row to actually select. Same machine_name as OHP, so
-- the machine-keyed settings below (client_machine_settings) automatically
-- give them one shared settings card.
-- ============================================================

insert into exercises
  (name, abbreviation, exercise_type, default_movement_classification, is_fundamental, machine_name, body_section, muscle_group)
values
  ('Incline Press', 'INC', 'B', 'D', true, 'Incline/OHP Machine', 'Upper Body', 'Shoulders');

-- ============================================================
-- Machine settings, keyed by machine rather than exercise.
-- PRD (v0.2 req 8/14): the settings column order is fixed regardless of
-- exercise order, and MHP shares its settings with HP (same physical
-- machine) rather than duplicating a section. client_exercise_settings was
-- keyed by (client_id, exercise_id), which can't express "HP and MHP are the
-- same settings row" -- client_machine_settings keys by machine_name
-- instead. client_exercise_settings remains in place for auxiliary/
-- manually-added exercises whose machine isn't one of the fixed cards.
-- ============================================================

create table client_machine_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  machine_name text not null,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (client_id, machine_name)
);

alter table client_machine_settings enable row level security;

create policy client_machine_settings_all on client_machine_settings
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_machine_settings.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_machine_settings.client_id
        and c.location_id = auth_location_id()
    )
  );

-- settings_audit_log: machine-card edits (the common case now) don't have a
-- single owning exercise once HP/MHP and OHP/INC share one card, so
-- exercise_id becomes optional and machine_name is the primary identifier
-- going forward. Existing rows keep their exercise_id untouched.
alter table settings_audit_log
  add column machine_name text;

alter table settings_audit_log
  alter column exercise_id drop not null;

-- ============================================================
-- Auxiliary: any exercise, with a coach-chosen movement classification.
-- PRD (v0.2 req 15): movement classification is set when assigning the
-- auxiliary, not just inherited from the exercise's database default.
-- Backfill existing is_current rows from the exercise default so the column
-- can be NOT NULL going forward.
-- ============================================================

alter table auxiliary_config
  add column movement_classification movement_classification;

update auxiliary_config ac
set movement_classification = e.default_movement_classification
from exercises e
where e.id = ac.exercise_id
  and ac.movement_classification is null;

alter table auxiliary_config
  alter column movement_classification set not null;

-- ============================================================
-- Manually-added exercises (PRD v0.2 req 13: "Add More" in session view).
-- Fixed extra rows, always present, in the order added -- excluded from
-- Type B rotation logic (advance_client_rotation only touches exercise_type
-- = 'B' rows, so is_manually_added rows are naturally untouched by it; the
-- flag exists for the app-layer row-ordering logic in rotationEngine.js).
-- ============================================================

alter table client_exercise_order
  add column is_manually_added boolean not null default false;

alter table client_exercise_order
  add column added_at timestamptz not null default now();

-- ============================================================
-- Session type removed (PRD v0.2 req 7): replaced entirely by
-- clients.membership_package_type / membership_completion_date
-- (0002_schema.sql), which already live only on the client profile.
-- ============================================================

alter table sessions
  drop column session_type;

drop type session_type;

-- ============================================================
-- Floating general note (PRD v0.2 req 11): free-capture field, separate
-- from the four structured coach_notes fields, surfaced at session close.
-- ============================================================

alter table coach_notes
  add column general_note text;
