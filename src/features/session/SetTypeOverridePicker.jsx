import { useState } from 'react'

const SET_TYPE_LABELS = { S: 'Strength', T: 'Tone', E: 'Endurance' }
const ALL_SET_TYPES = ['S', 'T', 'E']

// This task, item 1: the per-exercise set-type override didn't have any UI
// before this -- session_exercise_logs.set_type_override/_value existed and
// ExerciseCell displayed the override label, but nothing ever wrote them.
// Mirrors MovementClassificationPicker's badge-picker pattern. Picking the
// session's own set type clears the override (nothing to override); picking
// anything else sets it.
export function SetTypeOverridePicker({ sessionSetType, overrideValue, onSelect }) {
  const [open, setOpen] = useState(false)
  const current = overrideValue ?? sessionSetType

  function selectValue(value) {
    if (value === sessionSetType) {
      onSelect(false, null)
    } else {
      onSelect(true, value)
    }
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
        aria-label="Change set type for this exercise"
      >
        {SET_TYPE_LABELS[current] ?? current}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-40 space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {ALL_SET_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => selectValue(value)}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium ${
                  value === current
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{value}</span>
                <span>{SET_TYPE_LABELS[value]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
