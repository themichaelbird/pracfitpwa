-- Practical Fitness Coach Platform
-- Week 5-7 test data: client_exercise_order and client_exercise_settings
-- were never seeded in Weeks 1-4 (out of scope then), which left the
-- Session Core grid with zero rows for every client. This adds a small,
-- clearly synthetic exercise list for Test Client Four (Westlake Hills) so
-- the grid can be exercised end-to-end -- a mix of D and M movement
-- classifications to cover both FailureTimeInput branches (scroll-wheel
-- picker vs. stopwatch auto-capture).

insert into client_exercise_order (client_id, exercise_id, movement_classification)
select
  (select id from clients where name = 'Test Client Four'),
  e.id,
  e.default_movement_classification
from exercises e
where e.abbreviation in ('HP', 'CP', 'OHP', 'BWS', 'PPL');

insert into client_exercise_settings (client_id, exercise_id, settings)
select
  (select id from clients where name = 'Test Client Four'),
  e.id,
  case e.abbreviation
    when 'HP' then '{"seat_position": "4", "pad_height": "2"}'::jsonb
    when 'CP' then '{"seat_position": "3", "handle": "wide"}'::jsonb
    else '{}'::jsonb
  end
from exercises e
where e.abbreviation in ('HP', 'CP', 'OHP', 'BWS', 'PPL');
