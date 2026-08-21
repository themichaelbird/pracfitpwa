import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const COLOR_LABEL = { P: 'Pain', C: 'Caution', E: 'Easy' }

// PRD 6.10: "Color code change log -- All P/C/E changes with author and
// timestamp." Read-only feed, most recent first, across every client
// visible to the signed-in login (RLS color_code_log_select,
// 0003_rls_policies.sql, already scopes this). Renders as tab content
// inside ManagerDashboardScreen.jsx, which owns the page chrome.
export function ColorCodeLogScreen() {
  const [entries, setEntries] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('color_code_log')
        .select(
          'id, previous_color_code, new_color_code, created_at, clients(name, locations(name)), users(name)'
        )
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        return
      }
      setEntries(data)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-3">
      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}

      {entries === null && !loadError && <p className="text-center text-slate-600">Loading…</p>}

      {entries?.length === 0 && (
        <p className="text-center text-slate-400">No color code changes logged yet.</p>
      )}

      {entries?.map((entry) => (
        <div key={entry.id} className="rounded-2xl bg-white p-5 shadow">
          <p className="font-medium text-slate-900">
            {entry.clients?.name}
            {entry.clients?.locations?.name && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                {entry.clients.locations.name}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {entry.users?.name ?? 'Unknown'} —{' '}
            {entry.previous_color_code ? `${COLOR_LABEL[entry.previous_color_code]} → ` : ''}
            {COLOR_LABEL[entry.new_color_code]}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(entry.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
