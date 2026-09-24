-- Practical Fitness Coach Platform
-- Coach session follow-up, item 2 (second half): per-client, persistent "2nd
-- push/pull" designation on a specific client_exercise_order slot -- same
-- pattern as movement_classification's permanent-default field (a plain flag
-- on the row itself, so it survives Type B rotation for free, exactly like
-- 0019_movement_classification_permanent_change.sql's field does). Replaces
-- the handwritten "2nd" notation on the paper sheet. "2nd push" vs "2nd pull"
-- isn't its own stored choice -- it's read off whichever exercise currently
-- occupies the slot (exercises.movement_pattern, 0023 migration), the same
-- way the badge always reflects whatever's actually in that slot today.
-- Entirely optional per client: default false/null, no visible change for a
-- client who never has this set.

alter table client_exercise_order
  add column is_second_push_pull boolean not null default false,
  add column second_push_pull_weight_offset decimal(6, 2);
