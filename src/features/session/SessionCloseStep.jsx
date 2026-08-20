import { useState } from 'react'

const FIELDS = [
  ['execution_notes', 'Execution notes'],
  ['physical_notes', 'Physical notes'],
  ['machine_changes_notes', 'Machine changes'],
  ['personal_notes', 'Personal notes'],
]

// PRD 5.4 scope for Week 5-7: final coach_notes review, next-session-booked
// flag, then ended_at. The 6-session review gate is separate scope, not
// included here. PRD 6.3 follow-up flag added Week 10 -- same close-time
// slot as next_session_booked; reason required, matching follow_up_flags's
// NOT NULL reason column.
//
// Post-close recap prompt (Week 10): coaches go client to client through a
// block and shouldn't be forced into the recap between every session, but
// PRD 5.7 also wants it done by end of block -- so this is a choice, not a
// gate. "Now" hands off to the Daily Recap screen; "end of block" just
// returns to the client list the same way closing always did. Either way
// the recap stays reachable any time via the header button (DailyRecapScreen
// itself, unchanged).
export function SessionCloseStep({
  notes,
  onSaveNotes,
  onFlagFollowUp,
  onClose,
  onDone,
  onGoToRecap,
}) {
  const [draft, setDraft] = useState({
    execution_notes: notes?.execution_notes ?? '',
    physical_notes: notes?.physical_notes ?? '',
    machine_changes_notes: notes?.machine_changes_notes ?? '',
    personal_notes: notes?.personal_notes ?? '',
  })
  const [nextSessionBooked, setNextSessionBooked] = useState(null)
  const [flagging, setFlagging] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [closing, setClosing] = useState(false)
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState(null)

  async function handleClose() {
    if (flagging && !flagReason.trim()) {
      setError('Reason is required to flag for follow-up.')
      return
    }
    setClosing(true)
    setError(null)
    try {
      const changedFields = Object.entries(draft).filter(
        ([field, value]) => value !== (notes?.[field] ?? '')
      )
      if (changedFields.length > 0) {
        await onSaveNotes(Object.fromEntries(changedFields.map(([k, v]) => [k, v || null])))
      }
      if (flagging) {
        await onFlagFollowUp(flagReason.trim())
      }
      await onClose({ nextSessionBooked })
      setClosed(true)
    } catch (err) {
      setError(err.message)
      setClosing(false)
    }
  }

  if (closed) {
    return (
      <div className="mx-auto max-w-md space-y-6 p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Session closed</h1>
        <p className="text-slate-600">Ready for the daily recap?</p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={onGoToRecap}
            className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-medium text-white transition hover:bg-emerald-700"
          >
            Do recap now
          </button>
          <button
            type="button"
            onClick={onDone}
            className="h-14 w-full rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Do recap at end of block
          </button>
        </div>
      </div>
    )
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

      <div className="space-y-2 rounded-2xl bg-white p-6 shadow">
        <span className="block text-sm font-medium text-slate-700">
          Flag for follow-up?
        </span>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFlagging(true)}
            className={`h-12 rounded-xl border text-sm font-medium transition ${
              flagging
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setFlagging(false)
              setFlagReason('')
            }}
            className={`h-12 rounded-xl border text-sm font-medium transition ${
              !flagging
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            No
          </button>
        </div>
        {flagging && (
          <textarea
            value={flagReason}
            onChange={(event) => setFlagReason(event.target.value)}
            rows={2}
            placeholder="Reason for follow-up (required)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        )}
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
