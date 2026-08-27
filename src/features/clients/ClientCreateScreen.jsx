import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { DateOfBirthPicker } from './DateOfBirthPicker'

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

const BLANK_FORM = {
  name: '',
  date_of_birth: '',
  sex: '',
  height: '',
  color_code: 'E',
  is_minor: false,
  parental_contact: '',
  music_preference: '',
  fan_preference: '',
  physical_limitations: '',
  personal_details: '',
  customization_notes: '',
  goal_tags: '',
  goal_notes: '',
  membership_package_type: '',
  membership_completion_date: '',
  is_special_rotation: false,
}

// v0.2: blank client profile form -- new client creation entry point. Field
// set/layout intentionally mirrors ClientProfileScreen.jsx's toFormState()
// (same columns, same "editable" set) since that's the confirmed PRD 6.1
// field list; this screen just starts blank and inserts instead of loading +
// updating. Profile form -> done: exercise setup is gone (v0.2) -- the
// default exercise order now auto-populates the first time this client's
// session is opened (see useSessionCore.js), so on save this just hands the
// new client id back to the caller (App.jsx) to land on the profile screen.
export function ClientCreateScreen({ locationId, onBack, onCreated }) {
  const [form, setForm] = useState(BLANK_FORM)
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(locationId ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // A shared per-location login already has a fixed locationId (the normal
  // case); only the owner login (no location_id in its JWT) needs to pick
  // one explicitly, since clients.location_id is NOT NULL.
  useEffect(() => {
    if (locationId) return
    let cancelled = false
    async function loadLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name')
      if (!cancelled && data) setLocations(data)
    }
    loadLocations()
    return () => {
      cancelled = true
    }
  }, [locationId])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaveError(null)

    if (!form.name.trim()) {
      setSaveError('Name is required.')
      return
    }
    if (!form.date_of_birth) {
      setSaveError('Date of birth is required.')
      return
    }
    if (!selectedLocationId) {
      setSaveError('Location is required.')
      return
    }

    setSaving(true)
    try {
      const goalTags = form.goal_tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: form.name.trim(),
          date_of_birth: form.date_of_birth,
          sex: form.sex || null,
          height: form.height || null,
          location_id: selectedLocationId,
          color_code: form.color_code,
          is_minor: form.is_minor,
          parental_contact: form.is_minor ? form.parental_contact || null : null,
          music_preference: form.music_preference || null,
          fan_preference: form.fan_preference || null,
          physical_limitations: form.physical_limitations || null,
          personal_details: form.personal_details || null,
          customization_notes: form.customization_notes || null,
          goal_tags: goalTags,
          goal_notes: form.goal_notes || null,
          membership_package_type: form.membership_package_type || null,
          membership_completion_date: form.membership_completion_date || null,
          is_special_rotation: form.is_special_rotation,
        })
        .select()
        .single()
      if (error) throw error

      onCreated(data.id)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-xl font-semibold text-slate-900">New client</h1>
          <div className="w-16" aria-hidden="true" />
        </div>

        {!locationId && (
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Location</span>
            <select
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Select a location…</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Color code</span>
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

        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Date of birth</span>
          <DateOfBirthPicker
            value={form.date_of_birth}
            onChange={(value) => updateField('date_of_birth', value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {TEXT_FIELDS.map(([field, label]) => (
            <label key={field} className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">{label}</span>
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
              <span className="block text-sm font-medium text-slate-700">{label}</span>
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
              <span className="block text-sm font-medium text-slate-700">Parental contact</span>
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
              onChange={(event) => updateField('is_special_rotation', event.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            Special rotation
          </label>
        </div>

        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create client'}
        </button>
      </form>
    </div>
  )
}
