import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { verifyCoachLogin } from '../../lib/auth'

const PIN_LENGTH = 4
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

// PRD 5.1: select name, enter PIN. Attribution only -- this identifies
// which coach/manager/owner is acting on an already-authenticated
// location device, it doesn't change the underlying Supabase Auth session.
export function CoachPickerScreen({ session, onCoachSelected }) {
  const [coaches, setCoaches] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)
  const [selectedCoach, setSelectedCoach] = useState(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const role = session?.user?.app_metadata?.role
  const locationId = session?.user?.app_metadata?.location_id

  useEffect(() => {
    let cancelled = false

    async function loadCoaches() {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, home_location_id')
        .eq('is_active', true)
        .order('name')

      if (cancelled) return

      if (error) {
        setLoadError(error.message)
        return
      }

      const scoped =
        role === 'owner'
          ? data
          : data.filter((coach) => coach.home_location_id === locationId)

      setCoaches(scoped)
    }

    loadCoaches()
    return () => {
      cancelled = true
    }
  }, [role, locationId])

  function selectCoach(coach) {
    setSelectedCoach(coach)
    setPin('')
    setPinError(null)
  }

  function backToCoachList() {
    setSelectedCoach(null)
    setPin('')
    setPinError(null)
  }

  async function submitPin(candidatePin) {
    setVerifying(true)
    setPinError(null)
    try {
      const result = await verifyCoachLogin(selectedCoach.id, candidatePin)
      if (result.ok) {
        onCoachSelected({
          id: selectedCoach.id,
          name: selectedCoach.name,
          role: selectedCoach.role,
          pinOverrideUsed: result.overrideUsed,
        })
        return
      }
      setPinError('Incorrect PIN. Try again.')
      setPin('')
    } catch (err) {
      setPinError(err.message)
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  function handleKeyPress(key) {
    if (verifying || key === '') return

    if (key === 'back') {
      setPin((current) => current.slice(0, -1))
      return
    }

    if (pin.length >= PIN_LENGTH) return

    const nextPin = pin + key
    setPin(nextPin)
    if (nextPin.length === PIN_LENGTH) {
      submitPin(nextPin)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="max-w-md text-center text-red-600">
          Couldn't load coaches: {loadError}
        </p>
      </div>
    )
  }

  if (!selectedCoach) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <h1 className="text-center text-2xl font-semibold text-slate-900">
            Who's logging in?
          </h1>

          {coaches === null ? (
            <p className="text-center text-slate-600">Loading coaches…</p>
          ) : coaches.length === 0 ? (
            <p className="text-center text-slate-600">
              No active coaches found for this location.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {coaches.map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => selectCoach(coach)}
                  className="min-h-[44px] rounded-2xl bg-white px-6 py-6 text-lg font-medium text-slate-900 shadow transition hover:bg-slate-50"
                >
                  {coach.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-center shadow">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            {selectedCoach.name}
          </h1>
          <p className="text-slate-600">Enter your 4-digit PIN</p>
        </div>

        <div className="flex justify-center gap-3" aria-live="polite">
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className={`h-4 w-4 rounded-full ${
                index < pin.length ? 'bg-slate-900' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>

        {pinError && (
          <p role="alert" className="text-sm text-red-600">
            {pinError}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {KEYPAD_KEYS.map((key, index) =>
            key === '' ? (
              <div key={`spacer-${index}`} />
            ) : (
              <button
                key={key}
                type="button"
                disabled={verifying}
                onClick={() => handleKeyPress(key)}
                className="h-16 rounded-xl bg-slate-100 text-xl font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {key === 'back' ? '⌫' : key}
              </button>
            ),
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={backToCoachList}
            className="h-11 w-full rounded-xl text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
          <p className="text-xs text-slate-400">Forgot your PIN? Enter 2222.</p>
        </div>
      </div>
    </div>
  )
}
