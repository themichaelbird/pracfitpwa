import { useState } from 'react'
import { useLongPress } from '../../lib/useLongPress'

// PRD 5.4: settings are protected from accidental edit -- a plain tap does
// nothing, only tap-and-hold opens the edit form. settings is a jsonb blob
// (fields vary by machine type), so this renders/edits it as free-form
// key/value pairs rather than assuming a fixed shape.
export function MachineSettingsCell({ row, columnIndex, gridRow, onUpdateSettings }) {
  const [editing, setEditing] = useState(false)
  const [draftSettings, setDraftSettings] = useState({})
  const [newKey, setNewKey] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const longPress = useLongPress(() => {
    setDraftSettings({ ...row.settings })
    setReason('')
    setError(null)
    setEditing(true)
  })

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
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onUpdateSettings(row.exerciseId, draftSettings, reason.trim())
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const style = { gridColumn: columnIndex, gridRow }

  if (editing) {
    return (
      <div style={style} className="z-10 space-y-2 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">{row.abbreviation} settings</p>

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

        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for change"
          className="h-8 w-full rounded border border-slate-300 px-2 text-sm"
        />

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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div {...longPress} style={style} className="select-none space-y-1 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">{row.abbreviation}</p>
      {Object.keys(row.settings).length === 0 ? (
        <p className="text-xs text-slate-400">No settings</p>
      ) : (
        Object.entries(row.settings).map(([key, value]) => (
          <p key={key} className="text-xs text-slate-600">
            <span className="text-slate-400">{key}:</span> {String(value)}
          </p>
        ))
      )}
    </div>
  )
}
