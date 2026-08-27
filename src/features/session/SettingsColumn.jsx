import { useState } from 'react'
import { MachineSettingsCard } from './MachineSettingsCard'

// v0.2 req #6/#8/#14: independent, fixed-order machine settings sidebar --
// no longer row-aligned with the session grid (core.machineSettingsCards is
// built by machine, not by exercise row, so its count/order no longer
// matches core.rows -- see useSessionCore.js buildMachineSettingsCards).
// Own scroll, own layout; sits to the left of the session-columns grid in
// SessionWorkspace.jsx.
export function SettingsColumn({ cards, onUpdateSettings }) {
  const [showAddMoreInfo, setShowAddMoreInfo] = useState(false)

  return (
    <div className="w-56 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 bg-slate-100 p-2">
      <p className="px-1 py-1 text-sm font-semibold text-slate-700">Machine settings</p>

      {cards.map((card) => (
        <MachineSettingsCard key={card.key} card={card} onUpdateSettings={onUpdateSettings} />
      ))}

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAddMoreInfo((current) => !current)}
          className="h-11 w-full rounded-xl bg-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-300"
        >
          + Add More
        </button>
        {showAddMoreInfo && (
          <p className="mt-2 px-1 text-xs text-slate-500">
            A settings card for any other machine appears automatically here once you assign it as
            an Auxiliary or add it via the exercise list's Add More button.
          </p>
        )}
      </div>
    </div>
  )
}
