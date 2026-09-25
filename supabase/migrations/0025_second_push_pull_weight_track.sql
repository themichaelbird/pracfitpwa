-- Practical Fitness Coach Platform
-- Coach session follow-up, item 2 correction (live QA): drops the "weight
-- offset" concept entirely. Weight was never a persistent standalone field
-- for any exercise -- it only ever lives in session_exercise_logs, one row
-- per session, and what looks like "the exercise remembers its weight" is
-- just prefill from the most recent completed session's log for that
-- exercise_id (see useSessionCore.js). "Two independent, persistent weight
-- tracks" is therefore just a tag on each log row saying which track it was
-- logged under -- no schema change to the exercise catalog, no second
-- weight column, same as the Hip Press split needed no exercise_type change.

alter table client_exercise_order
  drop column second_push_pull_weight_offset;

alter table session_exercise_logs
  add column logged_as_second_push_pull boolean not null default false;
