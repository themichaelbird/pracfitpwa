import { useState } from 'react'
import { OfflineStatusBadge } from './OfflineStatusBadge'
import { useLongPress } from '../../lib/useLongPress'

const COLOR_DOT = {
  P: 'bg-rose-500',
  C: 'bg-amber-500',
  E: 'bg-emerald-500',
}

const FIELDS = [
  ['music_preference', '🎵', 'Music preference'],
  ['fan_preference', '🌀', 'Fan preference'],
]

// v0.2 req #12: tap-and-hold to edit, same deliberate-action pattern as
// machine settings (MachineSettingsCard.jsx) -- protects against an
// accidental change mid-session while still allowing the coach to update it
// when the client actually asks for something different.
function PreferenceField({ field, icon, label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const longPress = useLongPress(() => {
    setDraft(value ?? '')
    setEditing(true)
  })

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ [field]: draft || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span>{icon}</span>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={label}
          autoFocus
          className="h-8 w-32 rounded border border-slate-300 px-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <span {...longPress} className="cursor-default select-none" title={`Tap and hold to edit ${label.toLowerCase()}`}>
      {icon} {value || '—'}
    </span>
  )
}

// PRD 5.4: always visible at the top of the session screen, regardless of
// which step (workspace / review gate / pain intake / close) is showing.
export function ClientHeaderBar({ client, onBack, online, pendingCount, onUpdatePreferences }) {
  return (
    <div className="flex items-center justify-between bg-white px-6 py-3 shadow">
      <button
        type="button"
        onClick={onBack}
        className="h-11 rounded-xl px-3 text-slate-600 hover:text-slate-900"
      >
        ← Back
      </button>

      <div className="flex items-center gap-4">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[client.color_code]}`}
          aria-hidden="true"
        />
        <span className="text-lg font-semibold text-slate-900">{client.name}</span>
        {online !== undefined && <OfflineStatusBadge online={online} pendingCount={pendingCount} />}
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-600">
        {FIELDS.map(([field, icon, label]) => (
          <PreferenceField
            key={field}
            field={field}
            icon={icon}
            label={label}
            value={client[field]}
            onSave={onUpdatePreferences}
          />
        ))}
      </div>
    </div>
  )
}
