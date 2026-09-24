import { useState } from 'react'

// This task, item 4: the coach-triggered per-client HP <-> HP(R)/HP(L)
// conversion, plus the controls for everything that only matters once split
// (freeze/unfreeze the alternating lead side, the "adjacent" layout
// alternative, and the shared-vs-independent machine settings toggle).
// Rendered from the plain 'HP' row (offers only "Split") and from each split
// row (offers the rest, plus "Revert"). Available in prep mode too, same as
// swap/classification -- it's a standing exercise-list structure choice, not
// something that logs performance.
export function HipPressSplitControl({
  isSplitSource,
  hipPressSide,
  leadSide,
  frozen,
  layout,
  sharedSettings,
  onSplit,
  onRevert,
  onSetFreeze,
  onSetLayout,
  onSetSharedSettings,
}) {
  const [open, setOpen] = useState(false)

  if (!isSplitSource && !hipPressSide) return null

  const isLeading = hipPressSide && hipPressSide === leadSide

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded px-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
        aria-label="Hip Press split options"
      >
        {hipPressSide ? `${isLeading ? '①' : '②'} ${hipPressSide}` : '⇆ Split'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
            {isSplitSource && (
              <button
                type="button"
                onClick={() => {
                  onSplit()
                  setOpen(false)
                }}
                className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-left font-medium text-white"
              >
                Split into Hip Press (R)/(L)
              </button>
            )}

            {hipPressSide && (
              <>
                <p className="font-medium text-slate-600">
                  Leading: {leadSide}
                  {frozen ? ' (frozen)' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSetFreeze(!frozen, hipPressSide)
                    setOpen(false)
                  }}
                  className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-slate-700 hover:bg-slate-200"
                >
                  {frozen ? 'Unfreeze alternation' : `Freeze lead to ${hipPressSide}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSetLayout(layout === 'adjacent' ? 'alternating' : 'adjacent')
                    setOpen(false)
                  }}
                  className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-slate-700 hover:bg-slate-200"
                >
                  {layout === 'adjacent' ? 'Use alternating layout' : 'Use adjacent (back-to-back) layout'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSetSharedSettings(!sharedSettings)
                    setOpen(false)
                  }}
                  className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-slate-700 hover:bg-slate-200"
                >
                  {sharedSettings ? 'Give each side independent settings' : 'Share one settings card again'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Revert to plain Hip Press? Logged history stays, but HP(R)/HP(L) stop appearing in future sessions.'
                      )
                    ) {
                      onRevert()
                    }
                    setOpen(false)
                  }}
                  className="w-full rounded-lg bg-red-50 px-2 py-1.5 text-left text-red-700 hover:bg-red-100"
                >
                  Revert to plain Hip Press
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
