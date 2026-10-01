-- Practical Fitness Coach Platform
-- Security fix: keep users.pin_hash off the wire.
--
-- 0003's blanket `grant select ... on all tables` plus the users_select
-- policy let any location/owner token read pin_hash for every user over
-- the REST API (e.g. GET /rest/v1/users?select=pin_hash), which defeated
-- the point of checking PINs server-side in verify_coach_pin (0007). Four-
-- digit PINs behind a bcrypt hash crack offline in seconds, so a leaked
-- hash is as good as the PIN -- for coaches and for the managers whose PIN
-- doubles as the Manager Mode code.
--
-- Fix: replace the table-wide SELECT with a column-level grant that omits
-- pin_hash, and make verify_coach_pin SECURITY DEFINER so it can still
-- read the hash on the caller's behalf. Everything the app selects from
-- users (id, name, role, home_location_id, is_active, and users(name)
-- embeds) keeps working unchanged. A `select=*` on users now fails with
-- "permission denied" instead of silently including the hash.
--
-- NOTE: if a later migration re-runs `grant select on all tables in schema
-- public to authenticated`, that re-grants table-wide SELECT and reopens
-- this. Re-apply the revoke below after any such grant.

revoke select on users from anon, authenticated;

grant select (id, name, role, home_location_id, is_active, created_at)
  on users to authenticated;

-- SECURITY DEFINER bypasses both the column grant and RLS, so the
-- location/owner check users_select used to provide is restated here --
-- otherwise any signed-in token without an app role could probe PINs.
-- search_path is pinned empty and every name schema-qualified, the
-- standard hardening for definer functions.
create or replace function verify_coach_pin(p_user_id uuid, p_pin text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select public.auth_role() in ('location', 'owner')
    and exists (
      select 1 from public.users
      where id = p_user_id
        and is_active
        and pin_hash = extensions.crypt(p_pin, pin_hash)
    );
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions, and Supabase also
-- grants it to anon by default. Now that this runs as definer, limit it to
-- signed-in sessions only.
revoke execute on function verify_coach_pin(uuid, text) from public, anon;
grant execute on function verify_coach_pin(uuid, text) to authenticated;
