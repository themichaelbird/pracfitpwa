-- Practical Fitness Coach Platform
-- v0.1: Eccentric (E) exercises log reps completed instead of a failure
-- time (v0.1 notation spec: "show a circled number for reps completed
-- instead of a time"). failure_time was NOT NULL for every row
-- (0002_schema.sql) on the assumption every exercise logs a time; this
-- relaxes that so E-classified logs can store reps_completed instead, while
-- keeping "something mandatory before advancing" enforced per classification
-- via a check constraint rather than app code alone. failure_time_source
-- (PRD 8.4: 'manual'/'auto') describes where a failure_time value came from,
-- so it's meaningless -- and now relaxed to nullable -- for E rows that
-- don't have one.
alter table session_exercise_logs
  add column reps_completed integer;

alter table session_exercise_logs
  alter column failure_time drop not null;

alter table session_exercise_logs
  alter column failure_time_source drop not null;

alter table session_exercise_logs
  add constraint session_exercise_logs_failure_time_or_reps_chk check (
    (
      movement_classification = 'E'
      and reps_completed is not null
      and failure_time is null
      and failure_time_source is null
    )
    or
    (
      movement_classification <> 'E'
      and failure_time is not null
      and failure_time_source is not null
      and reps_completed is null
    )
  );
