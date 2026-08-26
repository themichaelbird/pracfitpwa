import { useState } from 'react'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// v0.1: number pad for Eccentric (E) exercises' reps-completed entry --
// same interaction family as TimeNumberPad, but a plain 1-2 digit count
// (no M:SS formatting), since E sets show a circled rep count instead of a
// failure time.
export function RepsNumberPad({ initialReps, onDone }) {
  const [buffer, setBuffer] = useState(initialReps != null && initialReps > 0 ? String(initialReps).slice(-2) : '')
  const reps = buffer ? Number(buffer) : 0

  function tapDigit(digit) {
    setBuffer((current) => (current + digit).slice(-2))
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-center text-3xl font-semibold tabular-nums text-slate-900">{reps}</p>
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
        onClick={() => onDone(reps)}
        className="h-12 w-full rounded-lg bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
      >
        Done
      </button>
    </div>
  )
}
