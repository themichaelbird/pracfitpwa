import { useState } from 'react'

const BODY_AREAS = [
  'Shoulder',
  'Back',
  'Knee',
  'Hip',
  'Neck',
  'Ankle',
  'Wrist',
  'Elbow',
  'Other',
]

// PRD 5.4: captured once at session start -- body area, severity 1-10, free
// text. Zero entries is valid (client reports no pain); "Continue" always
// advances regardless of how many were logged.
export function PainIntakeStep({ painReports, onSave, onDone }) {
  const [bodyArea, setBodyArea] = useState('')
  const [severity, setSeverity] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleAdd() {
    if (!bodyArea) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ bodyArea, severity, notes })
      setBodyArea('')
      setSeverity(5)
      setNotes('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-center text-xl font-semibold text-slate-900">
        Pain intake
      </h1>

      {painReports.length > 0 && (
        <ul className="space-y-2">
          {painReports.map((report) => (
            <li
              key={report.id}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow"
            >
              <span className="font-medium text-slate-900">{report.body_area}</span>
              <span className="text-slate-600">Severity {report.severity}/10</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Body area</span>
          <div className="grid grid-cols-3 gap-2">
            {BODY_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setBodyArea(area)}
                className={`h-11 rounded-xl border text-sm font-medium transition ${
                  bodyArea === area
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="block text-sm font-medium text-slate-700">
            Severity: {severity}/10
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={severity}
            onChange={(event) => setSeverity(Number(event.target.value))}
            className="w-full"
          />
        </label>

        <label className="block space-y-1">
          <span className="block text-sm font-medium text-slate-700">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={!bodyArea || saving}
          className="h-12 w-full rounded-xl bg-slate-100 font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add pain report'}
        </button>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-medium text-white transition hover:bg-emerald-700"
      >
        Continue to workout
      </button>
    </div>
  )
}
