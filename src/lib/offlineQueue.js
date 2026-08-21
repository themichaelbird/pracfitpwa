import { openDB } from 'idb'

const DB_NAME = 'pracfit-offline'
const DB_VERSION = 1
const OUTBOX_STORE = 'outbox'
const SNAPSHOT_STORE = 'snapshots'

// PRD 7/9.2: "iPad caches session data in IndexedDB -> pushes to Supabase
// on reconnect." Two stores:
//   outbox    -- queued mutations made while offline, replayed in order on
//                reconnect (see mutateOnlineOrQueue.js).
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

// mutation: { id, kind: 'insert'|'update'|'upsert'|'rpc', table?, payload?, matchId?, onConflict?, name?, params? }
// id is the caller's own client-generated UUID (see mutateOnlineOrQueue.js) --
// reused as the outbox entry's key so the same mutation is never queued twice.
export async function enqueueMutation(mutation) {
  const db = await getDb()
  const entry = { ...mutation, queuedAt: Date.now() }
  await db.put(OUTBOX_STORE, entry)
  notifyOutboxChanged()
  return entry
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

export async function countQueuedMutations() {
  const db = await getDb()
  return db.count(OUTBOX_STORE)
}

export async function saveSnapshot(clientId, snapshot) {
  const db = await getDb()
  await db.put(SNAPSHOT_STORE, snapshot, clientId)
}

export async function loadSnapshot(clientId) {
  const db = await getDb()
  return db.get(SNAPSHOT_STORE, clientId)
}
