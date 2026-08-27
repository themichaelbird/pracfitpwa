import { useState } from 'react'

const SET_TYPES = [
  ['S', 'Strength · 1:30'],
  ['T', 'Tone · 2:15'],
  ['E', 'Endurance · 3:00'],
]

// v0.2 req #4/#7: replaces StartSessionGate. Opened from the prominent
// "Begin Session" button in SessionWorkspace.jsx once the client has
// arrived -- collects the two fields that used to live on the pre-session
// gate screen (set type, unscheduled walk-in) minus session_type
// (recurring/flex), which is gone entirely. Confirming here does not itself
// create the session record -- SessionScreen.jsx runs the review gate (if
// due) first, then calls core.beginSession with these values.
export function BeginSessionPanel({ isOpen, onClose, onConfirm, error }) {
  const [setType, setSetType] = useState('S')
  const [isUnscheduled, setIsUnscheduled] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm({ setType, isUnscheduled })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-center text-xl font-semibold text-slate-900">Begin Session</h2>

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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="h-14 flex-[2] rounded-xl bg-emerald-600 text-lg font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Begin Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
