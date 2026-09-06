-- Practical Fitness Coach Platform
-- Coach session/profile UI-UX pass: the movement classification picker (D/M/E
-- badge, moved to the left of the exercise cell) now offers two paths --
-- session-only override (existing movement_classification_override, PRD
-- 21.2) or a permanent change that also updates the client's stored default
-- in client_exercise_order. This column distinguishes the two paths in the
-- session log itself, since movement_classification_override alone can't
-- tell them apart.

alter table session_exercise_logs
  add column movement_classification_permanent_change boolean not null default false;
