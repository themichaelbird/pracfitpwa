-- Practical Fitness Coach Platform
-- Week 3-4: color code changes must land in both `clients.color_code` and
-- the `color_code_log` audit trail together. Doing that as two separate
-- client-side calls risks a logged change that never applied (or vice
-- versa) if the second call fails. Not SECURITY DEFINER, same reasoning as
-- verify_coach_pin (0007): runs with the caller's existing privileges, so
-- both the update and the log insert still go through the normal
-- clients_update / color_code_log_insert RLS policies.

create function update_client_color_code(
  p_client_id uuid,
  p_new_color_code color_code,
  p_changed_by uuid
) returns void
language plpgsql
as $$
declare
  v_previous color_code;
begin
  select color_code into v_previous from clients where id = p_client_id;

  update clients set color_code = p_new_color_code where id = p_client_id;

  insert into color_code_log (client_id, changed_by, previous_color_code, new_color_code)
  values (p_client_id, p_changed_by, v_previous, p_new_color_code);
end;
$$;

grant execute on function update_client_color_code(uuid, color_code, uuid) to authenticated;
