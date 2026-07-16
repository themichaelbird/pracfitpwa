import { supabase } from './supabaseClient'

const FORGOTTEN_PIN_OVERRIDE = '2222'

// PRD 5.1: coach selects their name, enters PIN. Entering 2222 skips PIN
// verification and logs the entry as a forgotten-code override -- the
// session is still attributed to the selected name (sessions.pin_override_used).
export async function verifyCoachLogin(userId, pin) {
  if (pin === FORGOTTEN_PIN_OVERRIDE) {
    return { ok: true, overrideUsed: true }
  }

  const { data, error } = await supabase.rpc('verify_coach_pin', {
    p_user_id: userId,
    p_pin: pin,
  })
  if (error) throw error

  return { ok: data === true, overrideUsed: false }
}
