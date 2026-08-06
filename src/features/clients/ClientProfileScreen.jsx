import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const COLOR_CODES = ['P', 'C', 'E']
const COLOR_DOT = {
  P: 'bg-rose-500',
  C: 'bg-amber-500',
  E: 'bg-emerald-500',
}

const TEXT_FIELDS = [
  ['name', 'Name'],
  ['sex', 'Sex'],
  ['height', 'Height'],
  ['music_preference', 'Music preference'],
  ['fan_preference', 'Fan preference'],
  ['membership_package_type', 'Membership package'],
]

const NOTE_FIELDS = [
  ['physical_limitations', 'Physical limitations'],
  ['personal_details', 'Personal details'],
  ['customization_notes', 'Customization notes'],
  ['goal_notes', 'Goal notes'],
]

function toFormState(client) {
  return {
    name: client.name ?? '',
    date_of_birth: client.date_of_birth ?? '',
    sex: client.sex ?? '',
    height: client.height ?? '',
    color_code: client.color_code,
    is_minor: client.is_minor,
    parental_contact: client.parental_contact ?? '',
    music_preference: client.music_preference ?? '',
    fan_preference: client.fan_preference ?? '',
    physical_limitations: client.physical_limitations ?? '',
    personal_details: client.personal_details ?? '',
    customization_notes: client.customization_notes ?? '',
    goal_tags: (client.goal_tags ?? []).join(', '),
    goal_notes: client.goal_notes ?? '',
    membership_package_type: client.membership_package_type ?? '',
    membership_completion_date: client.membership_completion_date ?? '',
    is_special_rotation: client.is_special_rotation,
    is_archived: client.is_archived,
  }
}

// Week 3-4: full editable client profile (PRD 8.1 clients columns). Color
// code changes go through the update_client_color_code RPC (0010) so
// clients.color_code and color_code_log stay in sync; everything else is a
// plain update on `clients`, which has no per-field audit trail.
export function ClientProfileScreen({ clientId, coach, onBack }) {
  const [client, setClient] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadClient() {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (cancelled) return

      if (error) {
        setLoadError(error.message)
        return
      }
      setClient(data)
      setForm(toFormState(data))
    }

    loadClient()
    return () => {
      cancelled = true
    }
  }, [clientId])

  function updateField(field, value) {
    setSaved(false)
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)

    try {
      if (form.color_code !== client.color_code) {
        const { error: colorError } = await supabase.rpc('update_client_color_code', {
          p_client_id: clientId,
          p_new_color_code: form.color_code,
          p_changed_by: coach.id,
        })
        if (colorError) throw colorError
      }

      const { color_code, ...rest } = form
      const goalTags = form.goal_tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

      const { data, error: updateError } = await supabase
        .from('clients')
        .update({
          ...rest,
          date_of_birth: form.date_of_birth || null,
          parental_contact: form.is_minor ? form.parental_contact || null : null,
          membership_completion_date: form.membership_completion_date || null,
          goal_tags: goalTags,
        })
        .eq('id', clientId)
        .select()
        .single()
      if (updateError) throw updateError

      setClient(data)
      setForm(toFormState(data))
      setSaved(true)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="max-w-md text-center text-red-600">
          Couldn't load client: {loadError}
        </p>
      </div>
    )
  }

  if (!client || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading client…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow"
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-xl px-3 text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
          <div className="w-16" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">
            Color code
          </span>
          <div className="flex gap-3">
            {COLOR_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => updateField('color_code', code)}
                className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
                  form.color_code === code
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[code]}`} />
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {TEXT_FIELDS.map(([field, label]) => (
            <label key={field} className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">
                {label}
              </span>
              <input
                type="text"
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          ))}

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Date of birth
            </span>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(event) => updateField('date_of_birth', event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Membership completion date
            </span>
            <input
              type="date"
              value={form.membership_completion_date}
              onChange={(event) =>
                updateField('membership_completion_date', event.target.value)
              }
              className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">
            Goal tags (comma-separated)
          </span>
          <input
            type="text"
            value={form.goal_tags}
            onChange={(event) => updateField('goal_tags', event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        <div className="space-y-4">
          {NOTE_FIELDS.map(([field, label]) => (
            <label key={field} className="block space-y-1">
              <span className="block text-sm font-medium text-slate-700">
                {label}
              </span>
              <textarea
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          ))}
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_minor}
              onChange={(event) => updateField('is_minor', event.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            Minor
          </label>

          {form.is_minor && (
            <label className="block space-y-1">
              <span className="block text-sm font-medium text-slate-700">
                Parental contact
              </span>
              <input
                type="text"
                value={form.parental_contact}
                onChange={(event) => updateField('parental_contact', event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_special_rotation}
              onChange={(event) =>
                updateField('is_special_rotation', event.target.checked)
              }
              className="h-5 w-5 rounded border-slate-300"
            />
            Special rotation
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_archived}
              onChange={(event) => updateField('is_archived', event.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            Archived
          </label>
        </div>

        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}
        {saved && !saveError && (
          <p role="status" className="text-sm text-emerald-600">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
