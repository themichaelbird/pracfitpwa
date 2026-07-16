-- Practical Fitness Coach Platform
-- Week 1-2 seed: fully synthetic test clients (confirmed -- no real client
-- data yet). Spread across all 4 locations for RLS testing.

insert into clients (
  name, date_of_birth, sex, height, location_id, color_code,
  is_minor, parental_contact, music_preference, fan_preference,
  physical_limitations, personal_details, customization_notes,
  goal_tags, goal_notes, membership_package_type, membership_completion_date
) values
  ('Test Client One', '1985-03-14', 'Female', '5''6"',
    (select id from locations where name = 'Jollyville'), 'E',
    false, null, 'Pop hits playlist', 'Fan on medium',
    null, 'Two kids, works in marketing', 'Prefers earlier morning slots',
    array['weight_loss', 'general_fitness'], null,
    'Monthly Unlimited', '2026-12-01'),

  ('Test Client Two', '1978-11-02', 'Male', '5''10"',
    (select id from locations where name = 'Jollyville'), 'C',
    false, null, 'Classic rock', 'Fan off',
    'Occasional lower back tightness, self-reported', 'Runs marathons on weekends', null,
    array['strength', 'endurance'], 'Training for a half marathon',
    '20-Session Package', '2026-09-15'),

  ('Test Client Three', '1962-06-30', 'Female', '5''4"',
    (select id from locations where name = 'Westlake Hills'), 'P',
    false, null, 'Jazz', 'Fan on low',
    'Right knee sensitivity, self-reported; avoids deep flexion', 'Retired teacher, enjoys gardening', 'Needs extra warmup time',
    array['mobility', 'pain_management'], null,
    'Monthly Unlimited', '2026-08-01'),

  ('Test Client Four', '1995-01-19', 'Male', '6''1"',
    (select id from locations where name = 'Westlake Hills'), 'E',
    false, null, 'Hip-hop', 'Fan on high',
    null, 'Former college athlete', null,
    array['strength', 'muscle_gain'], null,
    '10-Session Package', '2026-10-20'),

  ('Test Client Five', '2010-08-22', 'Female', '5''2"',
    (select id from locations where name = 'Lakeway'), 'E',
    true, 'Parent/Guardian: 555-0142', 'Pop hits playlist', 'Fan off',
    null, 'High school student, plays soccer', 'Parent present for first 3 sessions',
    array['general_fitness'], null,
    'Monthly Unlimited', '2026-11-01'),

  ('Test Client Six', '1970-04-05', 'Male', '5''9"',
    (select id from locations where name = 'Lakeway'), 'C',
    false, null, 'Country', 'Fan on medium',
    'Shoulder discomfort on overhead movements, self-reported', 'Owns a small business', null,
    array['weight_loss', 'mobility'], 'Wants to keep up with grandkids',
    '20-Session Package', '2026-07-30'),

  ('Test Client Seven', '1988-09-11', 'Female', '5''7"',
    (select id from locations where name = 'Plano Willow Bend'), 'E',
    false, null, 'Indie/alternative', 'Fan on low',
    null, 'New to Plano, works remotely', null,
    array['general_fitness', 'strength'], null,
    'Monthly Unlimited', '2026-12-15'),

  ('Test Client Eight', '1955-12-25', 'Male', '5''8"',
    (select id from locations where name = 'Plano Willow Bend'), 'P',
    false, null, 'Classical', 'Fan off',
    'Multiple joint sensitivities, self-reported; consistent modification needed', 'Enjoys woodworking', 'Always check in on energy level before starting',
    array['mobility', 'pain_management'], 'Maintain independence',
    'Monthly Unlimited', '2026-08-20');
