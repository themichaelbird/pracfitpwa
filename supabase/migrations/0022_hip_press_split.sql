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
