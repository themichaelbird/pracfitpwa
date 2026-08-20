-- Practical Fitness Coach Platform
-- Week 8-9 test data: Test Client Four's client_exercise_order rows for CP
-- and OHP were both seeded with rotation_index defaulting to 0 (0012 --
-- rotation engine didn't exist yet, so it didn't matter). Type B rotation
-- needs distinct base positions to be observable. BWS/PPL were seeded as
-- ordinary Type C client_exercise_order rows for the same pre-engine
-- reason; the auxiliary engine now sources the one rotating auxiliary row
-- from auxiliary_config instead, so those two rows are deactivated and
-- re-seeded as an A/B auxiliary pair. original_baselines is seeded so the
-- ORIGINAL screen (6-session review gate) has something to show -- zero
-- rows exist for this client otherwise.

update client_exercise_order
set rotation_index = 0
where client_id = (select id from clients where name = 'Test Client Four')
  and exercise_id = (select id from exercises where abbreviation = 'CP');

update client_exercise_order
set rotation_index = 1
where client_id = (select id from clients where name = 'Test Client Four')
  and exercise_id = (select id from exercises where abbreviation = 'OHP');

update client_exercise_order
set is_active = false
where client_id = (select id from clients where name = 'Test Client Four')
  and exercise_id in (select id from exercises where abbreviation in ('BWS', 'PPL'));

insert into auxiliary_config (client_id, slot, exercise_id, is_current)
select
  (select id from clients where name = 'Test Client Four'),
  slot,
  (select id from exercises where abbreviation = abbreviation_val),
  true
from (values ('A', 'BWS'), ('B', 'PPL')) as v(slot, abbreviation_val);

insert into original_baselines (client_id, exercise_id, movement_classification, weight, failure_time, recorded_by)
select
  (select id from clients where name = 'Test Client Four'),
  e.id,
  e.default_movement_classification,
  case e.abbreviation
    when 'HP' then 90
    when 'CP' then 60
    when 'OHP' then 40
    when 'BWS' then 0
    when 'PPL' then 0
  end,
  case e.abbreviation
    when 'HP' then 45
    when 'CP' then 40
    when 'OHP' then 35
    when 'BWS' then 30
    when 'PPL' then 30
  end,
  (select id from users where name = 'Coach Placeholder B')
from exercises e
where e.abbreviation in ('HP', 'CP', 'OHP', 'BWS', 'PPL');
