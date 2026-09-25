import { useState } from 'react'

const LABELS = { push: 'Push', pull: 'Pull' }

// This task, item 2: replaces the handwritten "2nd" notation on the paper
// sheet. Only rendered for a row whose exercise has a push/pull
// classification (0023 migration) -- "2nd Push"/"2nd Pull" is read off that,
// not chosen separately. Entirely optional per client: off by default, and
// this control simply doesn't render at all for a row with no
// movementPattern, so there's no visible change for clients who don't use it.
//
// Live-QA corrections: (1) `canAssign` gates a NEW assignment on there being
// a genuinely earlier same-pattern exercise in this session's actual order
// (useSessionCore.js computes this fresh off the rendered row order) --
// an exercise that's already assigned still shows its badge regardless, this
// only blocks turning it on for an ineligible row. (2) no weight-offset
// field -- there's no separate weight input here at all. The exercise's own
// weight field already writes to whichever of the two independent tracks
// this flag currently points at (see toLogPayload/prefillWeight in
// useSessionCore.js); this control only flips the flag.
export function SecondPushPullBadge({ movementPattern, isSecondPushPull, canAssign, onChange }) {
  const [open, setOpen] = useState(false)

  if (!movementPattern) return null
  if (!isSecondPushPull && !canAssign) return null

  const label = `2nd ${LABELS[movementPattern]}`

  function handleToggle() {
    onChange(!isSecondPushPull)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
          isSecondPushPull ? 'bg-indigo-100 text-indigo-700' : 'text-slate-300 hover:text-slate-500'
        }`}
        aria-label="2nd push/pull designation"
      >
        {isSecondPushPull ? label : '2nd?'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isSecondPushPull}
                onChange={handleToggle}
                className="h-4 w-4 rounded border-slate-300"
              />
              {label}
            </label>
          </div>
        </>
      )}
    </div>
  )
}
