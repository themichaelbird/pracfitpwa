import { useState } from 'react'
import { ScrollTimePicker } from './ScrollTimePicker'

function formatSeconds(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// PRD 5.4/13: dead-center failure time, mandatory before advancing to the
// next exercise. D/E exercises use the scroll-wheel picker directly. M
// exercises auto-capture from the stopwatch (ExerciseCell sets failureTime
// when the stopwatch stops) and show a read-only value with an Override
// control that reveals the same picker on demand.
export function FailureTimeInput({ movementClassification, failureTime, stopwatchElapsed, onChange }) {
  const [overriding, setOverriding] = useState(false)

  if (movementClassification !== 'M') {
    return <ScrollTimePicker seconds={failureTime} onChange={onChange} />
  }

  if (overriding) {
    return (
      <div className="space-y-1">
        <ScrollTimePicker seconds={failureTime ?? stopwatchElapsed} onChange={onChange} />
        <button
          type="button"
          onClick={() => setOverriding(false)}
          className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 text-center">
      <p className="text-lg font-semibold text-slate-900">{formatSeconds(failureTime)}</p>
      <button
        type="button"
        onClick={() => setOverriding(true)}
        className="text-[10px] font-medium text-slate-400 underline hover:text-slate-600"
      >
        Override
      </button>
    </div>
  )
}
