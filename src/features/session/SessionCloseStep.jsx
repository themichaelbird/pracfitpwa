import { useState } from 'react'

const FIELDS = [
  ['execution_notes', 'Execution notes'],
  ['physical_notes', 'Physical notes'],
  ['machine_changes_notes', 'Machine changes'],
  ['personal_notes', 'Personal notes'],
]

// PRD 5.4 scope for Week 5-7: final coach_notes review, next-session-booked
// flag, then ended_at. The 6-session review gate is separate scope, not
// included here.
export function SessionCloseStep({ notes, onSaveNotes, onClose }) {
  const [draft, setDraft] = useState({
    execution_notes: notes?.execution_notes ?? '',
    physical_notes: notes?.physical_notes ?? '',
    machine_changes_notes: notes?.machine_changes_notes ?? '',
    personal_notes: notes?.personal_notes ?? '',
  })
  const [nextSessionBooked, setNextSessionBooked] = useState(null)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(null)

  async function handleClose() {
    setClosing(true)
    setError(null)
    try {
      const changedFields = Object.entries(draft).filter(
        ([field, value]) => value !== (notes?.[field] ?? '')
      )
      if (changedFields.length > 0) {
        await onSaveNotes(Object.fromEntries(changedFields.map(([k, v]) => [k, v || null])))
      }
      await onClose({ nextSessionBooked })
    } catch (err) {
      setError(err.message)
      setClosing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-center text-xl font-semibold text-slate-900">Close session</h1>

      <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
        {FIELDS.map(([field, label]) => (
          <label key={field} className="block space-y-1">
            <span className="block text-sm font-medium text-slate-700">{label}</span>
            <textarea
              value={draft[field]}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field]: event.target.value }))
              }
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-6 shadow">
        <span className="block text-sm font-medium text-slate-700">Next session booked?</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setNextSessionBooked(true)}
            className={`h-12 rounded-xl border text-sm font-medium transition ${
              nextSessionBooked === true
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setNextSessionBooked(false)}
            className={`h-12 rounded-xl border text-sm font-medium transition ${
              nextSessionBooked === false
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            No
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
        onClick={handleClose}
        disabled={closing}
        className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {closing ? 'Closing…' : 'Close Session'}
      </button>
    </div>
  )
}
