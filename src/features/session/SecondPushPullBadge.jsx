import { useState } from 'react'

const LABELS = { push: 'Push', pull: 'Pull' }

// This task, item 2: replaces the handwritten "2nd" notation on the paper
// sheet. Only rendered for a row whose exercise has a push/pull
// classification (0023 migration) -- "2nd Push"/"2nd Pull" is read off that,
// not chosen separately. Entirely optional per client: off by default, and
// this control simply doesn't render at all for a row with no
// movementPattern, so there's no visible change for clients who don't use it.
export function SecondPushPullBadge({ movementPattern, isSecondPushPull, weightOffset, onChange }) {
  const [open, setOpen] = useState(false)
  const [draftOffset, setDraftOffset] = useState(weightOffset ?? '')

  if (!movementPattern) return null

  const label = `2nd ${LABELS[movementPattern]}`

  function handleToggle() {
    if (isSecondPushPull) {
      onChange(false, null)
    } else {
      setDraftOffset(weightOffset ?? '')
      onChange(true, weightOffset)
    }
  }

  function handleOffsetBlur() {
    const value = draftOffset === '' ? null : Number(draftOffset)
    if (value !== (weightOffset ?? null)) {
      onChange(true, value)
    }
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
          <div className="absolute left-0 top-full z-20 mt-1 w-48 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isSecondPushPull}
                onChange={handleToggle}
                className="h-4 w-4 rounded border-slate-300"
              />
              {label}
            </label>
            {isSecondPushPull && (
              <label className="block space-y-1">
                <span className="block text-slate-500">Expected weight offset</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draftOffset}
                  onChange={(event) => setDraftOffset(event.target.value)}
                  onBlur={handleOffsetBlur}
                  placeholder="e.g. +10"
                  className="h-8 w-full rounded border border-slate-300 px-2 text-sm"
                />
              </label>
            )}
          </div>
        </>
      )}
    </div>
  )
}
