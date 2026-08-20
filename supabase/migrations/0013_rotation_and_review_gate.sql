-- Practical Fitness Coach Platform
-- Week 8-9: schema support for the rotation engine and 6-session review
-- gate. Application logic lives in useSessionCore.js; this migration only
-- adds what the DB needs to hold that state correctly.

-- PRD 5.5: the review gate blocks Start Session before a session row
-- exists. review_decline_log.session_id was NOT NULL (0002_schema.sql),
-- which made a pre-session decline impossible to log. review_history.session_id
-- was already nullable for the same reason -- this brings decline_log in
-- line with it.
alter table review_decline_log alter column session_id drop not null;

-- PRD 8.3: "two or three auxiliary slots per client alternating per
-- session" is modeled as one rotating auxiliary grid row per client. This
-- column is the mutable pointer to which configured slot (A/B/C) is
-- currently active; null until the client has any auxiliary_config rows
-- and advance_client_rotation initializes it.
alter table clients
  add column auxiliary_active_slot text check (auxiliary_active_slot in ('A', 'B', 'C'));

-- Reset-point lookups for both the rotation-hold and 6-session-review-due
-- computations need "most recent review event for this client across any
-- exercise" -- the existing review_history index is (client_id,
-- exercise_id), not ordered by time.
create index review_history_client_id_recorded_idx
  on review_history (client_id, recorded_at desc);

create index review_decline_log_client_id_created_idx
  on review_decline_log (client_id, created_at desc);

-- PRD 6.2 Shuffle button ("manual rotation advance") and session-close
-- auto-advance both need to move the SAME mutable rotation state, so both
-- call this one function. Not SECURITY DEFINER, same reasoning as
-- update_client_color_code (0010): runs under the caller's existing
-- privileges, so both writes still go through the normal
-- client_exercise_order_all / clients_update RLS policies.
--
-- Type B (PRD 8.3): "4 exercises cycle through positions across 4
-- sessions" -- increments rotation_index mod 4 for the client's active
-- Type B rows. No-show/late-cancel hold (8.3) is enforced by the caller
-- simply not invoking this function for those statuses, not by anything
-- in here.
--
-- Auxiliary (8.3): "Auxiliary A on session 1, B on session 2, C (where
-- applicable) on session 3, then repeats" -- advances
-- clients.auxiliary_active_slot to the next slot letter the client
-- actually has configured in auxiliary_config (2 or 3 letters), cycling
-- alphabetically. Initializes from null to the first configured letter
-- rather than advancing past it, so a client's first-ever session shows
-- slot A rather than skipping it.
create function advance_client_rotation(p_client_id uuid) returns void
language plpgsql
as $$
declare
  v_slots text[];
  v_current text;
  v_current_idx int;
begin
  update client_exercise_order
  set rotation_index = (rotation_index + 1) % 4
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

grant execute on function advance_client_rotation(uuid) to authenticated;
