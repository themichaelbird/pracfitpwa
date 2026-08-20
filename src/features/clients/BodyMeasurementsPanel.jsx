import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// PRD 23.3: ACE body fat % reference table. Bins are contiguous -- each
// category's upper bound is the next category's lower bound -- so any
// entered value under Not Acceptable's floor lands in exactly one row.
// PRD's table gives categories as ranges (e.g. "25-31%" / "32% plus");
// filling the small inter-category gaps this way is the standard reading
// of an ACE-style reference chart, not a literal transcription of the PRD
// table's printed bounds.
const ACE_TABLE = [
  { category: 'Essential Fat', women: [10, 14], men: [2, 6] },
  { category: 'Athletes', women: [14, 21], men: [6, 14] },
  { category: 'Fitness', women: [21, 25], men: [14, 18] },
  { category: 'Acceptable', women: [25, 32], men: [18, 25] },
  { category: 'Not Acceptable', women: [32, Infinity], men: [25, Infinity] },
]

function matchesRange(value, [low, high]) {
  return value >= low && value < high
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

// PRD 6.8: WT/BF/WS tracking, manual entry, ACE reference surfaced when
// entering BF%. Lives as a section on ClientProfileScreen rather than its
// own screen (13.5's "Separate Screens" list doesn't include it) -- plain
// insert/select on body_measurements, no dedicated hook, matching the
// profile screen's existing inline-query style.
export function BodyMeasurementsPanel({ clientId, coachId }) {
  const [measurements, setMeasurements] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState({
    measured_at: todayDate(),
    weight: '',
    body_fat_pct: '',
    waist: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('client_id', clientId)
        .order('measured_at', { ascending: false })

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        return
      }
      setMeasurements(data)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const { data, error } = await supabase
        .from('body_measurements')
        .insert({
          client_id: clientId,
          measured_at: form.measured_at,
          weight: form.weight === '' ? null : form.weight,
          body_fat_pct: form.body_fat_pct === '' ? null : form.body_fat_pct,
          waist: form.waist === '' ? null : form.waist,
          recorded_by: coachId,
        })
        .select()
        .single()
      if (error) throw error
      setMeasurements((current) => [data, ...(current ?? [])])
      setForm({ measured_at: todayDate(), weight: '', body_fat_pct: '', waist: '' })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const enteredBf = form.body_fat_pct === '' ? null : Number(form.body_fat_pct)

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Body measurements</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Date</span>
          <input
            type="date"
            value={form.measured_at}
            onChange={(event) => setForm((c) => ({ ...c, measured_at: event.target.value }))}
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Weight</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.weight}
            onChange={(event) => setForm((c) => ({ ...c, weight: event.target.value }))}
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Body fat %</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.body_fat_pct}
            onChange={(event) => setForm((c) => ({ ...c, body_fat_pct: event.target.value }))}
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Waist</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.waist}
            onChange={(event) => setForm((c) => ({ ...c, waist: event.target.value }))}
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Women</th>
              <th className="px-3 py-2">Men</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ACE_TABLE.map((row) => {
              const highlighted =
                enteredBf != null &&
                (matchesRange(enteredBf, row.women) || matchesRange(enteredBf, row.men))
              return (
                <tr
                  key={row.category}
                  className={highlighted ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600'}
                >
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">
                    {row.women[1] === Infinity ? `${row.women[0]}% plus` : `${row.women[0]}–${row.women[1] - 1}%`}
                  </td>
                  <td className="px-3 py-2">
                    {row.men[1] === Infinity ? `${row.men[0]}% plus` : `${row.men[0]}–${row.men[1] - 1}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600">
          {saveError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="h-12 w-full rounded-xl bg-slate-900 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Add measurement'}
      </button>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">History</span>
        {loadError && <p className="text-sm text-red-600">Couldn't load history: {loadError}</p>}
        {measurements === null && !loadError && (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
        {measurements?.length === 0 && (
          <p className="text-sm text-slate-400">No measurements recorded yet.</p>
        )}
        {measurements && measurements.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {measurements.map((m) => (
              <div key={m.id} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-slate-500">{m.measured_at}</span>
                <span className="text-slate-900">
                  {m.weight != null && `${m.weight} lb`}
                  {m.body_fat_pct != null && ` · ${m.body_fat_pct}% BF`}
                  {m.waist != null && ` · ${m.waist}" waist`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
