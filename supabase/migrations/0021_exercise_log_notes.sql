-- Practical Fitness Coach Platform
-- Bug fix: the per-exercise note icon on each ExerciseCell (SessionWorkspace)
-- was opening the same session-wide NotesSidePanel as every other cell,
-- writing to coach_notes (one row per session) regardless of which exercise
-- the coach tapped from -- there was no per-exercise note storage at all.
-- This column gives each session_exercise_logs row its own note field so
-- exercise-level notes are actually scoped to that exercise's log entry,
-- independent of coach_notes.

alter table session_exercise_logs
  add column notes text;
