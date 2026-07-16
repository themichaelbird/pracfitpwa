// Practical Fitness Coach Platform
// Week 1-2: provisions the shared Supabase Auth accounts for Option B.
//
// This cannot be done via SQL migrations -- app_metadata (the JWT claims
// RLS policies read in 0003_rls_policies.sql) can only be set through the
// Supabase Admin API, which requires the service_role key.
//
// Run once, after migrations have been applied and locations are seeded:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/provision-location-auth-accounts.mjs
//
// Never commit the service_role key or reuse it in the app. It is only used
// here, once, from your own machine.

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.'
  )
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const LOCATION_DEVICE_SLUGS = {
  Jollyville: 'jollyville',
  'Westlake Hills': 'westlake-hills',
  Lakeway: 'lakeway',
  'Plano Willow Bend': 'plano-willow-bend',
}

function randomPassword() {
  return randomBytes(18).toString('base64url')
}

async function main() {
  const { data: locations, error: locErr } = await admin
    .from('locations')
    .select('id, name')
  if (locErr) throw locErr
  if (!locations?.length) {
    throw new Error(
      'No locations found -- run the migrations and seed data first.'
    )
  }

  const created = []

  for (const location of locations) {
    const slug = LOCATION_DEVICE_SLUGS[location.name]
    if (!slug) {
      console.warn(`Skipping unrecognized location "${location.name}"`)
      continue
    }
    const email = `location-${slug}@device.practicalfitness.internal`
    const password = randomPassword()

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'location', location_id: location.id },
    })
    if (error) throw error

    created.push({ location: location.name, email, password })
  }

  const ownerEmail = 'owner@device.practicalfitness.internal'
  const ownerPassword = randomPassword()
  const { error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    app_metadata: { role: 'owner' },
  })
  if (ownerErr) throw ownerErr
  created.push({ location: '(all locations)', email: ownerEmail, password: ownerPassword })

  console.log('\nAccounts created. Save these credentials somewhere secure')
  console.log('(a password manager) -- they will not be shown again:\n')
  for (const account of created) {
    console.log(`${account.location}`)
    console.log(`  email:    ${account.email}`)
    console.log(`  password: ${account.password}\n`)
  }
  console.log(
    'Each iPad at a location signs in once with that location\'s account and stays signed in.'
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
