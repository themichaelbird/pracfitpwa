import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { verifyCoachLogin } from '../../lib/auth'

const PIN_LENGTH = 4
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

// PRD 6.9: "Manager mode -- Toggle within same app; each manager has
// unique manager code." A toggle layered on top of the signed-in coach's
// session, not a replacement of it (that's what "Switch coach" already
// does) -- a manager can step in to check something and step back out
// without disrupting the coach's in-progress identity/session. Reuses
// verifyCoachLogin (src/lib/auth.js) unchanged; deliberately a new
// component rather than refactoring CoachPickerScreen.jsx, so the
// already-verified coach login flow stays untouched. "Manager code" is
// each manager's own PIN -- there's no separate secret field in the
// schema, and the auth model's README already documents manager-code
// checks as app-side, same mechanism as coach PIN verification.
export function ManagerModeToggle({ session, activeManager, onActivate, onDeactivate }) {
  const [open, setOpen] = useState(false)
  const [managers, setManagers] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [selectedManager, setSelectedManager] = useState(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const authRole = session?.user?.app_metadata?.role
  const locationId = session?.user?.app_metadata?.location_id

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadManagers() {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, home_location_id')
        .eq('is_active', true)
        .in('role', ['manager', 'owner'])
        .order('name')

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        return
      }
      const scoped =
        authRole === 'owner' ? data : data.filter((m) => m.home_location_id === locationId)
      setManagers(scoped)
    }

    loadManagers()
    return () => {
      cancelled = true
    }
  }, [open, authRole, locationId])

  function closePanel() {
    setOpen(false)
    setSelectedManager(null)
    setPin('')
    setPinError(null)
  }

  async function submitPin(candidatePin) {
    setVerifying(true)
    setPinError(null)
    try {
      const result = await verifyCoachLogin(selectedManager.id, candidatePin)
      if (result.ok) {
        onActivate(selectedManager)
        closePanel()
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

  if (activeManager) {
    return (
      <button
        type="button"
        onClick={onDeactivate}
        className="h-11 rounded-xl bg-emerald-100 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
      >
        Exit Manager Mode ({activeManager.name})
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
      >
        Manager Mode
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-end bg-black/20"
          onClick={closePanel}
        >
          <div
            className="mt-16 mr-6 w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {!selectedManager ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Manager Mode</h2>
                {loadError && <p className="text-sm text-red-600">{loadError}</p>}
                {managers === null && !loadError && (
                  <p className="text-sm text-slate-500">Loading…</p>
                )}
                {managers?.length === 0 && (
                  <p className="text-sm text-slate-500">No managers found for this location.</p>
                )}
                <div className="space-y-2">
                  {managers?.map((manager) => (
                    <button
                      key={manager.id}
                      type="button"
                      onClick={() => setSelectedManager(manager)}
                      className="block w-full rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                      {manager.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="h-10 w-full rounded-xl text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">{selectedManager.name}</h2>
                <p className="text-sm text-slate-600">Enter manager PIN</p>

                <div className="flex justify-center gap-3" aria-live="polite">
                  {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-3 w-3 rounded-full ${
                        index < pin.length ? 'bg-slate-900' : 'bg-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p role="alert" className="text-center text-sm text-red-600">
                    {pinError}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {KEYPAD_KEYS.map((key, index) =>
                    key === '' ? (
                      <div key={`spacer-${index}`} />
                    ) : (
                      <button
                        key={key}
                        type="button"
                        disabled={verifying}
                        onClick={() => handleKeyPress(key)}
                        className="h-12 rounded-xl bg-slate-100 text-lg font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        {key === 'back' ? '⌫' : key}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedManager(null)
                    setPin('')
                    setPinError(null)
                  }}
                  className="h-10 w-full rounded-xl text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
