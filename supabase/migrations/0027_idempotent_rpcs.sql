-- Practical Fitness Coach Platform
-- Idempotency keys for the RPCs that are not safe to repeat. Every online
-- write now goes into the outbox before it is sent and is removed only on
-- confirmed success (mutateOnlineOrQueue.js), so a page closed between
-- "server applied it" and "device removed it" replays the write on reopen.
-- Inserts (device-generated ids) and plain set-value updates are harmless to
-- repeat; these three are not: advance_client_rotation shifts Type B
-- positions again, advance_hip_press_split_lead flips back (losing the
-- advance), and update_client_color_code writes a bogus "C -> C" log row.
-- Each now takes the outbox entry id as p_request_id and claims it in
-- applied_requests first, in the same transaction, doing nothing on a replay.

create table applied_requests (
  request_id uuid primary key,
  client_id uuid not null references clients (id),
  function_name text not null,
  applied_at timestamptz not null default now()
);

alter table applied_requests enable row level security;

create policy applied_requests_insert on applied_requests
  for insert with check (
    exists (
      select 1 from clients c
      where c.id = applied_requests.client_id
        and (is_owner() or c.location_id = auth_location_id())
    )
  );

-- INSERT ... ON CONFLICT under RLS also needs a SELECT policy (verified:
-- without one even a first-time claim is rejected).
create policy applied_requests_select on applied_requests
  for select using (
    exists (
      select 1 from clients c
      where c.id = applied_requests.client_id
        and (is_owner() or c.location_id = auth_location_id())
    )
  );

grant select, insert on applied_requests to authenticated;

-- True the first time a request id is seen, false on any replay. Runs in
-- the caller's transaction, so the ledger row and the advance commit or
-- roll back together.
create function claim_request(p_request_id uuid, p_client_id uuid, p_function_name text)
returns boolean
language plpgsql
as $$
declare
  v_inserted int;
begin
  if p_request_id is null then
    return true; -- legacy caller (outbox entry queued by an older app build)
  end if;
  insert into applied_requests (request_id, client_id, function_name)
  values (p_request_id, p_client_id, p_function_name)
  on conflict (request_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke execute on function claim_request(uuid, uuid, text) from public, anon;
grant execute on function claim_request(uuid, uuid, text) to authenticated;

-- Default null keeps PostgREST calls with only p_client_id (outbox entries
-- queued by the current app build) resolving to the same function.
drop function advance_client_rotation(uuid);
create function advance_client_rotation(p_client_id uuid, p_request_id uuid default null)
returns void
language plpgsql
as $$
declare
  v_slots text[];
  v_current text;
  v_current_idx int;
begin
  if not claim_request(p_request_id, p_client_id, 'advance_client_rotation') then
    return;
  end if;

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
revoke execute on function advance_client_rotation(uuid, uuid) from public, anon;
grant execute on function advance_client_rotation(uuid, uuid) to authenticated;

drop function advance_hip_press_split_lead(uuid);
create function advance_hip_press_split_lead(p_client_id uuid, p_request_id uuid default null)
returns void
language plpgsql
as $$
begin
  if not claim_request(p_request_id, p_client_id, 'advance_hip_press_split_lead') then
    return;
  end if;

  update clients
  set hip_press_split_lead_side = case hip_press_split_lead_side when 'R' then 'L' else 'R' end
  where id = p_client_id
    and hip_press_split_active
    and not hip_press_split_frozen;
end;
$$;
revoke execute on function advance_hip_press_split_lead(uuid, uuid) from public, anon;
grant execute on function advance_hip_press_split_lead(uuid, uuid) to authenticated;

drop function update_client_color_code(uuid, color_code, uuid);
create function update_client_color_code(
  p_client_id uuid,
  p_new_color_code color_code,
  p_changed_by uuid,
  p_request_id uuid default null
) returns void
language plpgsql
as $$
declare
  v_previous color_code;
begin
  if not claim_request(p_request_id, p_client_id, 'update_client_color_code') then
    return;
  end if;

  select color_code into v_previous from clients where id = p_client_id;

  update clients set color_code = p_new_color_code where id = p_client_id;

  insert into color_code_log (client_id, changed_by, previous_color_code, new_color_code)
  values (p_client_id, p_changed_by, v_previous, p_new_color_code);
end;
$$;
revoke execute on function update_client_color_code(uuid, color_code, uuid, uuid) from public, anon;
grant execute on function update_client_color_code(uuid, color_code, uuid, uuid) to authenticated;
