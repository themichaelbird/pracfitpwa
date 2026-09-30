import { useEffect, useRef, useState } from 'react'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

// Signed in on this device, but the access token has expired and couldn't be
// refreshed because the auth server is unreachable -- not the same as signed
// out. The stored refresh token is still good; the session resumes on its own
// once a refresh gets through.
export const WAITING_FOR_CONNECTION = 'waiting-for-connection'

const RETRY_DELAY_MS = 15000

// undefined = still loading the initial session, null = signed out,
// WAITING_FOR_CONNECTION = see above, otherwise the Supabase session.
//
// supabase-js reports a refresh that failed for lack of connectivity as
// `session: null` plus an AuthRetryableFetchError, which used to be treated
// as signed out -- dropping a location iPad that had been offline overnight
// back to the Location Sign-In screen. Only a server rejection of the refresh
// token (a non-retryable error; supabase-js then removes the session and
// emits SIGNED_OUT) means actually signed out.
export function useSupabaseSession() {
  const [session, setSession] = useState(undefined)
  const waitingRef = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }

    let cancelled = false
    let retryTimer = null

    async function resolveSession() {
      clearTimeout(retryTimer)
      const { data, error } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        waitingRef.current = false
        setSession(data.session)
      } else if (error && isAuthRetryableFetchError(error)) {
        // Retried on a timer as well as on the 'online' event: with WiFi up
        // but no internet, navigator.onLine never changes, so no event fires.
        waitingRef.current = true
        setSession(WAITING_FOR_CONNECTION)
        retryTimer = setTimeout(resolveSession, RETRY_DELAY_MS)
      } else {
        waitingRef.current = false
        setSession(null)
      }
    }

    function handleOnline() {
      if (!waitingRef.current) return
      // supabase-js caches a failed refresh for 60s and hands that cached
      // failure back to every caller in the meantime, so a retry right after
      // reconnecting would otherwise fail without even trying. Clearing it
      // relies on a non-private GoTrueClient field; if a library update
      // removes it, the timer above still recovers once the cooldown ends.
      if ('lastRefreshFailure' in supabase.auth) supabase.auth.lastRefreshFailure = null
      resolveSession()
    }

    resolveSession()

    // Initial state comes from resolveSession, not INITIAL_SESSION, which also
    // reports null while waiting for a connection. After that: any event with
    // a session (SIGNED_IN, TOKEN_REFRESHED -- including the auto-refresh
    // ticker recovering on its own) resumes it, and only SIGNED_OUT signs out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        waitingRef.current = false
        clearTimeout(retryTimer)
        setSession(newSession)
      } else if (event === 'SIGNED_OUT') {
        waitingRef.current = false
        clearTimeout(retryTimer)
        setSession(null)
      }
    })
    window.addEventListener('online', handleOnline)

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return session
}
