-- Practical Fitness Coach Platform
-- Week 1-2 seed: placeholder coaches/managers/owner (confirmed: names are
-- placeholders, replace with real staff before go-live).
--
-- pin_hash uses pgcrypto's bcrypt (crypt/gen_salt('bf')) as a placeholder
-- hashing scheme for Week 1-2. Every seeded PIN below is '1234' purely so
-- the login flow is testable end to end -- rotate before any real use.

insert into users (name, role, pin_hash, home_location_id) values
  ('Coach Placeholder A', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Jollyville')),
  ('Coach Placeholder B', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Westlake Hills')),
  ('Coach Placeholder C', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Lakeway')),
  ('Coach Placeholder D', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Plano Willow Bend')),
  ('Coach Placeholder E', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Jollyville')),
  ('Coach Placeholder F', 'coach', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Westlake Hills')),
  ('Manager Placeholder A', 'manager', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Jollyville')),
  ('Manager Placeholder B', 'manager', crypt('1234', gen_salt('bf')),
    (select id from locations where name = 'Plano Willow Bend')),
  ('Owner Placeholder', 'owner', crypt('1234', gen_salt('bf')), null);
