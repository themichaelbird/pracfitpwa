-- Practical Fitness Coach Platform
-- Coach session follow-up, item 4: per-client Hip Press (R)/(L) split.
-- Supersedes the generic session-scoped "side" field originally planned for
-- unilateral tracking -- instead, a coach can convert a client's standing HP
-- slot into the already-seeded HP(R)/HP(L) exercises (0009_seed_exercises.sql,
-- previously unused). HP(R)/HP(L) stay exercise_type = 'C' in the catalog for
-- every client; "acts like Type A" (fixed, always-present, not part of Type B
-- rotation) is achieved entirely client-side, per client, via
-- rotationEngine.js and advance_client_rotation's existing exercise_type='B'
-- scoping (see useSessionCore.js/rotationEngine.js for the positioning and
-- 0020_swap_permanent_change_and_rotation_direction.sql for the rotation
-- function this deliberately does NOT touch).

alter table clients
  add column hip_press_split_active boolean not null default false,
  add column hip_press_split_lead_side text check (hip_press_split_lead_side in ('R', 'L')),
  add column hip_press_split_frozen boolean not null default false,
  add column hip_press_split_layout text not null default 'alternating'
    check (hip_press_split_layout in ('alternating', 'adjacent')),
  add column hip_press_split_shared_settings boolean not null default true;

alter table clients
  add constraint clients_hip_press_split_lead_side_chk check (
    not hip_press_split_active or hip_press_split_lead_side is not null
  );

-- Which side leads (occupies the earlier of the two slots) alternates
-- session to session -- called from the same closeSession gate that calls
-- advance_client_rotation (completed sessions only, no-show/late-cancel
-- hold it, same as Type B) and also from the manual Shuffle button. A
-- deliberately separate function/state from advance_client_rotation's
-- rotation_index -- Type B rotation and this alternation must never be
-- conflated. A coach can freeze hip_press_split_frozen to lock the current
-- lead side; while frozen, this is a no-op.
create function advance_hip_press_split_lead(p_client_id uuid) returns void
language plpgsql
as $$
begin
  update clients
  set hip_press_split_lead_side = case hip_press_split_lead_side when 'R' then 'L' else 'R' end
  where id = p_client_id
    and hip_press_split_active
    and not hip_press_split_frozen;
end;
$$;

grant execute on function advance_hip_press_split_lead(uuid) to authenticated;

-- Follow-up fix: split/revert used to be plain client-side upserts, which
-- meant re-splitting after a revert always reset HP(R)/HP(L) back to their
-- catalog default movement_classification, silently discarding whatever a
-- coach had customized before the revert (per-side settings were never
-- affected either way -- client_exercise_settings is untouched by any of
-- this). These two functions fix that: the ON CONFLICT path only flips
-- is_active/is_manually_added back on and never touches
-- movement_classification/is_second_push_pull/second_push_pull_weight_offset,
-- so a reactivated row comes back exactly as it was left. Doing this as one
-- atomic RPC (like advance_client_rotation/advance_hip_press_split_lead
-- above) also keeps it offline-queue-safe -- a client-side "check if a row
-- already exists, then decide insert vs. update" would need a live read the
-- offline outbox can't express.
create function split_hip_press(p_client_id uuid) returns void
language plpgsql
as $$
declare
  v_hp_id uuid;
  v_hp_right_id uuid;
  v_hp_left_id uuid;
begin
  select id into v_hp_id from exercises where abbreviation = 'HP';
  select id into v_hp_right_id from exercises where abbreviation = 'HP(R)';
  select id into v_hp_left_id from exercises where abbreviation = 'HP(L)';

  update client_exercise_order
  set is_active = false
  where client_id = p_client_id and exercise_id = v_hp_id;

  insert into client_exercise_order
    (client_id, exercise_id, rotation_index, movement_classification, is_active, is_manually_added, added_at)
  select p_client_id, v_hp_right_id, 0, e.default_movement_classification, true, true, now()
  from exercises e where e.id = v_hp_right_id
  on conflict (client_id, exercise_id)
  do update set is_active = true, is_manually_added = true;

  insert into client_exercise_order
    (client_id, exercise_id, rotation_index, movement_classification, is_active, is_manually_added, added_at)
  select p_client_id, v_hp_left_id, 0, e.default_movement_classification, true, true, now()
  from exercises e where e.id = v_hp_left_id
  on conflict (client_id, exercise_id)
  do update set is_active = true, is_manually_added = true;

  update clients
  set hip_press_split_active = true,
      hip_press_split_lead_side = coalesce(hip_press_split_lead_side, 'R')
  where id = p_client_id;
end;
$$;

grant execute on function split_hip_press(uuid) to authenticated;

-- Reverses split_hip_press. HP(R)/HP(L) are deactivated, not deleted --
-- their movement_classification/is_second_push_pull/weight_offset stay
-- exactly as they were, ready for split_hip_press's ON CONFLICT path to
-- restore them verbatim on a later re-split. Any session_exercise_logs
-- history already recorded against them is a different table entirely and
-- is never touched here.
create function revert_hip_press(p_client_id uuid) returns void
language plpgsql
as $$
declare
  v_hp_id uuid;
  v_hp_right_id uuid;
  v_hp_left_id uuid;
begin
  select id into v_hp_id from exercises where abbreviation = 'HP';
  select id into v_hp_right_id from exercises where abbreviation = 'HP(R)';
  select id into v_hp_left_id from exercises where abbreviation = 'HP(L)';

  update client_exercise_order
  set is_active = false
  where client_id = p_client_id and exercise_id in (v_hp_right_id, v_hp_left_id);

  update client_exercise_order
  set is_active = true
  where client_id = p_client_id and exercise_id = v_hp_id;

  update clients
  set hip_press_split_active = false
  where id = p_client_id;
end;
$$;

grant execute on function revert_hip_press(uuid) to authenticated;
