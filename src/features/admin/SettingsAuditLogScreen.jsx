import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// PRD 6.10: "Settings audit log -- Dedicated log of all machine settings
// changes -- separate from coach notes." Read-only feed, most recent first,
// across every client visible to the signed-in login (RLS
// settings_audit_log_select, 0003_rls_policies.sql, already scopes this --
// own location, or every location for owner). Renders as tab content inside
// ManagerDashboardScreen.jsx, which owns the page chrome.
export function SettingsAuditLogScreen() {
  const [entries, setEntries] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('settings_audit_log')
        .select(
          'id, previous_settings, new_settings, reason, created_at, clients(name, locations(name)), users(name), exercises(abbreviation)'
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
        <p className="text-center text-slate-400">No settings changes logged yet.</p>
      )}

      {entries?.map((entry) => (
        <div key={entry.id} className="rounded-2xl bg-white p-5 shadow">
          <p className="font-medium text-slate-900">
            {entry.clients?.name}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {entry.exercises?.abbreviation}
              {entry.clients?.locations?.name && ` · ${entry.clients.locations.name}`}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {entry.users?.name ?? 'Unknown'} — {entry.reason}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {JSON.stringify(entry.previous_settings)} → {JSON.stringify(entry.new_settings)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(entry.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
