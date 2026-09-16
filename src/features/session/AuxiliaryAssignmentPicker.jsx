import { useEffect, useMemo, useState } from 'react'
import { matchesExerciseQuery } from './exerciseSearch'

const CLASSIFICATIONS = [
  ['D', 'Dynamic'],
  ['M', 'Metabolic'],
  ['E', 'Eccentric'],
]

// v0.2 req #5/#15: assigns Auxiliary A or B from the session view. Unlike
// the old (removed) ExerciseOrderSetupScreen, candidates are the full
// active exercise catalog -- any exercise, any movement classification, not
// just Type C -- and the coach sets D/M/E at assignment time rather than
// always inheriting the exercise's database default.
export function AuxiliaryAssignmentPicker({ isOpen, slot, exercises, onClose, onConfirm }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [classification, setClassification] = useState('D')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedId(null)
      setClassification('D')
      setError(null)
    }
  }, [isOpen, slot])

  const candidates = useMemo(() => {
    return exercises.filter((exercise) => matchesExerciseQuery(exercise, query))
  }, [exercises, query])

  if (!isOpen) return null

  function selectExercise(exercise) {
    setSelectedId(exercise.id)
    setClassification(exercise.default_movement_classification)
  }

  async function handleConfirm() {
    if (!selectedId) {
      setError('Select an exercise.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm({ exerciseId: selectedId, movementClassification: classification })
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
          <h2 className="text-lg font-semibold text-slate-900">Set Auxiliary {slot}</h2>
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
              onClick={() => selectExercise(exercise)}
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

        {selectedId && (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Movement classification</span>
            <div className="grid grid-cols-3 gap-2">
              {CLASSIFICATIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setClassification(value)}
                  className={`h-11 rounded-xl border text-sm font-medium transition ${
                    classification === value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

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
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
