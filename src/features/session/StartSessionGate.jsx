import { useState } from 'react'

const SESSION_TYPES = [
  ['recurring', 'Recurring'],
  ['flex', 'Flex'],
]

const SET_TYPES = [
  ['S', 'Strength · 1:30'],
  ['T', 'Tone · 2:15'],
  ['E', 'Endurance · 3:00'],
]

// PRD 5.4: client name shown above the button to prevent an accidental
// start. No sessions row exists until Start Session is tapped -- session_type
// and set_type are picked here, before the workout begins. PRD 5.8: an
// unscheduled walk-in is otherwise identical to this same flow (client
// search -> profile -> Start Session) -- the one thing that actually
// differs is status, and there's no schedule to compare against to infer
// it automatically, so the coach declares it explicitly here.
export function StartSessionGate({ client, onStart }) {
  const [sessionType, setSessionType] = useState('recurring')
  const [setType, setSetType] = useState('S')
  const [isUnscheduled, setIsUnscheduled] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  async function handleStart() {
    setStarting(true)
    setError(null)
    try {
      await onStart({ sessionType, setType, isUnscheduled })
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 text-center shadow">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Ready to start session for
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
        </div>

        <div className="space-y-2 text-left">
          <span className="block text-sm font-medium text-slate-700">Session type</span>
          <div className="grid grid-cols-2 gap-3">
            {SESSION_TYPES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSessionType(value)}
                className={`h-12 rounded-xl border text-sm font-medium transition ${
                  sessionType === value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-left">
          <span className="block text-sm font-medium text-slate-700">Set type</span>
          <div className="grid grid-cols-3 gap-3">
            {SET_TYPES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSetType(value)}
                className={`h-14 rounded-xl border text-sm font-medium transition ${
                  setType === value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-left">
          <span className="block text-sm font-medium text-slate-700">Unscheduled walk-in?</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsUnscheduled(false)}
              className={`h-12 rounded-xl border text-sm font-medium transition ${
                !isUnscheduled
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setIsUnscheduled(true)}
              className={`h-12 rounded-xl border text-sm font-medium transition ${
                isUnscheduled
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Yes
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {starting ? 'Starting…' : 'Start Session'}
        </button>
      </div>
    </div>
  )
}
