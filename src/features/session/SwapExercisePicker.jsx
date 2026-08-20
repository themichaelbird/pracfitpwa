import { useEffect, useState } from 'react'

// PRD 8.2: Type D swap is a behavior available on any exercise ("Type D --
// Conditional swap -- Any exercise"), not a fourth row category -- no
// exercise in the seed data is ever tagged exercise_type='D'. Opened by a
// one-tap swap trigger on any cell; any active exercise may be picked as
// the replacement. Original preserved via original_exercise_id, replacement
// logged as
// exercise_id, reason required free text (matches the settings-audit
// reason pattern in MachineSettingsCell). Available both before
// failure_time is committed (session open) and after (mid-set) --
// useSessionCore.swapExercise branches on draft.logId to decide whether
// that's a local-only draft edit or a write to the existing
// session_exercise_logs row.
export function SwapExercisePicker({ isOpen, row, currentExerciseId, exercises, onClose, onConfirm }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedId(null)
      setReason('')
      setError(null)
    }
  }, [isOpen, row])

  if (!isOpen) return null

  const candidates = exercises.filter((exercise) => {
    if (exercise.id === currentExerciseId) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      exercise.abbreviation.toLowerCase().includes(q) || exercise.name.toLowerCase().includes(q)
    )
  })

  async function handleConfirm() {
    if (!selectedId) {
      setError('Select a replacement exercise.')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm({ exerciseId: selectedId, reason: reason.trim() })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col gap-4 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Swap {row?.abbreviation}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises"
          className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        <div className="flex-1 space-y-1 overflow-y-auto">
          {candidates.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => setSelectedId(exercise.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === exercise.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{exercise.name}</span>
              <span className="text-xs opacity-70">
                {exercise.abbreviation}
                {exercise.id === row?.exerciseId ? ' · original' : ''}
              </span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">No matching exercises.</p>
          )}
        </div>

        <label className="block space-y-1">
          <span className="block text-sm font-medium text-slate-700">Reason for swap</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm swap'}
          </button>
        </div>
      </div>
    </div>
  )
}
