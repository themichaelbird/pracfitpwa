import { useState } from 'react'
import { FollowUpFlagQueueScreen } from '../flags/FollowUpFlagQueueScreen'
import { SettingsAuditLogScreen } from './SettingsAuditLogScreen'
import { ColorCodeLogScreen } from './ColorCodeLogScreen'

const TABS = [
  ['flags', 'Follow-up flags'],
  ['settings', 'Settings audit log'],
  ['colorCode', 'Color code log'],
]

// PRD 6.10/13.5: "Manager dashboard: mode toggle with manager code; not a
// separate app or login." One screen, reached via the Manager Mode toggle
// (ManagerModeToggle.jsx), consolidating the three read-only feeds PRD 6.10
// lists rather than three separate top-level nav buttons. Owns the shared
// page chrome; each tab is otherwise-standalone content.
export function ManagerDashboardScreen({ coach, onBack }) {
  const [tab, setTab] = useState('flags')

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-xl px-3 text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Manager Dashboard</h1>
          <div className="w-16" />
        </div>

        <div className="flex gap-2 rounded-xl bg-slate-200 p-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
                tab === value ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'flags' && <FollowUpFlagQueueScreen coach={coach} />}
        {tab === 'settings' && <SettingsAuditLogScreen />}
        {tab === 'colorCode' && <ColorCodeLogScreen />}
      </div>
    </div>
  )
}
