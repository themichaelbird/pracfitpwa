import { useEffect, useState } from 'react'

const FIELDS = [
  ['execution_notes', 'Execution notes'],
  ['physical_notes', 'Physical notes'],
  ['machine_changes_notes', 'Machine changes'],
  ['personal_notes', 'Personal notes'],
]

// PRD 5.4/6.3: side panel for the four structured coach_notes fields --
// one row per session, opened from any exercise cell's note icon so the
// coach never leaves the workout view. Autosaves per field on blur.
export function NotesSidePanel({ isOpen, onClose, notes, onSave }) {
  const [draft, setDraft] = useState({
    execution_notes: '',
    physical_notes: '',
    machine_changes_notes: '',
    personal_notes: '',
  })

  useEffect(() => {
    setDraft({
      execution_notes: notes?.execution_notes ?? '',
      physical_notes: notes?.physical_notes ?? '',
      machine_changes_notes: notes?.machine_changes_notes ?? '',
      personal_notes: notes?.personal_notes ?? '',
    })
  }, [notes])

  if (!isOpen) return null

  async function handleBlur(field) {
    if (draft[field] === (notes?.[field] ?? '')) return
    await onSave({ [field]: draft[field] || null })
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm space-y-4 overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Session notes</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {FIELDS.map(([field, label]) => (
          <label key={field} className="block space-y-1">
            <span className="block text-sm font-medium text-slate-700">{label}</span>
            <textarea
              value={draft[field]}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field]: event.target.value }))
              }
              onBlur={() => handleBlur(field)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
