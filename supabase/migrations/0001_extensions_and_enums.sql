-- Practical Fitness Coach Platform
-- Week 1-2: extensions + enum types shared across the schema.

create extension if not exists "pgcrypto";

-- Used for fast partial/last-name client search (PRD 5.8).
create extension if not exists "pg_trgm";

create type user_role as enum ('coach', 'manager', 'owner');

create type color_code as enum ('P', 'C', 'E');

-- Exercise Type: PRD Section 8.2 (A = fixed always-present, B = rotating position
-- always-present, C = auxiliary A/B/C alternating, D = conditional manual swap).
create type exercise_type as enum ('A', 'B', 'C', 'D');

-- Movement Classification: PRD Section 21.1 (Dynamic / Metabolic / Eccentric).
-- Independent from set_type (PRD Section 21.4).
create type movement_classification as enum ('D', 'M', 'E');

-- Set Type: PRD Section 21.4 (S=Strength 1:30, T=Tone 2:15, E=Endurance 3:00).
create type set_type as enum ('S', 'T', 'E');

create type session_status as enum (
  'completed',
  'late_cancel',
  'no_show',
  'unscheduled_walk_in'
);

-- PRD Section 8.4 / 21.3: whether failure_time was captured automatically
-- from the stopwatch (M exercises) or entered manually (S/E exercises, or
-- coach override of an M exercise's auto-captured value).
create type failure_time_source as enum ('manual', 'auto');

-- PRD Section 5.5 / 6.4: 6-session review decline reasons.
create type review_decline_reason as enum (
  'client_said_no',
  'client_said_next_time',
  'client_declined_measurements_reviewed_goals',
  'other'
);
