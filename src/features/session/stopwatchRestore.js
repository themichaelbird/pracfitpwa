// Accidental-close recovery for the shared session stopwatch
// (SessionWorkspace.jsx). Its running state otherwise lives only in memory,
// so a close mid-set lost when the set started -- and with it an M
// exercise's auto-captured failure time. Written synchronously on start
// (localStorage, not IndexedDB) so it's on disk before the app can be
// killed; cleared on stop, reset and capture.
const KEY = 'pracfit-stopwatch'

// A set takes a couple of minutes; a stopwatch still "running" after this
// long was abandoned, not interrupted.
export const STOPWATCH_RESTORE_MAX_AGE_MS = 30 * 60 * 1000

export function saveRunningStopwatch({ sessionId, exerciseId, startedAt }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sessionId, exerciseId, startedAt }))
  } catch {
    // storage blocked: the stopwatch still works, it just won't survive a close
  }
}

export function clearRunningStopwatch() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing stored to clear
  }
}

export function readRunningStopwatch() {
  try {
    const record = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (record && Date.now() - record.startedAt < STOPWATCH_RESTORE_MAX_AGE_MS) return record
    localStorage.removeItem(KEY)
  } catch {
    // unreadable: nothing to restore
  }
  return null
}
