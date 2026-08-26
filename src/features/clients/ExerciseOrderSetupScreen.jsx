import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const TYPE_B_LIMIT = 4

// PRD 6.5 machine settings fields, keyed by the exact machine_name values
// seeded in 0009_seed_exercises.sql. Purely a UI convenience -- pre-fills
// suggested keys with blank values so the coach isn't guessing field names;
// client_exercise_settings.settings stays a free-form jsonb blob (same as
// MachineSettingsCell.jsx's mid-session editor), so keys can still be added
// or removed freely for machines not covered here.
const MACHINE_FIELD_DEFS = {
  'Hip Press Machine': ['SH', 'S', 'SB'],
  'Chest Press Machine': ['S', 'B', 'R'],
  'Pull Down Machine': ['S', 'R'],
  'Row Machine': ['C', 'R'],
  'Incline/OHP Machine': ['S', 'I', 'O'],
  'Lumbar Extension Machine': ['F', 'K'],
  'Rotary Torso Machine': ['F', 'K', 'R'],
  'Fly Machine': ['SB', 'R', 'C'],
  'Ab ISO Machine': ['S', 'R'],
  'Leg Extension Machine': ['S', 'R'],
}

function defaultSettingsFor(machineName) {
  const keys = MACHINE_FIELD_DEFS[machineName]
  if (!keys) return {}
  return Object.fromEntries(keys.map((key) => [key, '']))
}

