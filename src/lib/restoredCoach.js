// Accidental-close recovery for the selected coach (App.jsx). The coach
// picker needs the server (coach list, PIN check), so without this an app
// closed mid-session while offline can't get back in until the connection
// returns. Restored only within a short window, since this is attribution on
// a shared device -- App shows a "restored, not you?" banner either way.
// Manager Mode is never stored here: it always needs its PIN again.
//
// localStorage, not sessionStorage: a killed home-screen app starts a new
// browsing session, which clears sessionStorage.
const KEY = 'pracfit-current-coach'
export const COACH_RESTORE_MAX_AGE_MS = 20 * 60 * 1000

// lastActiveAt is refreshed on every navigation change and whenever the page
// is hidden, so the window counts from when the app was last in use -- not
// from selectedAt, which would rule out any session longer than the window.
export function saveCurrentCoach(coach, { clientId, inSession }) {
  try {
    const record = {
      id: coach.id,
      name: coach.name,
      role: coach.role,
      pinOverrideUsed: coach.pinOverrideUsed ?? false,
      selectedAt: coach.selectedAt,
      lastActiveAt: Date.now(),
      clientId: clientId ?? null,
      inSession: Boolean(inSession),
    }
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Storage blocked: the coach just picks themselves again after a close.
  }
}

export function clearCurrentCoach() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing stored to clear
  }
}

export function readRestorableCoach() {
  try {
    const record = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!record?.id || !(Date.now() - record.lastActiveAt < COACH_RESTORE_MAX_AGE_MS)) {
      localStorage.removeItem(KEY)
      return null
    }
    const { clientId, inSession, lastActiveAt: _lastActiveAt, ...coach } = record
    return { coach, clientId, inSession }
  } catch {
    return null
  }
}
