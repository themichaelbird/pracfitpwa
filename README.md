# Practical Fitness Coach Platform

A coach-facing iPad PWA built to replace paper workout sheets at Practical Fitness, a private 1-on-1 strength training studio with locations in Austin and Plano, TX. Built solo, currently being tested and iterated on by the coaching staff, and used as my hands-on vehicle for leveling up into data/AI engineering.

**Live:** [pracfitpwa.vercel.app](https://pracfitpwa.vercel.app)

## Why This Exists

Every session at Practical Fitness still runs off a paper sheet. Coaches hand-write workouts before every shift, handwriting quality varies client to client, notes get lost, and nobody has real visibility into what's happening at a given location unless they're physically there — or someone on-site sends over photos of whatever's needed. This app is meant to digitize that entire workflow: session logging, exercise rotation, machine settings, progress tracking, coach handoffs, all of it.

I'm a studio manager here — Practical Fitness has a manager at each of the four locations — and I'm building this on my own initiative. Ownership hasn't approved a studio-wide rollout, and this isn't official infrastructure yet. I started it to sharpen my own AI-assisted engineering skills on a real, messy, stateful domain problem, with the hope that it eventually gets adopted across all four locations. It's not a side hackathon project either: the coaching staff is actively testing it and putting real feedback into how it evolves, even though it isn't in production use.

## What It Actually Does

- **Session logging** — weight, failure time, movement classification, stopwatch, and effort/outcome notation, per exercise, per session, with offline support so a bad WiFi day at the studio never loses data.
- **Exercise rotation engine** — a stateful rotation system (fixed / rotating / auxiliary exercise types) that advances correctly on session completion, holds on no-shows, and resets cleanly for new or returning clients. This is the part of the app with the most actual logic in it — getting the state machine right took real iteration.
- **6-session review gate with an append-only baseline history** — founding muscle-failure weights are locked permanently at intake; every subsequent review appends to history rather than overwriting anything. Data integrity mattered more here than almost anywhere else in the app.
- **Auth without the overhead** — shared per-location accounts plus a lightweight name-selection + PIN layer on top, so individual coaches get attribution without needing full account management for a staff that changes locations day to day.
- **Offline-first architecture** — service worker + IndexedDB outbox queue, client-generated UUIDs to sidestep ID reconciliation, and a sync-on-reconnect flow. Built for an iPad on gym WiFi, not a conference room demo.
- **Manager mode** — a permission layer on top of the same coach session, not a separate login, with its own audit logs for settings changes and color-code history.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite) | Fast iteration, best tooling support for AI-assisted development |
| Styling | Tailwind CSS | No custom CSS system to maintain solo |
| Backend/DB | Supabase (Postgres) | Managed Postgres + REST + Auth + realtime, free tier covers MVP scale |
| Offline | Service Worker + IndexedDB | PWA-native offline, no native app dependency |
| Hosting | Vercel + Supabase | Both free at this scale, auto-deploy from `main` |
| Device target | iPad Safari, landscape PWA | No App Store review cycle needed for the web-app tier |

19+ tables, 20+ migrations and counting. This isn't a flat schema — settings, exercise order, rotation state, review history, and session logs are all deliberately separate concerns because conflating them (which is tempting, and which I almost did early on) makes the data untrustworthy the moment a coach corrects a mistake.

## How This Gets Built

I build this using Claude Code as a development partner — I own the architecture decisions, the data model, the product requirements, and every review of what gets shipped; Claude Code handles implementation, and I audit its output against a living PRD before anything gets merged. Every non-trivial change goes through: spec it, build it, live-test it against seed data, verify it against the actual database, then reconcile the PRD to match reality. That last step matters — I don't let documentation drift from what's actually running in production, and I've run full audits specifically to catch where they'd diverged.

## Current State

Actively developed, v0.3. Not yet approved for studio-wide rollout, and no real client data is in the system. The coaching staff tests it by running real sessions through the app on each other — using coaches' own data as stand-in clients — so the workflow gets validated against real usage without touching any client information. Real client data has one hard, non-negotiable gate ahead of it regardless: a legal consultation on health-data handling, which is still outstanding and treated as a blocker, not a nice-to-have.

## Where This Fits Into My Path

I work full-time, and I'm building this alongside a self-directed mentorship in data science, programming, and AI agent development. The pivot to a data or AI-focused role is happening now — not on a multi-year timeline. This project is the proof of work: real constraints, real data integrity problems, real offline/sync problems, real audit trails, built and shipped by one person managing both the product and the engineering side of it.

If you're reading this because you're evaluating me for a role — this is what I'd point to first.
