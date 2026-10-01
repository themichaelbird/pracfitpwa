import { openDB } from 'idb'

const DB_NAME = 'pracfit-offline'
const DB_VERSION = 1
const OUTBOX_STORE = 'outbox'
const SNAPSHOT_STORE = 'snapshots'

// PRD 7/9.2: "iPad caches session data in IndexedDB -> pushes to Supabase
// on reconnect." Two stores:
//   outbox    -- every mutation, written before it is sent and removed only
//                once the server confirms it; replayed in order on reopen
//                or reconnect (see mutateOnlineOrQueue.js).
//   snapshots -- last-known-good useSessionCore state per clientId, so a
//                client already open before the network dropped can still
//                be read (not just written to) while offline.
let dbPromise = null
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        db.createObjectStore(SNAPSHOT_STORE)
      },
    })
  }
  return dbPromise
}

// Fired whenever the outbox changes so OfflineStatusBadge can update its
// pending count without polling IndexedDB.
const OUTBOX_CHANGED_EVENT = 'pracfit-outbox-changed'
export function onOutboxChanged(listener) {
  window.addEventListener(OUTBOX_CHANGED_EVENT, listener)
  return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, listener)
}
function notifyOutboxChanged() {
  window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
}

// mutation: { id, kind: 'insert'|'update'|'upsert'|'rpc'|'delete', table?, payload?, matchId?, onConflict?, name?, params?, match? }
// `match` (delete, and update) is a { column: value, ... } map of equality
// conditions -- used instead of matchId when the row to delete/update is
// identified by a composite unique key rather than its primary id (e.g.
// session_exercise_log_notations, keyed by (log_id, notation_id); or
// auxiliary_config's current row for a slot, keyed by (client_id, slot,
// is_current)).
// id is the caller's own client-generated UUID (see mutateOnlineOrQueue.js) --
// reused as the outbox entry's key so the same mutation is never queued twice.
//
// queuedAt is the replay order, so it must be strictly increasing: with every
// write going through the outbox, back-to-back writes routinely land in the
// same millisecond, and a tie would fall back to the random id order.
// Resolves only once the transaction has committed -- the caller sends the
// request right after, and the entry must survive the page closing mid-send.
let lastQueuedAt = 0
export async function enqueueMutation(mutation) {
  const db = await getDb()
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1)
  const entry = { ...mutation, queuedAt: lastQueuedAt }
  const tx = db.transaction(OUTBOX_STORE, 'readwrite')
  tx.store.put(entry)
  await tx.done
  notifyOutboxChanged()
  return entry
}

// Ids of entries this tab is sending for the first time, with the caller still
// waiting on the result. They're in the outbox only as crash insurance, so
// they don't count as pending for display -- otherwise every online save
// would flash "Syncing -- 1 pending" and the 1 -> 0 drop would trigger
// useOnlineStatus's reload-on-sync. In memory on purpose: after a reload the
// set is empty, so anything left over from a close counts as pending.
const firstAttemptIds = new Set()
export function markFirstAttempt(id) {
  firstAttemptIds.add(id)
}
// Notifies because an entry that's still in the outbox (held after a failed
// first send) starts counting as pending at this point.
export function clearFirstAttempt(id) {
  if (firstAttemptIds.delete(id)) notifyOutboxChanged()
}

export async function listQueuedMutations() {
  const db = await getDb()
  const all = await db.getAll(OUTBOX_STORE)
  return all.sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function removeQueuedMutation(id) {
  const db = await getDb()
  await db.delete(OUTBOX_STORE, id)
  notifyOutboxChanged()
}

// Entries not on a first attempt: held after a connectivity failure, queued
// while offline, or left over from a page closed mid-send.
export async function countPendingMutations() {
  const db = await getDb()
  const ids = await db.getAllKeys(OUTBOX_STORE)
  return ids.filter((id) => !firstAttemptIds.has(id)).length
}

export async function saveSnapshot(clientId, snapshot) {
  const db = await getDb()
  await db.put(SNAPSHOT_STORE, snapshot, clientId)
}

export async function loadSnapshot(clientId) {
  const db = await getDb()
  return db.get(SNAPSHOT_STORE, clientId)
}
