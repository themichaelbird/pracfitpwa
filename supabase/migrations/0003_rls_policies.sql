-- Practical Fitness Coach Platform
-- Week 1-2: Row Level Security -- Option B (confirmed 2026-07-16).
--
-- Auth model: there is NO 1:1 mapping between Supabase Auth identities and
-- coaches. Instead:
--   - One shared Supabase Auth account per location (4 total), each tied to
--     that location's iPad. Its app_metadata carries { role: 'location',
--     location_id: '<uuid>' }.
--   - One additional Supabase Auth account with app_metadata
--     { role: 'owner' } that bypasses location filtering entirely.
--   - The `users` table (coaches/managers/PINs) is a separate app-layer
--     roster. PIN entry identifies WHICH coach is acting, for attribution
--     (sessions.coach_id, *_by columns) -- it does not change which
--     Supabase Auth session or JWT is in effect.
--
-- Known gap (surfaced to Michael, accepted): PRD 6.9 says "Coach: scheduled
-- clients only" -- narrower than a location boundary. Under Option B, RLS
-- only enforces the location boundary at the DB level; restricting a coach
-- to their own scheduled clients (vs. all clients at that location) is an
-- app-layer query restriction only. Acceptable per PRD 9.3: the PWA is a
-- "learning and testing vehicle," not the production security boundary
-- (the native app is).
--
-- Manager mode is a toggle within the same shared login (manager code
-- checked app-side against `users`), so it does not need separate RLS
-- handling -- a manager and a coach at the same location share the same JWT
-- and therefore the same DB-level access.

create function auth_role() returns text
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create function auth_location_id() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'location_id', '')::uuid;
$$;

create function is_owner() returns boolean
language sql stable
as $$
  select auth_role() = 'owner';
$$;

alter table locations enable row level security;
alter table users enable row level security;
alter table clients enable row level security;
alter table exercises enable row level security;
alter table client_exercise_settings enable row level security;
alter table client_exercise_order enable row level security;
alter table auxiliary_config enable row level security;
alter table sessions enable row level security;
alter table session_exercise_logs enable row level security;
alter table original_baselines enable row level security;
alter table review_history enable row level security;
alter table review_decline_log enable row level security;
alter table body_measurements enable row level security;
alter table coach_notes enable row level security;
alter table pain_reports enable row level security;
alter table settings_audit_log enable row level security;
alter table color_code_log enable row level security;
alter table follow_up_flags enable row level security;
alter table auto_save_history enable row level security;

-- ============================================================
-- locations, users, exercises: not location-scoped.
-- Any authenticated location/owner account can read (a floating coach's
-- name list and the exercise database must work at any location's iPad).
-- Writes restricted to owner -- staffing and the exercise master log are
-- centrally managed (PRD 15.3: exercise identity changes corrupt history).
-- ============================================================

create policy locations_select on locations
  for select using (auth_role() in ('location', 'owner'));

create policy locations_write on locations
  for all using (is_owner()) with check (is_owner());

create policy users_select on users
  for select using (auth_role() in ('location', 'owner'));

create policy users_write on users
  for all using (is_owner()) with check (is_owner());

create policy exercises_select on exercises
  for select using (auth_role() in ('location', 'owner'));

create policy exercises_write on exercises
  for all using (is_owner()) with check (is_owner());

-- ============================================================
-- clients, sessions: direct location_id column.
-- ============================================================

create policy clients_select on clients
  for select using (is_owner() or location_id = auth_location_id());

create policy clients_insert on clients
  for insert with check (is_owner() or location_id = auth_location_id());

create policy clients_update on clients
  for update using (is_owner() or location_id = auth_location_id())
  with check (is_owner() or location_id = auth_location_id());

create policy sessions_select on sessions
  for select using (is_owner() or location_id = auth_location_id());

create policy sessions_insert on sessions
  for insert with check (is_owner() or location_id = auth_location_id());

create policy sessions_update on sessions
  for update using (is_owner() or location_id = auth_location_id())
  with check (is_owner() or location_id = auth_location_id());

-- ============================================================
-- Tables scoped via clients.location_id
-- ============================================================

create policy client_exercise_settings_all on client_exercise_settings
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_exercise_settings.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_exercise_settings.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy client_exercise_order_all on client_exercise_order
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_exercise_order.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = client_exercise_order.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy auxiliary_config_all on auxiliary_config
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = auxiliary_config.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = auxiliary_config.client_id
        and c.location_id = auth_location_id()
    )
  );

-- original_baselines / review_history: SELECT + INSERT only. UPDATE/DELETE
-- are already blocked unconditionally by the immutability triggers in
-- 0002_schema.sql, so no update policy is defined here.
create policy original_baselines_select on original_baselines
  for select using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = original_baselines.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy original_baselines_insert on original_baselines
  for insert with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = original_baselines.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy review_history_select on review_history
  for select using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = review_history.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy review_history_insert on review_history
  for insert with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = review_history.client_id
        and c.location_id = auth_location_id()
    )
  );

-- review_decline_log: no update/delete policy -- log entries are
-- write-once from the app's perspective.
create policy review_decline_log_select on review_decline_log
  for select using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = review_decline_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy review_decline_log_insert on review_decline_log
  for insert with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = review_decline_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy body_measurements_all on body_measurements
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = body_measurements.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = body_measurements.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy settings_audit_log_select on settings_audit_log
  for select using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = settings_audit_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy settings_audit_log_insert on settings_audit_log
  for insert with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = settings_audit_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy color_code_log_select on color_code_log
  for select using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = color_code_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy color_code_log_insert on color_code_log
  for insert with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = color_code_log.client_id
        and c.location_id = auth_location_id()
    )
  );

create policy follow_up_flags_all on follow_up_flags
  for all using (
    is_owner() or exists (
      select 1 from clients c
      where c.id = follow_up_flags.client_id
        and c.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from clients c
      where c.id = follow_up_flags.client_id
        and c.location_id = auth_location_id()
    )
  );

-- ============================================================
-- Tables scoped via sessions.location_id
-- ============================================================

create policy session_exercise_logs_all on session_exercise_logs
  for all using (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = session_exercise_logs.session_id
        and s.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = session_exercise_logs.session_id
        and s.location_id = auth_location_id()
    )
  );

create policy coach_notes_all on coach_notes
  for all using (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = coach_notes.session_id
        and s.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = coach_notes.session_id
        and s.location_id = auth_location_id()
    )
  );

create policy pain_reports_all on pain_reports
  for all using (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = pain_reports.session_id
        and s.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = pain_reports.session_id
        and s.location_id = auth_location_id()
    )
  );

create policy auto_save_history_all on auto_save_history
  for all using (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = auto_save_history.session_id
        and s.location_id = auth_location_id()
    )
  )
  with check (
    is_owner() or exists (
      select 1 from sessions s
      where s.id = auto_save_history.session_id
        and s.location_id = auth_location_id()
    )
  );