// Local key/value editor, no reason/audit step (that's MachineSettingsCell's
// mid-session concern -- PRD 5.4/14.2). At setup time this is just "record
// the stored defaults" (PRD 23.2), saved together with everything else on
// this screen's one Save.
function SettingsEditor({ settings, onChange }) {
  const [newKey, setNewKey] = useState('')

  function updateValue(key, value) {
    onChange({ ...settings, [key]: value })
  }

  function removeKey(key) {
    const next = { ...settings }
    delete next[key]
    onChange(next)
  }

  function addKey() {
    if (!newKey.trim()) return
    onChange({ ...settings, [newKey.trim()]: '' })
    setNewKey('')
  }

  return (
    <div className="space-y-1">
      {Object.entries(settings).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="w-16 shrink-0 truncate text-xs text-slate-500">{key}</span>
          <input
            type="text"
            value={value}
            onChange={(event) => updateValue(key, event.target.value)}
            className="h-9 flex-1 rounded border border-slate-300 px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeKey(key)}
            className="text-slate-400 hover:text-red-600"
            aria-label={`Remove ${key}`}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          placeholder="New field"
          className="h-9 flex-1 rounded border border-slate-300 px-2 text-sm"
        />
        <button
          type="button"
          onClick={addKey}
          className="h-9 rounded bg-slate-100 px-2 text-sm text-slate-700"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// Searchable single-select over the Type C (auxiliary) pool -- ~50 exercises,
// too many for a plain list to scan without filtering. No component library
// in this codebase (see package.json), so this is a plain filter input +
// scrollable button list, matching the hand-rolled Tailwind style used
// everywhere else.
function AuxiliaryPicker({ label, exercises, selectedId, onSelect, required, optionalNote }) {
  const [search, setSearch] = useState('')
  const selected = exercises.find((e) => e.id === selectedId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return exercises
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.abbreviation.toLowerCase().includes(q)
    )
  }, [exercises, search])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {selected ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-white">
          <span className="font-medium">{selected.name}</span>
          <span className="text-sm text-slate-300">{selected.abbreviation}</span>
        </div>
      ) : optionalNote ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm italic text-slate-400">
          {optionalNote}
        </div>
      ) : null}

      {!selected && (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercises…"
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1">
            {filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => onSelect(exercise.id)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100"
              >
                <span>{exercise.name}</span>
                <span className="text-slate-400">{exercise.abbreviation}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-3 text-center text-sm text-slate-400">No matches.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// PRD 6.2/8.2/23.2 consultation workflow: assigns Type A (fixed, auto-
// populated), Type B (rotating, coach picks up to 4), Auxiliary A (required)
// and Auxiliary B (left blank -- "Set after session 1"), plus machine
// settings per assigned exercise. Reachable right after ClientCreateScreen
// saves a new client, or from ClientProfileScreen's "Exercise Setup" button
// for an existing client (the only way to assign Auxiliary B later, or
// correct any of this after the fact).
export function ExerciseOrderSetupScreen({ clientId, onBack, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [clientName, setClientName] = useState('')

  const [typeAExercises, setTypeAExercises] = useState([])
  const [typeBExercises, setTypeBExercises] = useState([])
  const [auxiliaryExercises, setAuxiliaryExercises] = useState([])

  const [selectedTypeB, setSelectedTypeB] = useState([]) // ordered array of exercise ids
  const [initialTypeB, setInitialTypeB] = useState([])
  const [auxA, setAuxA] = useState(null)
  const [auxB, setAuxB] = useState(null)
  const [initialAuxA, setInitialAuxA] = useState(null)
  const [initialAuxB, setInitialAuxB] = useState(null)
  const [settingsByExercise, setSettingsByExercise] = useState({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [
          { data: clientRow, error: clientError },
          { data: exerciseRows, error: exerciseError },
          { data: orderRows, error: orderError },
          { data: auxiliaryRows, error: auxiliaryError },
          { data: settingsRows, error: settingsError },
        ] = await Promise.all([
          supabase.from('clients').select('name').eq('id', clientId).single(),
          supabase
            .from('exercises')
            .select('id, name, abbreviation, exercise_type, default_movement_classification, machine_name')
            .eq('is_active', true)
            .order('abbreviation'),
          supabase
            .from('client_exercise_order')
            .select('exercise_id, exercises(exercise_type)')
            .eq('client_id', clientId)
            .eq('is_active', true),
          supabase
            .from('auxiliary_config')
            .select('slot, exercise_id')
            .eq('client_id', clientId)
            .eq('is_current', true),
          supabase.from('client_exercise_settings').select('exercise_id, settings').eq('client_id', clientId),
        ])
        if (clientError) throw clientError
        if (exerciseError) throw exerciseError
        if (orderError) throw orderError
        if (auxiliaryError) throw auxiliaryError
        if (settingsError) throw settingsError

        if (cancelled) return

        const typeA = exerciseRows.filter((e) => e.exercise_type === 'A')
        const typeB = exerciseRows.filter((e) => e.exercise_type === 'B')
        const typeC = exerciseRows.filter((e) => e.exercise_type === 'C')

        const existingTypeBIds = orderRows
          .filter((o) => o.exercises.exercise_type === 'B')
          .map((o) => o.exercise_id)
        // New client (no existing order rows): pre-select every Type B
        // exercise up to the cap, since today there are exactly 4 seeded --
        // the cap is what matters once a location has more than 4 candidates.
        const initialB =
          existingTypeBIds.length > 0 ? existingTypeBIds : typeB.slice(0, TYPE_B_LIMIT).map((e) => e.id)

        const auxAId = auxiliaryRows.find((a) => a.slot === 'A')?.exercise_id ?? null
        const auxBId = auxiliaryRows.find((a) => a.slot === 'B')?.exercise_id ?? null

        const settingsMap = Object.fromEntries(
          settingsRows.map((s) => [s.exercise_id, s.settings ?? {}])
        )
        const exercisesById = Object.fromEntries(exerciseRows.map((e) => [e.id, e]))
        const assignedIds = [...typeA.map((e) => e.id), ...initialB, auxAId, auxBId].filter(Boolean)
        for (const id of assignedIds) {
          if (!(id in settingsMap)) {
            settingsMap[id] = defaultSettingsFor(exercisesById[id]?.machine_name)
          }
        }

        setClientName(clientRow.name)
        setTypeAExercises(typeA)
        setTypeBExercises(typeB)
        setAuxiliaryExercises(typeC)
        setSelectedTypeB(initialB)
        setInitialTypeB(existingTypeBIds)
        setAuxA(auxAId)
        setAuxB(auxBId)
        setInitialAuxA(auxAId)
        setInitialAuxB(auxBId)
        setSettingsByExercise(settingsMap)
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const exercisesById = useMemo(
    () =>
      Object.fromEntries(
        [...typeAExercises, ...typeBExercises, ...auxiliaryExercises].map((e) => [e.id, e])
      ),
    [typeAExercises, typeBExercises, auxiliaryExercises]
  )

  function toggleTypeB(exerciseId) {
    setSelectedTypeB((current) => {
      if (current.includes(exerciseId)) {
        return current.filter((id) => id !== exerciseId)
      }
      if (current.length >= TYPE_B_LIMIT) return current
      const next = [...current, exerciseId]
      setSettingsByExercise((settings) =>
        exerciseId in settings
          ? settings
          : { ...settings, [exerciseId]: defaultSettingsFor(exercisesById[exerciseId]?.machine_name) }
      )
      return next
    })
  }

  function selectAux(setter) {
    return (exerciseId) => {
      setter(exerciseId)
      if (exerciseId) {
        setSettingsByExercise((settings) =>
          exerciseId in settings
            ? settings
            : { ...settings, [exerciseId]: defaultSettingsFor(exercisesById[exerciseId]?.machine_name) }
        )
      }
    }
  }

  const assignedForSettings = useMemo(() => {
    const ids = [...typeAExercises.map((e) => e.id), ...selectedTypeB, auxA, auxB].filter(Boolean)
    return ids.map((id) => exercisesById[id]).filter(Boolean)
  }, [typeAExercises, selectedTypeB, auxA, auxB, exercisesById])

  function updateExerciseSettings(exerciseId, settings) {
    setSettingsByExercise((current) => ({ ...current, [exerciseId]: settings }))
  }

  async function syncAuxiliarySlot(slot, initialExerciseId, currentExerciseId) {
    if (initialExerciseId === currentExerciseId) return
    if (initialExerciseId) {
      const { error } = await supabase
        .from('auxiliary_config')
        .update({ is_current: false, effective_to: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('slot', slot)
        .eq('is_current', true)
      if (error) throw error
    }
    if (currentExerciseId) {
      const { error } = await supabase.from('auxiliary_config').insert({
        client_id: clientId,
        slot,
        exercise_id: currentExerciseId,
        is_current: true,
      })
      if (error) throw error
    }
  }

  async function handleSave() {
    setSaveError(null)
    if (!auxA) {
      setSaveError('Auxiliary A is required.')
      return
    }
    if (selectedTypeB.length === 0) {
      setSaveError('Select at least one Type B exercise.')
      return
    }

    setSaving(true)
    try {
      const orderRows = [
        ...typeAExercises.map((e) => ({
          client_id: clientId,
          exercise_id: e.id,
          rotation_index: 0,
          movement_classification: e.default_movement_classification,
          is_active: true,
        })),
        ...selectedTypeB.map((exerciseId, index) => ({
          client_id: clientId,
          exercise_id: exerciseId,
          rotation_index: index,
          movement_classification: exercisesById[exerciseId].default_movement_classification,
          is_active: true,
        })),
      ]
      const { error: orderError } = await supabase
        .from('client_exercise_order')
        .upsert(orderRows, { onConflict: 'client_id,exercise_id' })
      if (orderError) throw orderError

      const removedTypeB = initialTypeB.filter((id) => !selectedTypeB.includes(id))
      if (removedTypeB.length > 0) {
        const { error: deactivateError } = await supabase
          .from('client_exercise_order')
          .update({ is_active: false })
          .eq('client_id', clientId)
          .in('exercise_id', removedTypeB)
        if (deactivateError) throw deactivateError
      }

      await syncAuxiliarySlot('A', initialAuxA, auxA)
      await syncAuxiliarySlot('B', initialAuxB, auxB)

      const settingsRows = assignedForSettings.map((exercise) => ({
        client_id: clientId,
        exercise_id: exercise.id,
        settings: settingsByExercise[exercise.id] ?? {},
      }))
      if (settingsRows.length > 0) {
        const { error: settingsSaveError } = await supabase
          .from('client_exercise_settings')
          .upsert(settingsRows, { onConflict: 'client_id,exercise_id' })
        if (settingsSaveError) throw settingsSaveError
      }

      onSaved()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="max-w-md text-center text-red-600">Couldn't load exercise setup: {loadError}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading exercise setup…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-xl px-3 text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Exercise setup — {clientName}</h1>
          <div className="w-16" aria-hidden="true" />
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Type A — fixed</h2>
          <p className="text-xs text-slate-400">Always present every session. Pre-populated, not editable here.</p>
          <ul className="grid grid-cols-2 gap-2">
            {typeAExercises.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-900"
              >
                <span>{e.name}</span>
                <span className="text-slate-400">{e.abbreviation}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Type B — rotating ({selectedTypeB.length} of {TYPE_B_LIMIT} selected)
          </h2>
          <p className="text-xs text-slate-400">Choose up to {TYPE_B_LIMIT}. Position rotates each session.</p>
          <ul className="grid grid-cols-2 gap-2">
            {typeBExercises.map((e) => {
              const checked = selectedTypeB.includes(e.id)
              const disabled = !checked && selectedTypeB.length >= TYPE_B_LIMIT
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => toggleTypeB(e.id)}
                    disabled={disabled}
                    className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                      checked
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : disabled
                          ? 'border-slate-200 text-slate-300'
                          : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{e.name}</span>
                    <span className={checked ? 'text-slate-300' : 'text-slate-400'}>{e.abbreviation}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <AuxiliaryPicker
            label="Auxiliary A"
            exercises={auxiliaryExercises}
            selectedId={auxA}
            onSelect={selectAux(setAuxA)}
            required
          />
        </section>

        <section>
          <AuxiliaryPicker
            label="Auxiliary B"
            exercises={auxiliaryExercises}
            selectedId={auxB}
            onSelect={selectAux(setAuxB)}
            optionalNote="Set after session 1"
          />
        </section>

        {assignedForSettings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Machine settings</h2>
            <div className="space-y-3">
              {assignedForSettings.map((exercise) => (
                <div key={exercise.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    {exercise.abbreviation} <span className="font-normal text-slate-400">{exercise.name}</span>
                  </p>
                  <SettingsEditor
                    settings={settingsByExercise[exercise.id] ?? {}}
                    onChange={(settings) => updateExerciseSettings(exercise.id, settings)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save exercise setup'}
        </button>
      </div>
    </div>
  )
}
