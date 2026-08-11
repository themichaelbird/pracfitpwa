-- Practical Fitness Coach Platform
-- Week 5-7: Session Core setup. Two small additions to `sessions`, both
-- decided at Start Session before the workout begins:
--   1. session_type (recurring/flex) -- new. Session column header shows a
--      RECURRING/FLEX badge; nothing upstream in the schema captured this.
--   2. set_type -- already existed (0002_schema.sql) as NOT NULL with no
--      default. Adding a default of 'S' only; the coach still picks it
--      explicitly on the Start Session screen.

create type session_type as enum ('recurring', 'flex');

alter table sessions
  add column session_type session_type not null default 'recurring';

alter table sessions
  alter column set_type set default 'S';
