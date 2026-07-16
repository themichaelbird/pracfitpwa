# Practical Fitness Coach Platform

Coach-facing iPad PWA for Practical Fitness (4 Austin/Plano locations),
replacing paper workout sheets. Source of truth for requirements is the PRD
(v2.4) — this repo does not restate it.

**Status:** Week 1-2 of the development sequence (PRD Section 20) — schema,
RLS, PIN auth wiring, and seed data. No session logging UI, rotation
engine, or recap generation yet (that's Weeks 5-10).

## Stack

React (Vite) + Tailwind CSS + Supabase (Postgres/Auth) + Vercel. See
`supabase/README.md` for schema/auth setup.

## Getting started

```
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Repo layout

- `src/` — React app
- `supabase/migrations/` — versioned SQL schema, RLS policies, seed data
- `supabase/README.md` — setup order, auth model, provisioning steps
- `scripts/` — one-off ops scripts (Supabase Auth account provisioning)

## Auth model (Option B)

Coaches authenticate with name selection + a 4-digit PIN (app-layer
attribution, checked via a Postgres RPC). Row-level security is enforced
at the location level through 4 shared Supabase Auth accounts, one per
location/iPad, plus one owner account that sees all locations. Full detail
and the accepted scope gap vs. PRD 6.9 are documented in
`supabase/README.md`.

## Known blockers (not yet resolved)

- **Exercise master log** — the `exercises` table exists but is
  intentionally unseeded. Canonical names/abbreviations/default movement
  classifications are a hard blocker per PRD Appendix A/B.
- **Legal consultation** — PRD Section 10: a health-privacy attorney
  consultation is required before any real client data enters the system.
