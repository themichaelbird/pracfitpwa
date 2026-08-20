import { useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { useSupabaseSession } from './lib/useSupabaseSession'
import { LocationSignInScreen } from './features/auth/LocationSignInScreen'
import { CoachPickerScreen } from './features/auth/CoachPickerScreen'
import { ClientListScreen } from './features/clients/ClientListScreen'
import { ClientProfileScreen } from './features/clients/ClientProfileScreen'
import { SessionScreen } from './features/session/SessionScreen'
import { DailyRecapScreen } from './features/recap/DailyRecapScreen'
import { FollowUpFlagQueueScreen } from './features/flags/FollowUpFlagQueueScreen'

function App() {
  const session = useSupabaseSession()
  const [currentCoach, setCurrentCoach] = useState(null)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [inSession, setInSession] = useState(false)
  const [view, setView] = useState(null) // null | 'recap' | 'flags'

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <LocationSignInScreen />
  }

  if (!currentCoach) {
    return <CoachPickerScreen session={session} onCoachSelected={setCurrentCoach} />
  }

  const locationId = session.user.app_metadata.location_id

  if (selectedClientId && inSession) {
    return (
      <SessionScreen
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

  if (selectedClientId) {
    return (
      <ClientProfileScreen
        clientId={selectedClientId}
        coach={currentCoach}
        onBack={() => setSelectedClientId(null)}
        onStartSession={() => setInSession(true)}
      />
    )
  }

  if (view === 'recap') {
    return (
      <DailyRecapScreen
        coach={currentCoach}
        locationId={locationId}
        onBack={() => setView(null)}
      />
    )
  }

  if (view === 'flags') {
    return <FollowUpFlagQueueScreen coach={currentCoach} onBack={() => setView(null)} />
  }

  return (
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
          {currentCoach.role !== 'coach' && (
            <button
              type="button"
              onClick={() => setView('flags')}
              className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
            >
              Follow-up flags
            </button>
          )}
          <button
            type="button"
            onClick={() => setCurrentCoach(null)}
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
      <ClientListScreen onClientSelected={setSelectedClientId} />
    </div>
  )
}

export default App
