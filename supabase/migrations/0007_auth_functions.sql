-- Practical Fitness Coach Platform
-- Week 1-2: PIN verification RPC.
--
-- PIN checking happens server-side via this function rather than by
-- fetching pin_hash to the client and comparing with a bcrypt library in
-- the browser -- this keeps password hashes off the wire entirely. Not
-- SECURITY DEFINER: it runs with the caller's existing privileges, so it
-- relies on the users_select RLS policy (0003_rls_policies.sql) already
-- granting the shared location/owner account read access to `users`.

create function verify_coach_pin(p_user_id uuid, p_pin text) returns boolean
language sql stable
as $$
  select exists (
    select 1 from users
    where id = p_user_id
      and is_active
      and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

grant execute on function verify_coach_pin(uuid, text) to authenticated;
