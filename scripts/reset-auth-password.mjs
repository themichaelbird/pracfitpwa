// Practical Fitness Coach Platform
// Resets the password for one existing shared Auth account (Option B:
// per-location/owner accounts, see supabase/README.md).
//
// Run:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   RESET_EMAIL=location-westlake-hills@device.practicalfitness.internal \
//   node scripts/reset-auth-password.mjs
//
// Prints the new password once. Never commit the service_role key or reuse
// it outside this one-off run.

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.RESET_EMAIL

if (!supabaseUrl || !serviceRoleKey || !email) {
  console.error(
    'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and RESET_EMAIL before running this script.'
  )
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function randomPassword() {
  return randomBytes(18).toString('base64url')
}

async function main() {
  let userId
  let page = 1
  while (!userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email === email)
    if (match) {
      userId = match.id
      break
    }
    if (data.users.length < 200) break
    page += 1
  }
  if (!userId) {
    throw new Error(`No Auth user found with email "${email}"`)
  }

  const newPassword = randomPassword()
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (updateErr) throw updateErr

  console.log('\nPassword reset. Save this somewhere secure -- it will not be shown again:\n')
  console.log(`  email:    ${email}`)
  console.log(`  password: ${newPassword}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
