import { supabase } from './supabaseClient'
import {
  clearFirstAttempt,
  countPendingMutations,
  enqueueMutation,
  listQueuedMutations,
  markFirstAttempt,
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
//
// Reads (e.g. useSessionCore's load) throw supabase's error object as-is,
// which carries no HTTP status -- runMutation attaches it for writes, but a
// read's error arrives without one. For those, classify by the error's code
// instead, per postgrest-js: a failed fetch comes back with code '', a
// non-JSON body (a gateway 5xx/408/429) with no code at all, while anything
// PostgREST or Postgres actually answered carries one. JWT errors
// (PGRST301-303, the 401 case) and PGRST000-003 (503: the API couldn't reach
// the database) count as connectivity, the same as their statuses above.
export function isConnectivityFailure(err) {
  if (!navigator.onLine || err instanceof TypeError) return true
  const status = err?.status
  if (typeof status !== 'number') {
    const code = err?.code
    if (!code) return true
    return /^PGRST(00[0-3]|30[1-3])$/.test(code)
  }
  if (status === 0) return true
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

// An insert replayed after its earlier send already reached the server (the
// page closed before the outbox entry was removed, or the response was lost)
// is rejected on its own device-generated primary key. That means "already
// applied", not a real rejection.
function isAlreadyApplied(mutation, err) {
  return mutation.kind === 'insert' && err?.code === '23505' && /_pkey"/.test(err.message ?? '')
}

// For RPCs that are not safe to run twice (0027_idempotent_rpcs.sql): the
// outbox entry id doubles as the server-side idempotency key, so a replay of
// an advance that already applied is a no-op instead of a second advance.
export function idempotentRpc(name, params) {
  const id = crypto.randomUUID()
  return { id, kind: 'rpc', name, params: { ...params, p_request_id: id } }
}

// Callers waiting on their own write's first send, keyed by outbox entry id.
const waiters = new Map()
function settle(id, outcome) {
  const waiter = waiters.get(id)
  if (!waiter) return false
  waiters.delete(id)
  clearFirstAttempt(id)
  if (outcome.error) waiter.reject(outcome.error)
  else waiter.resolve(outcome)
  return true
}

// PRD 7: "Offline session logging required. Syncs on reconnect." Every
// write goes through here instead of calling supabase directly. Rows carry a
// client-generated id (see useSessionCore.js) so a queued mutation never
// needs to learn a server-assigned id later -- there's only ever one id,
// online or off.
//
// Outbox first, online or not: the mutation is committed to IndexedDB before
// it is sent and removed only once the server confirms it, so closing the
// page mid-request can't lose it -- the module-level drain below replays it
// on the next open. That makes a replay of something the server already
// applied possible; inserts and set-value updates are harmless to repeat,
// and the RPCs that aren't go through idempotentRpc.
//
// Online, the send itself goes through the same single-flight drain as
// replays, so writes reach the server strictly in the order they were made
// (e.g. a weight update can never overtake its row's insert and match zero
// rows). The caller still gets the same contract as before: { queued: false }
// once the server confirms it, { queued: true } if it's held for retry, and
// a thrown error if the server definitively rejects it.
export async function mutateOnlineOrQueue(mutation) {
  if (!navigator.onLine) {
    await enqueueMutation(mutation)
    return { queued: true }
  }
  // Something is already held for retry (lie-fi): don't make this caller wait
  // on a send that's likely to hang the same way -- queue behind it.
  if ((await countPendingMutations()) > 0) {
    await enqueueMutation(mutation)
    drainQueue()
    return { queued: true }
  }

  markFirstAttempt(mutation.id)
  try {
    await enqueueMutation(mutation)
  } catch (err) {
    // IndexedDB unavailable (e.g. storage blocked): still send, just without
    // the crash insurance, as every online write did before.
    clearFirstAttempt(mutation.id)
    console.error('Outbox unavailable, sending without it', err)
    await runMutation(mutation)
    return { queued: false }
  }
  const outcome = new Promise((resolve, reject) => {
    waiters.set(mutation.id, { resolve, reject })
  })
  drainQueue()
  return outcome
}

// PRD 16: "Offline sync conflicts -- Last-write-wins for MVP." Sends the
// outbox in the order mutations were queued (insert-then-update on the same
// row stays correctly ordered). A connectivity failure stops the drain with
// the mutation still queued, to be retried later. Only a definitive server
// rejection (4xx) drops a mutation, rather than blocking every mutation
// queued after it -- thrown to its caller if one is still waiting, logged
// otherwise, so it isn't silently lost from view.
async function drainOnce() {
  for (;;) {
    const queued = await listQueuedMutations()
    if (queued.length === 0) return 'empty'
    for (const mutation of queued) {
      try {
        await runMutation(mutation)
      } catch (err) {
        if (isConnectivityFailure(err)) {
          setServerReachable(false)
          scheduleRetry()
          return 'held'
        }
        if (!isAlreadyApplied(mutation, err)) {
          setServerReachable(true)
          await removeQueuedMutation(mutation.id)
          if (!settle(mutation.id, { error: err })) {
            console.error('Dropping queued mutation rejected by the server', mutation, err)
          }
          continue
        }
      }
      setServerReachable(true)
      // Removed before the waiter is settled, so the entry never shows up in
      // the pending count in between.
      await removeQueuedMutation(mutation.id)
      settle(mutation.id, { queued: false })
    }
  }
}

// Single-flight: the online event, the retry timer and new writes can all
// trigger a drain, and two concurrent drains would send the same mutation
// twice. A request that arrives mid-drain runs another pass rather than
// joining one that may already have listed the outbox without it. Once a
// drain is held, every caller still waiting gets { queued: true } -- their
// entries stay in the outbox for the retry.
let drainInFlight = null
let drainRequested = false
export function drainQueue() {
  drainRequested = true
  if (!drainInFlight) drainInFlight = runDrains()
  return drainInFlight
}
async function runDrains() {
  try {
    while (drainRequested) {
      drainRequested = false
      if ((await drainOnce()) === 'held') {
        for (const id of [...waiters.keys()]) settle(id, { queued: true })
        break
      }
    }
  } finally {
    drainInFlight = null
  }
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
