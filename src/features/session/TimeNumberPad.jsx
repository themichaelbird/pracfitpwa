import { useState } from 'react'

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Buffer is up to 3 raw digits: 1 digit of minutes, 2 digits of seconds,
// interpreted calculator-style (right-to-left) and normalized through
// formatSeconds -- so a buffer like "199" (typed 1, 9, 9) reads as 1 minute
// + 99 "seconds" and self-carries into a valid 2:39 rather than showing an
// impossible clock face.
function bufferToSeconds(buffer) {
  if (!buffer) return 0
  const padded = buffer.padStart(3, '0')
  const minutes = Number(padded[0])
  const seconds = Number(padded.slice(1))
  return minutes * 60 + seconds
}

function secondsToBuffer(totalSeconds) {
  if (totalSeconds == null || totalSeconds <= 0) return ''
  const minutes = Math.min(9, Math.floor(totalSeconds / 60))
  const secs = totalSeconds % 60
  return `${minutes}${String(secs).padStart(2, '0')}`
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// v0.1: large number pad for failure time entry, replacing the scroll-wheel
// picker (PRD 16: "design the scroll-wheel picker to be fast (under 3
// taps)" -- coaches asked for something bigger/quicker instead). Pops up
// anchored to the failure-time field, not a blocking modal, per PRD 13.3
// "no modals during active logging -- everything inline or in attached
// panels." Value format matches the spec examples (1:22, 0:45).
export function TimeNumberPad({ initialSeconds, onDone }) {
  const [buffer, setBuffer] = useState(secondsToBuffer(initialSeconds))
  const seconds = bufferToSeconds(buffer)

  function tapDigit(digit) {
    setBuffer((current) => (current + digit).slice(-3))
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-center text-3xl font-semibold tabular-nums text-slate-900">
        {formatSeconds(seconds)}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => tapDigit(digit)}
            className="h-12 rounded-lg bg-slate-100 text-xl font-medium text-slate-900 hover:bg-slate-200"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBuffer('')}
          className="h-12 rounded-lg bg-slate-100 text-sm font-medium text-slate-500 hover:bg-slate-200"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => tapDigit('0')}
          className="h-12 rounded-lg bg-slate-100 text-xl font-medium text-slate-900 hover:bg-slate-200"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setBuffer((current) => current.slice(0, -1))}
          aria-label="Backspace"
          className="h-12 rounded-lg bg-slate-100 text-xl font-medium text-slate-500 hover:bg-slate-200"
        >
          ⌫
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDone(seconds)}
        className="h-12 w-full rounded-lg bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
      >
        Done
      </button>
    </div>
  )
}
