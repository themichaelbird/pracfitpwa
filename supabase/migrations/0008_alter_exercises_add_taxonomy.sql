-- Practical Fitness Coach Platform
-- Adds machine/body-region/muscle-group metadata to exercises, delivered
-- alongside Michael's master log (see 0009_seed_exercises.sql). This
-- resolves the PRD Appendix A/B blocker noted in 0002_schema.sql and
-- README.md -- exercises was structure-only until now.

alter table exercises
  add column is_fundamental boolean not null default false,
  add column machine_name text not null,
  add column body_section text not null check (body_section in ('Upper Body', 'Lower Body')),
  add column muscle_group text not null,
  add constraint exercises_abbreviation_key unique (abbreviation);
