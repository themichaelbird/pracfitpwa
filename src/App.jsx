import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { loadSnapshot } from './lib/offlineQueue'
import { clearCurrentCoach, readRestorableCoach, saveCurrentCoach } from './lib/restoredCoach'
import { useSupabaseSession, WAITING_FOR_CONNECTION } from './lib/useSupabaseSession'
import { LocationSignInScreen } from './features/auth/LocationSignInScreen'
import { CoachPickerScreen } from './features/auth/CoachPickerScreen'
import { ManagerModeToggle } from './features/auth/ManagerModeToggle'
import { ClientListScreen } from './features/clients/ClientListScreen'
import { ClientCreateScreen } from './features/clients/ClientCreateScreen'
import { ClientProfileScreen } from './features/clients/ClientProfileScreen'
import { SessionHistoryScreen } from './features/clients/SessionHistoryScreen'
import { SessionScreen } from './features/session/SessionScreen'
import { DailyRecapScreen } from './features/recap/DailyRecapScreen'
import { ManagerDashboardScreen } from './features/admin/ManagerDashboardScreen'

function App() {
  const session = useSupabaseSession()
  // Accidental-close recovery (src/lib/restoredCoach.js): the coach comes
  // back if the app was in use within the last few minutes, with a banner
  // saying so. activeManager is deliberately never restored.
  const [restored] = useState(readRestorableCoach)
  const [currentCoach, setCurrentCoach] = useState(() => restored?.coach ?? null)
  const [coachRestored, setCoachRestored] = useState(() => Boolean(restored))
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [inSession, setInSession] = useState(false)
  // Back into the session screen only if this device's copy of that
  // client's session is still open -- the snapshot works offline, which is
  // the case this exists for.
  const [restoringSession, setRestoringSession] = useState(() => Boolean(restored?.inSession && restored.clientId))
  const [viewingHistory, setViewingHistory] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [view, setView] = useState(null) // null | 'recap' | 'dashboard'
  const [activeManager, setActiveManager] = useState(null) // PRD 6.9 manager mode toggle

  useEffect(() => {
    if (!restoringSession) return
    let cancelled = false
    loadSnapshot(restored.clientId)
      .then((snapshot) => {
        if (cancelled || !snapshot?.session || snapshot.session.ended_at) return
        setSelectedClientId(restored.clientId)
        setInSession(true)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestoringSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [restoringSession, restored])

  // Kept current on every navigation change and refreshed when the page is
  // hidden (the last reliable moment before an accidental close). Signing
  // out or switching coach clears it.
  useEffect(() => {
    if (restoringSession || session === undefined || session === WAITING_FOR_CONNECTION) return
    if (!session || !currentCoach) {
      clearCurrentCoach()
      return
    }
    const save = () => saveCurrentCoach(currentCoach, { clientId: selectedClientId, inSession })
    save()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [session, currentCoach, selectedClientId, inSession, restoringSession])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  if (session === WAITING_FOR_CONNECTION) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-lg font-medium text-slate-900">Waiting for a connection…</p>
          <p className="text-slate-600">
            This device is still signed in. It'll continue automatically once it's back online.
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LocationSignInScreen />
  }

  if (!currentCoach) {
    return (
      <CoachPickerScreen
        session={session}
        onCoachSelected={(coach) => {
          setCurrentCoach({ ...coach, selectedAt: Date.now() })
          setCoachRestored(false)
        }}
      />
    )
  }

  if (restoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  function switchCoach() {
    setCurrentCoach(null)
    setActiveManager(null)
    setCoachRestored(false)
  }

  // Never silent: a restored coach is named on every screen until they
  // dismiss it or someone switches coach. Switching from here also leaves
  // the restored session, which belongs to the previous coach.
  const restoredBanner = coachRestored ? (
    <div className="flex items-center justify-between gap-3 bg-amber-100 px-6 py-2 text-sm text-amber-900">
      <span>
        Signed in as <span className="font-medium">{currentCoach.name}</span> (restored) — Not you?
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            switchCoach()
            setInSession(false)
            setSelectedClientId(null)
          }}
          className="h-9 rounded-lg bg-white px-3 font-medium text-amber-900 hover:bg-amber-50"
        >
          Switch coach
        </button>
        <button
          type="button"
          onClick={() => setCoachRestored(false)}
          aria-label="Dismiss"
          className="h-9 w-9 rounded-lg text-amber-900 hover:bg-amber-200"
        >
          ✕
        </button>
      </div>
    </div>
  ) : null

  const withRestoredBanner = (screen) =>
    restoredBanner ? (
      <>
        {restoredBanner}
        {screen}
      </>
    ) : (
      screen
    )

  const locationId = session.user.app_metadata.location_id

  // The session screen places the banner itself (not withRestoredBanner):
  // its workspace step is exactly one screen tall, so the banner has to sit
  // inside that height rather than above it, or it pushes the footer off
  // the bottom of the screen.
  if (selectedClientId && inSession) {
    return (
      <SessionScreen
        banner={restoredBanner}
        clientId={selectedClientId}
        coach={currentCoach}
        onBack={() => {
          setInSession(false)
          setSelectedClientId(null)
        }}
        onGoToRecap={() => {
          setInSession(false)
          setSelectedClientId(null)
          setView('recap')
        }}
      />
    )
  }

  if (selectedClientId && viewingHistory) {
    return withRestoredBanner(
      <SessionHistoryScreen
        clientId={selectedClientId}
        onBack={() => setViewingHistory(false)}
      />
    )
  }

  if (selectedClientId) {
    return withRestoredBanner(
      <ClientProfileScreen
        clientId={selectedClientId}
        coach={currentCoach}
        onBack={() => setSelectedClientId(null)}
        onStartSession={() => setInSession(true)}
        onViewHistory={() => setViewingHistory(true)}
      />
    )
  }

  if (creatingClient) {
    return withRestoredBanner(
      <ClientCreateScreen
        locationId={locationId}
        onBack={() => setCreatingClient(false)}
        onCreated={(newClientId) => {
          setCreatingClient(false)
          setSelectedClientId(newClientId)
        }}
      />
    )
  }

  if (view === 'recap') {
    return withRestoredBanner(
      <DailyRecapScreen
        coach={currentCoach}
        locationId={locationId}
        onBack={() => setView(null)}
      />
    )
  }

  if (view === 'dashboard' && activeManager) {
    return withRestoredBanner(<ManagerDashboardScreen coach={activeManager} onBack={() => setView(null)} />)
  }

  return withRestoredBanner(
    <div>
      <div className="flex items-center justify-between bg-white px-6 py-3 shadow">
        <span className="text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{currentCoach.name}</span>
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setView('recap')}
            className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
          >
            Daily Recap
          </button>
          {activeManager && (
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
            >
              Manager Dashboard
            </button>
          )}
          <ManagerModeToggle
            session={session}
            activeManager={activeManager}
            onActivate={setActiveManager}
            onDeactivate={() => {
              setActiveManager(null)
              setView(null)
            }}
          />
          <button
            type="button"
            onClick={switchCoach}
            className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
          >
            Switch coach
          </button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
          >
            Sign out of location
          </button>
        </div>
      </div>
      <ClientListScreen
        onClientSelected={(clientId) => {
          setInSession(false)
          setViewingHistory(false)
          setSelectedClientId(clientId)
        }}
        onCreateClient={() => setCreatingClient(true)}
      />
    </div>
  )
}

export default App
