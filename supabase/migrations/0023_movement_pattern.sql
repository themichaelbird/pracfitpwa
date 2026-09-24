-- Practical Fitness Coach Platform
-- Coach session follow-up, item 2: push/pull classification did not exist
-- anywhere in the schema before this (confirmed -- unlike body_section/
-- muscle_group, which already existed by the time 0008 added them). Mapping
-- supplied by Michael (docs/PracFit_Exercise_Master_Log.xlsx,
-- push_pull_mapping column), covering all 66 exercises seeded in
-- 0009_seed_exercises.sql -- verified 1:1 by abbreviation, no gaps or extras
-- either direction. Exercises with no meaningful push/pull axis (lower body,
-- abs/torso, forearms, lower back) are left null rather than forced into
-- either bucket.

alter table exercises
  add column movement_pattern text check (movement_pattern in ('push', 'pull'));

update exercises set movement_pattern = 'push'
where abbreviation in (
  'CP', 'CFLY', 'PPL', 'PU', 'OHP', 'LAT', 'ADR', 'TEO', 'PSD', 'SKC', 'TRIX', 'PUML', 'DIP'
);

update exercises set movement_pattern = 'pull'
where abbreviation in (
  'RFLY', 'PLO', 'PD', 'RW', 'RDFL', 'PLOB', 'SHR', 'URW', 'BC', 'CUBC', 'HC', 'ZC', 'ASCU'
);
