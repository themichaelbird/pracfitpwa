import { useEffect, useState } from 'react'

const DECLINE_REASONS = [
  ['client_said_no', 'Client said no'],
  ['client_said_next_time', 'Client said next time'],
  ['client_declined_measurements_reviewed_goals', 'Client declined measurements but reviewed goals'],
  ['other', 'Other'],
]

// PRD 5.5/6.4/14.3: the ORIGINAL / 6-session review screen. Blocks Start
// Session (rendered by SessionScreen in place of StartSessionGate) until
// the coach either completes the review -- entering a new working weight
// per exercise, recorded alongside the locked founding baseline -- or
// explicitly declines with a reason. Resolving either way re-triggers
// useSessionCore's load(), which recomputes reviewDue back to false, so
// this screen just stops rendering on the parent's next render; no local
// "done" flag needed.
export function ReviewGateScreen({ client, loadReviewData, onComplete, onDecline }) {
  const [loading, setLoading] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState(null)
  const [exercises, setExercises] = useState([]) // [{ exerciseId, name, abbreviation, baselineWeight, baselineFailureTime, lastReview }]
  const [weights, setWeights] = useState({})
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declineOtherText, setDeclineOtherText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadReviewData()
      .then(({ baselines, history }) => {
        if (cancelled) return
        const built = baselines.map((b) => ({
          exerciseId: b.exercise_id,
          name: b.exercises.name,
          abbreviation: b.exercises.abbreviation,
          baselineWeight: b.weight,
          baselineFailureTime: b.failure_time,
          lastReview: history.find((h) => h.exercise_id === b.exercise_id) ?? null,
        }))
        built.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
        setExercises(built)
      })
      .catch((err) => !cancelled && setLoadErrorMessage(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [loadReviewData])

  async function handleComplete() {
    const entered = Object.fromEntries(
      Object.entries(weights).filter(([, value]) => value !== '' && value != null)
    )
    if (Object.keys(entered).length === 0) {
      setError('Enter at least one working weight before completing the review.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onComplete(entered)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  async function handleDecline() {
    if (!declineReason) {
      setError('Select a decline reason.')
      return
    }
    if (declineReason === 'other' && !declineOtherText.trim()) {
      setError('Enter a reason.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onDecline({ reason: declineReason, otherText: declineOtherText.trim() })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-8">
        <p className="text-slate-600">Loading review…</p>
      </div>
    )
  }

  if (loadErrorMessage) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-8">
        <p className="max-w-md text-center text-red-600">Couldn't load review: {loadErrorMessage}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          6-session review for
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Exercise</th>
              <th className="px-4 py-3">ORIGINAL</th>
              <th className="px-4 py-3">Last review</th>
              <th className="px-4 py-3">New working weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exercises.map((ex) => (
              <tr key={ex.exerciseId}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {ex.abbreviation}
                  <span className="ml-2 text-xs font-normal text-slate-400">{ex.name}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{ex.baselineWeight} lb</td>
                <td className="px-4 py-3 text-slate-600">
                  {ex.lastReview ? `${ex.lastReview.weight} lb` : '—'}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weights[ex.exerciseId] ?? ''}
                    onChange={(event) =>
                      setWeights((current) => ({ ...current, [ex.exerciseId]: event.target.value }))
                    }
                    className="h-10 w-24 rounded-lg border border-slate-300 px-2 text-right text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </td>
              </tr>
            ))}
            {exercises.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No ORIGINAL baseline on file for this client.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {declining && (
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow">
          <span className="block text-sm font-medium text-slate-700">Decline reason</span>
          <div className="grid grid-cols-2 gap-2">
            {DECLINE_REASONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDeclineReason(value)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  declineReason === value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {declineReason === 'other' && (
            <textarea
              value={declineOtherText}
              onChange={(event) => setDeclineOtherText(event.target.value)}
              rows={2}
              placeholder="Reason"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {!declining ? (
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="h-14 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Decline review
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting}
            className="h-14 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Confirm decline'}
          </button>
        )}
        <button
          type="button"
          onClick={handleComplete}
          disabled={submitting || declining}
          className="h-14 flex-[2] rounded-xl bg-emerald-600 text-lg font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Complete review'}
        </button>
      </div>
    </div>
  )
}
