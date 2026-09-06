import { useState } from 'react'

const LABELS = { D: 'Dynamic', M: 'Metabolic', E: 'Eccentric' }
const ALL = ['D', 'M', 'E']

const CLASSIFICATION_COLOR = {
  D: 'bg-sky-100 text-sky-700',
  M: 'bg-amber-100 text-amber-700',
  E: 'bg-violet-100 text-violet-700',
}

// Req #5 (this task): the D/M/E badge is now a picker trigger rather than a
// static label -- tapping it offers the other two classifications. Selecting
// one applies a session-only override by default (PRD 21.2: doesn't touch
// the stored default); checking "Make permanent" first routes the same
// selection to also update the client's stored default in
// ClientExerciseOrder (see useSessionCore.changeMovementClassification).
export function MovementClassificationPicker({ current, onSelect }) {
  const [open, setOpen] = useState(false)
  const [permanent, setPermanent] = useState(false)

  const options = ALL.filter((value) => value !== current)

  function selectValue(value) {
    onSelect(value, permanent)
    setOpen(false)
    setPermanent(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-[10px] font-bold ${CLASSIFICATION_COLOR[current]}`}
        aria-label="Change movement classification"
      >
        {current}
      </button>

      {open && (
        <>
          {/* Click-outside catcher, same pattern as other in-cell popovers */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="space-y-1">
              {options.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectValue(value)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:opacity-80 ${CLASSIFICATION_COLOR[value]}`}
                >
                  <span>{value}</span>
                  <span>{LABELS[value]}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(event) => setPermanent(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Make permanent
            </label>
          </div>
        </>
      )}
    </div>
  )
}
