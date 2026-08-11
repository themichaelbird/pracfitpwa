# Supabase setup (Week 1-2)

Scope: schema + RLS + auth wiring + seed data only. No session logging UI,
rotation engine, or recap generation yet (PRD Section 20, Weeks 5-10).

## 1. Create the project

1. supabase.com → New Project. Save the DB password.
2. Project Settings → API → save the **Project URL** and **anon public key**.
3. Copy `.env.example` to `.env` at the repo root and fill in
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## 2. Run the migrations, in order

Via the SQL Editor (paste each file's contents and run), or the Supabase
CLI (`supabase link`, then `supabase db push`):

1. `0001_extensions_and_enums.sql`
2. `0002_schema.sql` — all 19 tables (PRD Section 8.1 / Appendix A)
3. `0003_rls_policies.sql` — Option B RLS (see comments in the file for the
   full auth model and the accepted gap vs. PRD 6.9)
4. `0004_seed_locations.sql` — 4 real locations
5. `0005_seed_users.sql` — placeholder coaches/managers/owner, PIN `1234`
6. `0006_seed_clients.sql` — synthetic test clients
7. `0007_auth_functions.sql` — PIN verification RPC
8. `0008_alter_exercises_add_taxonomy.sql` — adds machine/body-section/
   muscle-group/is_fundamental columns to `exercises`
9. `0009_seed_exercises.sql` — 66 canonical exercises (PRD Appendix A/B
   master log)
10. `0010_client_color_code_rpc.sql` — atomic color code update + audit log
11. `0011_session_type_and_set_type_default.sql` — adds `sessions.session_type`
    (recurring/flex) and a default on `sessions.set_type` (Week 5-7 Session
    Core)
12. `0012_seed_test_client_exercise_order.sql` — synthetic
    client_exercise_order/client_exercise_settings rows for Test Client Four,
    since Weeks 1-4 never seeded either table

## 3. Provision the shared location Auth accounts (Option B)

`app_metadata` (the JWT claim RLS reads) can only be set via the Admin API,
not plain SQL, so this is a one-time script rather than a migration:

```
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/provision-location-auth-accounts.mjs
```

Get the service_role key from Project Settings → API — use it only on your
own machine for this one run, never in the app or committed anywhere. The
script prints 5 email/password pairs (one per location, one for the owner)
exactly once. Save them in a password manager: each location's iPad signs
in once with that location's pair and stays signed in.

## Auth model summary

- No 1:1 mapping between Supabase Auth identities and coaches.
- 4 shared Auth accounts, one per location/iPad, `app_metadata.role =
  'location'` + `app_metadata.location_id`.
- 1 Auth account for the owner, `app_metadata.role = 'owner'`, bypasses
  location filtering.
- The `users` table (coaches/managers, PIN hashes) is a separate app-layer
  roster. PIN entry (checked via the `verify_coach_pin` RPC) identifies
  *which coach* is acting for attribution — it does not change the
  underlying Supabase Auth session.
- Manager mode is a toggle within the same shared login (manager code
  checked app-side), so it needs no separate RLS handling.
- Accepted gap: PRD 6.9's "coach sees scheduled clients only" is narrower
  than the location boundary RLS enforces. That restriction is app-layer
  only in this PWA — acceptable per PRD 9.3, since the PWA is a learning/
  testing vehicle and the native app is the production security boundary.
