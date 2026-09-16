import { useEffect, useMemo, useState } from 'react'
import { matchesExerciseQuery } from './exerciseSearch'

// v0.2 req #13: "Add More" -- the full exercise list, any movement
// classification, opened from the row after the client's assigned
// exercises. Adding one saves permanently to the client's exercise order
// (see useSessionCore.addExerciseToOrder). Simpler than SwapExercisePicker:
// no reason field, just pick and confirm.
export function AddExercisePicker({ isOpen, exercises, existingExerciseIds, onClose, onConfirm }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedId(null)
      setError(null)
    }
  }, [isOpen])

  const candidates = useMemo(() => {
    return exercises.filter((exercise) => {
      if (existingExerciseIds.includes(exercise.id)) return false
      return matchesExerciseQuery(exercise, query)
    })
  }, [exercises, existingExerciseIds, query])

  if (!isOpen) return null

  async function handleConfirm() {
    if (!selectedId) {
      setError('Select an exercise.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm(selectedId)
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
          <h2 className="text-lg font-semibold text-slate-900">Add exercise</h2>
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
              <span className="text-xs opacity-70">{exercise.abbreviation}</span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">No matching exercises.</p>
          )}
        </div>

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
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
