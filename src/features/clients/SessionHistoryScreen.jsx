import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SET_TYPE_LABEL = { S: 'Strength', T: 'Tone', E: 'Endurance' }
const STATUS_LABEL = {
  completed: 'Completed',
  late_cancel: 'Late cancel',
  no_show: 'No-show',
  unscheduled_walk_in: 'Unscheduled walk-in',
}

// PRD 6.10: "Session history across coaches -- full log per client." RLS
// (sessions_select, 0003_rls_policies.sql) has no per-coach filter -- any
// login that can see this client's location can already read every session
// there regardless of who ran it -- so this is reachable by any coach from
// ClientProfileScreen, not manager-gated. Capped at 50 most recent rather
// than building pagination this week.
export function SessionHistoryScreen({ clientId, onBack }) {
  const [client, setClient] = useState(null)
  const [sessions, setSessions] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: clientRow, error: clientError }, { data: sessionRows, error: sessionsError }] =
        await Promise.all([
          supabase.from('clients').select('name').eq('id', clientId).single(),
          supabase
            .from('sessions')
            .select(
              'id, started_at, ended_at, status, session_type, set_type, next_session_booked, users(name), coach_notes(execution_notes, physical_notes)'
            )
            .eq('client_id', clientId)
            .not('ended_at', 'is', null)
            .order('started_at', { ascending: false })
            .limit(50),
        ])

      if (cancelled) return
      if (clientError) {
        setLoadError(clientError.message)
        return
      }
      if (sessionsError) {
        setLoadError(sessionsError.message)
        return
      }
      setClient(clientRow)
      setSessions(sessionRows)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

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
          <h1 className="text-xl font-semibold text-slate-900">
            {client ? `${client.name} — Session history` : 'Session history'}
          </h1>
          <div className="w-16" />
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        )}

        {sessions === null && !loadError && (
          <p className="text-center text-slate-600">Loading…</p>
        )}

        {sessions?.length === 0 && (
          <p className="text-center text-slate-400">No completed sessions yet.</p>
        )}

        <div className="space-y-3">
          {sessions?.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-5 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {new Date(s.started_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {s.users?.name ?? 'Unknown coach'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {SET_TYPE_LABEL[s.set_type] ?? s.set_type} · {s.session_type} ·{' '}
                    {STATUS_LABEL[s.status] ?? s.status}
                    {s.next_session_booked === false && ' · next session not booked'}
                  </p>
                  {s.coach_notes?.execution_notes && (
                    <p className="mt-2 text-sm text-slate-600">{s.coach_notes.execution_notes}</p>
                  )}
                  {s.coach_notes?.physical_notes && (
                    <p className="mt-1 text-sm text-slate-500">{s.coach_notes.physical_notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
