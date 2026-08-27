import { useState } from 'react'
import { useLongPress } from '../../lib/useLongPress'
import { defaultSettingsFor } from './machineSettingsFields'

// v0.2 req #6: a brand-new client has no settings for this card yet
// (card.hasSettings false). First fill is a plain tap -- no deliberate
// gesture, no reason -- since there's nothing to compare against. Once
// saved once, every subsequent edit requires the tap-and-hold gesture
// (useLongPress, PRD 5.4) plus a required reason, written to
// settings_audit_log by useSessionCore.updateMachineSettings.
export function MachineSettingsCard({ card, columnIndex, gridRow, onUpdateSettings }) {
  const [editing, setEditing] = useState(false)
  const [draftSettings, setDraftSettings] = useState({})
  const [newKey, setNewKey] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function openEditor() {
    const hasKeys = Object.keys(card.settings).length > 0
    setDraftSettings(hasKeys ? { ...card.settings } : defaultSettingsFor(card.machineName))
    setReason('')
    setError(null)
    setEditing(true)
  }

  const longPress = useLongPress(openEditor)
  const tapProps = card.hasSettings ? longPress : { onClick: openEditor }

  function updateValue(key, value) {
    setDraftSettings((current) => ({ ...current, [key]: value }))
  }

  function removeKey(key) {
    setDraftSettings((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function addKey() {
    if (!newKey.trim()) return
    setDraftSettings((current) => ({ ...current, [newKey.trim()]: '' }))
    setNewKey('')
  }

  async function handleSave() {
    if (card.hasSettings && !reason.trim()) {
      setError('Reason is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onUpdateSettings(card, draftSettings, reason.trim())
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const style = gridRow ? { gridColumn: columnIndex, gridRow } : undefined

  if (editing) {
    return (
      <div style={style} className="z-10 space-y-2 rounded-xl bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">{card.label} settings</p>

        <div className="space-y-1">
          {Object.entries(draftSettings).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-16 shrink-0 truncate text-xs text-slate-500">{key}</span>
              <input
                type="text"
                value={value}
                onChange={(event) => updateValue(key, event.target.value)}
                className="h-8 flex-1 rounded border border-slate-300 px-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeKey(key)}
                className="text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="New field"
            className="h-8 flex-1 rounded border border-slate-300 px-2 text-sm"
          />
          <button
            type="button"
            onClick={addKey}
            className="h-8 rounded bg-slate-100 px-2 text-sm text-slate-700"
          >
            Add
          </button>
        </div>

        {card.hasSettings && (
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for change"
            className="h-8 w-full rounded border border-slate-300 px-2 text-sm"
          />
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-8 flex-1 rounded bg-slate-100 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-8 flex-1 rounded bg-slate-900 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'OK'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      {...tapProps}
      style={style}
      className={`select-none space-y-1 rounded-xl p-3 ${
        card.hasSettings ? 'bg-slate-50' : 'bg-amber-50 ring-1 ring-inset ring-amber-200'
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">{card.label}</p>
      {!card.hasSettings ? (
        <p className="text-xs font-medium text-amber-700">Tap to set</p>
      ) : Object.keys(card.settings).length === 0 ? (
        <p className="text-xs text-slate-400">No settings</p>
      ) : (
        Object.entries(card.settings).map(([key, value]) => (
          <p key={key} className="text-xs text-slate-600">
            <span className="text-slate-400">{key}:</span> {String(value)}
          </p>
        ))
      )}
    </div>
  )
}
