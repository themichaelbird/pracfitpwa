-- Practical Fitness Coach Platform
-- Coach session/profile UI-UX pass, follow-up: two independent fixes bundled
-- in one migration since both touch rotation/exercise-order mechanics.

-- Req #6: Type D swap gets the same "Make permanent" path as the movement
-- classification picker (0019_movement_classification_permanent_change.sql)
-- -- session-only by default, or also updates the client's stored default
-- exercise for that slot when checked. This column distinguishes the two
-- paths in the log itself, since swap_reason alone can't tell them apart.
alter table session_exercise_logs
  add column swap_permanent_change boolean not null default false;

-- Req #5: advance_client_rotation (0013_rotation_and_review_gate.sql)
-- incremented every active Type B row's rotation_index by +1 mod 4, which
-- rotates the sortSessionRows display order (ascending rotation_index)
-- backwards -- the exercise in the LAST slot moves to the FIRST slot, and
-- everything else shifts back one, rather than the intended "first exercise
-- has had its turn, moves to the back" forward rotation. Decrementing (mod 4,
-- offset by +3 to keep the result non-negative in Postgres) reverses the
-- traversal direction: the first exercise now moves to the last slot and
-- everything else shifts up by one. Same function signature/grants, so no
-- caller changes needed.
create or replace function advance_client_rotation(p_client_id uuid) returns void
language plpgsql
as $$
declare
  v_slots text[];
  v_current text;
  v_current_idx int;
begin
  update client_exercise_order
  set rotation_index = (rotation_index + 3) % 4
  where client_id = p_client_id
    and is_active
    and exercise_id in (
      select id from exercises where exercise_type = 'B'
    );

  select array_agg(distinct slot order by slot)
  into v_slots
  from auxiliary_config
  where client_id = p_client_id
    and is_current;

  if v_slots is not null and array_length(v_slots, 1) > 0 then
    select auxiliary_active_slot into v_current from clients where id = p_client_id;

    if v_current is null then
      update clients set auxiliary_active_slot = v_slots[1] where id = p_client_id;
    else
      v_current_idx := array_position(v_slots, v_current);
      if v_current_idx is null then
        update clients set auxiliary_active_slot = v_slots[1] where id = p_client_id;
      else
        update clients
        set auxiliary_active_slot = v_slots[(v_current_idx % array_length(v_slots, 1)) + 1]
        where id = p_client_id;
      end if;
    end if;
  end if;
end;
$$;
