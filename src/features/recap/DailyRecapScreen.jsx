import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const CANCEL_STATUSES = ['late_cancel', 'no_show']

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function defaultBlock() {
  return new Date().getHours() < 12 ? 'AM' : 'PM'
}

// Local-day boundaries for a 'YYYY-MM-DD' input value -- constructing via
// the (y, m, d) Date constructor (not the ISO-string form, which parses as
// UTC midnight) so "today" means the coach's device's calendar day, not UTC.
function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 1)
  return { start, end }
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// PRD 15.1: exact plain-text recap format. "Sessions scheduled" renders as
// "—" -- there's no Schedule/manual-entry feature (PRD 6.6) yet, so that
// count genuinely can't be derived; Completed/Late cancellations/No-shows
// are real counts from sessions.status. Becomes a real number once the
// Schedule view exists to define what was actually scheduled for the day.
function buildRecapText({ locationName, dateStr, block, sessions, followUpCount }) {
  const completed = sessions.filter((s) => !CANCEL_STATUSES.includes(s.status)).length
  const lateCancellations = sessions.filter((s) => s.status === 'late_cancel').length
  const noShows = sessions.filter((s) => s.status === 'no_show').length
  const notBooked = sessions.filter((s) => s.next_session_booked === false)

  const lines = [
    `Practical Fitness — ${locationName} Daily Recap — ${formatDate(dateStr)} Block ${block}`,
    '',
    `Sessions scheduled: — | Completed: ${completed} | Late cancellations: ${lateCancellations} | No-shows: ${noShows}`,
    `Clients without next session booked: ${notBooked.length}${
      notBooked.length > 0 ? ' — ' + notBooked.map((s) => s.clients?.name).join(', ') : ''
    }`,
    `Coach notes flagged for manager review: ${followUpCount}`,
  ]

  for (const s of sessions) {
    const notes = s.coach_notes?.[0] ?? s.coach_notes ?? {}
    const time = new Date(s.started_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    lines.push(
      '',
      `${s.clients?.name} — ${time}`,
      `Execution: ${notes.execution_notes || '—'}`,
      `Physical: ${notes.physical_notes || '—'}`,
      `Machine changes: ${notes.machine_changes_notes || '—'}`,
      `Personal: ${notes.personal_notes || '—'}`
    )
  }

  return lines.join('\n')
}

// PRD 6.7/15.1: auto-generated daily recap, copy-to-WhatsApp, permanent
// storage (daily_recaps, migration 0015). Available to any coach (it's the
// outgoing coach's own end-of-shift task, PRD 5.7), unlike the manager-only
// follow-up queue.
export function DailyRecapScreen({ coach, locationId, onBack }) {
  const [dateStr, setDateStr] = useState(todayDate())
  const [block, setBlock] = useState(defaultBlock())
  const [locationName, setLocationName] = useState('')
  const [recapText, setRecapText] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('locations')
      .select('name')
      .eq('id', locationId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setLocationName(data.name)
      })
    return () => {
      cancelled = true
    }
  }, [locationId])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setSaved(false)
    try {
      const { start, end } = dayBounds(dateStr)

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(
          'id, started_at, status, next_session_booked, clients(name), coach_notes(execution_notes, physical_notes, machine_changes_notes, personal_notes)'
        )
        .eq('location_id', locationId)
        .not('ended_at', 'is', null)
        .gte('started_at', start.toISOString())
        .lt('started_at', end.toISOString())
        .order('started_at', { ascending: true })
      if (sessionsError) throw sessionsError

      // follow_up_flags has no location_id column -- scoped via clients,
      // filtered client-side rather than an embedded-resource dot-filter
      // (matches how Type D swap candidates avoided that in useSessionCore).
      const { data: flagRows, error: flagsError } = await supabase
        .from('follow_up_flags')
        .select('id, created_at, clients(location_id)')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
      if (flagsError) throw flagsError
      const followUpCount = flagRows.filter((f) => f.clients?.location_id === locationId).length

      setRecapText(
        buildRecapText({ locationName, dateStr, block, sessions, followUpCount })
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recapText)
      setError(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(`Couldn't copy to clipboard: ${err.message}`)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { error: saveErr } = await supabase.from('daily_recaps').insert({
        location_id: locationId,
        generated_by: coach.id,
        recap_date: dateStr,
        block,
        recap_text: recapText,
      })
      if (saveErr) throw saveErr
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-xl font-semibold text-slate-900">Daily recap</h1>
          <div className="w-16" />
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Date</span>
              <input
                type="date"
                value={dateStr}
                onChange={(event) => setDateStr(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Block</span>
              <div className="grid grid-cols-2 gap-2">
                {['AM', 'PM'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBlock(b)}
                    className={`h-12 rounded-xl border text-sm font-medium transition ${
                      block === b
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="h-12 w-full rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate recap'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {recapText && (
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">
              {recapText}
            </pre>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="h-12 flex-1 rounded-xl bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {copied ? 'Copied!' : 'Copy to WhatsApp'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save recap'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
