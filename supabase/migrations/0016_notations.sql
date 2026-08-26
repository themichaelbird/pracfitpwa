-- Practical Fitness Coach Platform
-- v0.1: exercise cell notation system. Layout, left to right, in the
-- exercise cell (spec from the v0.1 feature request, not yet in the PRD):
--   [time OR circled eccentric reps] -> [DIS] -> [effort notations] -> [outcome notation]
--
-- Extensibility requirement: "new notations should be addable without a
-- full rebuild." `notations` is a config table the app reads at session
-- load (select * from notations where is_active order by category,
-- sort_order) -- adding, relabeling, or deactivating a notation is a plain
-- SQL insert/update against this table, no app code change. Config writes
-- are owner-only via RLS below (same pattern as `exercises`); there is no
-- in-app CRUD screen for this table in v0.1 -- new rows are added via SQL
-- Editor/CLI, same as exercises were seeded in 0009.
create table notations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('flag', 'effort', 'outcome')),
  label text not null,
  symbol text not null,
  -- Effort notations stack (+1E, +2E, +3E...); flag/outcome notations don't.
  is_countable boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per applied notation per log. `count` is only meaningful when
-- is_countable is true (the effort stack); DIS and the outcome chip are
-- always count = 1, present or absent. A log can hold at most one row per
-- notation (re-tapping an effort notation updates count in place rather
-- than inserting a second row); the app is responsible for keeping the
-- outcome category single-selected (delete-then-insert on change), same as
-- it's already responsible for session_exercise_logs' own field shape.
create table session_exercise_log_notations (
  id uuid primary key default gen_random_uuid(),
  session_exercise_log_id uuid not null references session_exercise_logs (id),
  notation_id uuid not null references notations (id),
  count integer not null default 1,
  created_at timestamptz not null default now(),
  unique (session_exercise_log_id, notation_id)
);

create index session_exercise_log_notations_log_id_idx
  on session_exercise_log_notations (session_exercise_log_id);

alter table notations enable row level security;
alter table session_exercise_log_notations enable row level security;

-- Not location-scoped, same as `exercises` (exercises_select/exercises_write
-- in 0003_rls_policies.sql): any authenticated location/owner account reads
-- the full catalog; only the owner account can write config rows.
create policy notations_select on notations
  for select using (auth_role() in ('location', 'owner'));

create policy notations_write on notations
  for all using (is_owner()) with check (is_owner());

-- Scoped via session_exercise_logs -> sessions.location_id, same nested
-- pattern as session_exercise_logs_all itself (0003_rls_policies.sql), one
-- join level deeper.
create policy session_exercise_log_notations_all on session_exercise_log_notations
  for all using (
    is_owner() or exists (
      select 1 from session_exercise_logs l
      join sessions s on s.id = l.session_id
      where l.id = session_exercise_log_notations.session_exercise_log_id
        and s.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from session_exercise_logs l
      join sessions s on s.id = l.session_id
      where l.id = session_exercise_log_notations.session_exercise_log_id
        and s.location_id = auth_location_id()
    )
  );

-- Seed rows for the notations named in the v0.1 spec.
insert into notations (code, category, label, symbol, is_countable, sort_order) values
  ('DIS', 'flag', 'Disengaged mid-set', 'DIS', false, 0),
  ('EFFORT_E', 'effort', 'Additional eccentric effort', 'E', true, 0),
  ('EFFORT_M', 'effort', 'Additional metabolic effort', 'M', true, 1),
  ('OK', 'outcome', 'Weight OK, no progression', 'ⓞⓚ', false, 0),
  ('OK_SP', 'outcome', 'Weight OK, slow progress', 'ⓞⓚ SP', false, 1),
  ('F', 'outcome', 'Client failed before completing', 'F', false, 2),
  ('NA', 'outcome', 'Ignore this weight -- one-time anomaly', 'NA', false, 3);
