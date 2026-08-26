import { useState } from 'react'
import { TimeNumberPad } from './TimeNumberPad'

function formatSeconds(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// PRD 5.4/13, v0.1: dead-center failure time, mandatory before advancing to
// the next exercise. D exercises tap the field to open the number pad
// directly. M exercises auto-capture from the stopwatch (ExerciseCell sets
// failureTime when the stopwatch stops) and show a read-only value with an
// Override control that opens the same pad on demand. (E exercises don't
// use this component -- they log reps_completed via RepsNumberPad instead;
// see ExerciseCell.jsx.)
export function FailureTimeInput({ movementClassification, failureTime, stopwatchElapsed, onChange }) {
  const [open, setOpen] = useState(false)

  function handleDone(seconds) {
    onChange(seconds)
    setOpen(false)
  }

  if (movementClassification !== 'M') {
    if (open) {
      return <TimeNumberPad initialSeconds={failureTime} onDone={handleDone} />
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-slate-50 py-1 text-center text-lg font-semibold text-slate-900 hover:bg-slate-100"
      >
        {formatSeconds(failureTime)}
      </button>
    )
  }

  if (open) {
    return <TimeNumberPad initialSeconds={failureTime ?? stopwatchElapsed} onDone={handleDone} />
  }

  return (
    <div className="space-y-0.5 text-center">
      <p className="text-lg font-semibold text-slate-900">{formatSeconds(failureTime)}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-medium text-slate-400 underline hover:text-slate-600"
      >
        Override
      </button>
    </div>
  )
}
