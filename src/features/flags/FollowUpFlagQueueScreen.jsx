import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// PRD 6.10/15.2: manager's morning view, unresolved follow-up flags across
// the location -- "primary MVP retention tool." RLS (follow_up_flags_all,
// 0003_rls_policies.sql) already scopes visible rows to the signed-in
// location (or all locations for owner), so this query needs no explicit
// location filter -- just resolved = false. Entry point in App.jsx is
// gated on coach.role !== 'coach'; there's no dedicated manager-mode toggle
// yet (that's PRD 6.9, explicitly Week 11 in the dev sequence), so this
// screen is reachable directly rather than through a mode switch.
export function FollowUpFlagQueueScreen({ coach, onBack }) {
  const [flags, setFlags] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoadError(null)
    const { data, error } = await supabase
      .from('follow_up_flags')
      .select('id, reason, created_at, clients(name, locations(name))')
      .eq('resolved', false)
      .order('created_at', { ascending: true })

    if (error) {
      setLoadError(error.message)
      return
    }
    setFlags(data)
  }

  async function handleResolve(flagId) {
    setResolvingId(flagId)
    try {
      const { error } = await supabase
        .from('follow_up_flags')
        .update({ resolved: true, resolved_by: coach.id, resolved_at: new Date().toISOString() })
        .eq('id', flagId)
      if (error) throw error
      setFlags((current) => current.filter((f) => f.id !== flagId))
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setResolvingId(null)
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
          <h1 className="text-xl font-semibold text-slate-900">Follow-up flags</h1>
          <div className="w-16" />
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        )}

        {flags === null && !loadError && <p className="text-center text-slate-600">Loading…</p>}

        {flags?.length === 0 && (
          <p className="text-center text-slate-400">No unresolved follow-up flags.</p>
        )}

        <div className="space-y-3">
          {flags?.map((flag) => (
            <div key={flag.id} className="rounded-2xl bg-white p-5 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {flag.clients?.name}
                    {flag.clients?.locations?.name && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {flag.clients.locations.name}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{flag.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(flag.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResolve(flag.id)}
                  disabled={resolvingId === flag.id}
                  className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {resolvingId === flag.id ? 'Resolving…' : 'Resolve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
