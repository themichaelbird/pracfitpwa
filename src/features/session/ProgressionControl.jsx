import { useState } from 'react'

// PRD 5.4/13: bottom-right progression indicator -- coach sets +amount,
// -amount, or OK (stored as progression 'hold', per the schema check
// constraint on session_exercise_logs.progression).
export function ProgressionControl({ progression, progressionAmount, onChange }) {
  const [editingAmount, setEditingAmount] = useState(false)

  function selectHold() {
    onChange('hold', null)
    setEditingAmount(false)
  }

  function selectDirection(direction) {
    onChange(direction, progressionAmount ?? 0)
    setEditingAmount(true)
  }

  if (editingAmount && (progression === 'up' || progression === 'down')) {
    return (
      <div className="flex flex-1 items-center gap-1">
        <span className="text-xs font-medium text-slate-600">
          {progression === 'up' ? '+' : '−'}
        </span>
        <input
          type="number"
          inputMode="decimal"
          value={progressionAmount ?? ''}
          onChange={(event) =>
            onChange(progression, event.target.value === '' ? '' : Number(event.target.value))
          }
          onBlur={() => setEditingAmount(false)}
          autoFocus
          className="h-8 w-12 rounded border border-slate-300 px-1 text-xs"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 gap-1">
      <button
        type="button"
        onClick={() => selectDirection('down')}
        className={`h-8 flex-1 rounded text-xs font-bold ${
          progression === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {progression === 'down' ? `−${progressionAmount ?? ''}` : '−'}
      </button>
      <button
        type="button"
        onClick={selectHold}
        className={`h-8 flex-1 rounded text-xs font-bold ${
          progression === 'hold' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => selectDirection('up')}
        className={`h-8 flex-1 rounded text-xs font-bold ${
          progression === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {progression === 'up' ? `+${progressionAmount ?? ''}` : '+'}
      </button>
    </div>
  )
}
