import { supabase } from './supabaseClient'
import { enqueueMutation, listQueuedMutations, removeQueuedMutation } from './offlineQueue'

// Fetch throws a plain TypeError ("Failed to fetch" / "NetworkError...") when
// there's no connectivity, as opposed to a structured Postgrest error object
// (validation, RLS, etc.) which should still surface as a real error rather
// than silently queue nonsense for later replay.
function isNetworkError(err) {
  return !navigator.onLine || err instanceof TypeError
}

async function runMutation(mutation) {
  if (mutation.kind === 'insert') {
    const { error } = await supabase.from(mutation.table).insert(mutation.payload)
    if (error) throw error
  } else if (mutation.kind === 'update') {
    const { error } = await supabase
      .from(mutation.table)
      .update(mutation.payload)
      .eq('id', mutation.matchId)
    if (error) throw error
  } else if (mutation.kind === 'upsert') {
    const { error } = await supabase
      .from(mutation.table)
      .upsert(mutation.payload, { onConflict: mutation.onConflict })
    if (error) throw error
  } else if (mutation.kind === 'rpc') {
    const { error } = await supabase.rpc(mutation.name, mutation.params)
    if (error) throw error
  }
}

// PRD 7: "Offline session logging required. Syncs on reconnect." Every
// useSessionCore write goes through here instead of calling supabase
// directly. Rows carry a client-generated id (see useSessionCore.js) so a
// queued mutation never needs to learn a server-assigned id later --
// there's only ever one id, online or off.
export async function mutateOnlineOrQueue(mutation) {
  if (!navigator.onLine) {
    await enqueueMutation(mutation)
    return { queued: true }
  }
  try {
    await runMutation(mutation)
    return { queued: false }
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueMutation(mutation)
      return { queued: true }
    }
    throw err
  }
}

// PRD 16: "Offline sync conflicts -- Last-write-wins for MVP." Replays the
// outbox in the order mutations were queued (insert-then-update on the same
// row stays correctly ordered). A mutation that fails with a real error
// (not a network error) is dropped rather than blocking every mutation
// queued after it -- logged so it isn't silently lost from view.
export async function drainQueue() {
  const queued = await listQueuedMutations()
  for (const mutation of queued) {
    try {
      await runMutation(mutation)
      await removeQueuedMutation(mutation.id)
    } catch (err) {
      if (isNetworkError(err)) {
        break
      }
      console.error('Dropping queued mutation that failed to sync', mutation, err)
      await removeQueuedMutation(mutation.id)
    }
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
