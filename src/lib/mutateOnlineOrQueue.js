import { supabase } from './supabaseClient'
import {
  countQueuedMutations,
  enqueueMutation,
  listQueuedMutations,
  removeQueuedMutation,
} from './offlineQueue'

// supabase-js never throws on a failed fetch -- postgrest-js catches it and
// returns a plain error object with status 0, indistinguishable by type from
// a real server rejection. navigator.onLine alone can't catch it either: it
// stays true when the device has WiFi but the WiFi has no internet (common at
// the studio -- the access point reconnects well before its uplink does).
// So classify by whether the server actually answered: only a definitive 4xx
// (validation, constraint) is a real rejection. No response at all
// (status 0), a 5xx, a timeout (408) or rate limit (429) is treated as a
// connectivity failure -- queued if new, retried if already queued, never
// dropped. 401/403 are held the same way: after a long offline stretch they
// far more likely mean the location's access token expired before it could
// be refreshed than that the write itself is invalid, and dropping here
// would silently lose session data.
function isConnectivityFailure(err) {
  if (!navigator.onLine || err instanceof TypeError) return true
  const status = err?.status
  if (typeof status !== 'number' || status === 0) return true
  if (status === 401 || status === 403 || status === 408 || status === 429) return true
  return status >= 500
}

// Tracks whether the last request actually reached Supabase, separately from
// navigator.onLine, so OfflineStatusBadge can show "Offline" in the
// WiFi-but-no-internet case too (see useOnlineStatus.js).
const CONNECTIVITY_CHANGED_EVENT = 'pracfit-connectivity-changed'
let serverReachable = true
export function isServerReachable() {
  return serverReachable
}
export function onConnectivityChanged(listener) {
  window.addEventListener(CONNECTIVITY_CHANGED_EVENT, listener)
  return () => window.removeEventListener(CONNECTIVITY_CHANGED_EVENT, listener)
}
function setServerReachable(reachable) {
  if (serverReachable === reachable) return
  serverReachable = reachable
  window.dispatchEvent(new Event(CONNECTIVITY_CHANGED_EVENT))
}

async function runMutation(mutation) {
  let result
  if (mutation.kind === 'insert') {
    result = await supabase.from(mutation.table).insert(mutation.payload)
  } else if (mutation.kind === 'update') {
    let query = supabase.from(mutation.table).update(mutation.payload)
    if (mutation.match) {
      for (const [column, value] of Object.entries(mutation.match)) {
        query = query.eq(column, value)
      }
    } else {
      query = query.eq('id', mutation.matchId)
    }
    result = await query
  } else if (mutation.kind === 'upsert') {
    result = await supabase
      .from(mutation.table)
      .upsert(mutation.payload, { onConflict: mutation.onConflict })
  } else if (mutation.kind === 'rpc') {
    result = await supabase.rpc(mutation.name, mutation.params)
  } else if (mutation.kind === 'delete') {
    let query = supabase.from(mutation.table).delete()
    for (const [column, value] of Object.entries(mutation.match)) {
      query = query.eq(column, value)
    }
    result = await query
  }
  // The HTTP status lives on the response, not the error object -- carry it
  // over so isConnectivityFailure can tell "no response" from "rejected".
  if (result?.error) throw Object.assign(result.error, { status: result.status })
}

// While navigator.onLine stays true no further 'online' event will fire, so
// held mutations need their own retry. One pending timer at most.
const RETRY_DELAY_MS = 15000
let retryTimer = null
function scheduleRetry() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (navigator.onLine) drainQueue()
  }, RETRY_DELAY_MS)
}

// PRD 7: "Offline session logging required. Syncs on reconnect." Every
// useSessionCore write goes through here instead of calling supabase
// directly. Rows carry a client-generated id (see useSessionCore.js) so a
// queued mutation never needs to learn a server-assigned id later --
// there's only ever one id, online or off.
//
// A new write never jumps ahead of an older queued one: if anything is still
// in the outbox it goes to the back of the queue too. Otherwise, once the
// internet returns, e.g. a weight update could reach the server before its
// row's queued insert, match zero rows, and be silently lost.
export async function mutateOnlineOrQueue(mutation) {
  if (!navigator.onLine) {
    await enqueueMutation(mutation)
    return { queued: true }
  }
  if ((await countQueuedMutations()) > 0) {
    await enqueueMutation(mutation)
    drainQueue()
    return { queued: true }
  }
  try {
    await runMutation(mutation)
    setServerReachable(true)
    return { queued: false }
  } catch (err) {
    if (isConnectivityFailure(err)) {
      setServerReachable(false)
      await enqueueMutation(mutation)
      scheduleRetry()
      return { queued: true }
    }
    setServerReachable(true)
    throw err
  }
}

// PRD 16: "Offline sync conflicts -- Last-write-wins for MVP." Replays the
// outbox in the order mutations were queued (insert-then-update on the same
// row stays correctly ordered). A connectivity failure stops the drain with
// the mutation still queued, to be retried later. Only a definitive server
// rejection (4xx) drops a mutation, rather than blocking every mutation
// queued after it -- logged so it isn't silently lost from view.
async function drainOnce() {
  for (;;) {
    const queued = await listQueuedMutations()
    if (queued.length === 0) return
    for (const mutation of queued) {
      try {
        await runMutation(mutation)
        setServerReachable(true)
        await removeQueuedMutation(mutation.id)
      } catch (err) {
        if (isConnectivityFailure(err)) {
          setServerReachable(false)
          scheduleRetry()
          return
        }
        setServerReachable(true)
        console.error('Dropping queued mutation rejected by the server', mutation, err)
        await removeQueuedMutation(mutation.id)
      }
    }
  }
}

// Single-flight: the online event, the retry timer and new writes can all
// trigger a drain, and two concurrent drains would replay the same mutation
// twice (harmful for non-idempotent ones like the advance_client_rotation rpc).
let drainInFlight = null
export function drainQueue() {
  if (!drainInFlight) {
    drainInFlight = drainOnce().finally(() => {
      drainInFlight = null
    })
  }
  return drainInFlight
}

// Registered once at module load, not tied to any component's mount
// lifecycle -- a coach can close the session screen (or the whole app
// re-renders past it) before connectivity returns, and the queue still
// needs to drain. useOnlineStatus.js separately watches the outbox for UI
// display and reloading the currently-open screen; this is the one thing
// that must keep running regardless of what's currently mounted.
//
// Also drains once immediately if the app is already online at load time
// (not just on the online *event*, which only fires on an offline->online
// transition) -- covers a coach closing the browser/PWA entirely while
// offline and reopening later once already reconnected.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    drainQueue()
  })
  if (navigator.onLine) {
    drainQueue()
  }
}
