import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// keepalive lets a write already in flight finish even if the page closes
// mid-request. Only a head start, not the guarantee -- the outbox
// (mutateOnlineOrQueue.js) is what makes a closed-mid-send write survive.
// Browsers cap in-flight keepalive bodies at 64KB total and fail the request
// outright past it, which the outbox would then retry forever, so larger
// bodies go without it.
const KEEPALIVE_MAX_BODY = 32 * 1024
function fetchWithKeepalive(input, init = {}) {
  const method = (init.method ?? 'GET').toUpperCase()
  const smallBody = typeof init.body === 'string' && init.body.length <= KEEPALIVE_MAX_BODY
  if (method !== 'GET' && method !== 'HEAD' && smallBody) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetch(input, init)
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchWithKeepalive } })
    : null
