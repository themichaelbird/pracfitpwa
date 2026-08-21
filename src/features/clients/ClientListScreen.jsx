import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const COLOR_DOT = {
  P: 'bg-rose-500',
  C: 'bg-amber-500',
  E: 'bg-emerald-500',
}

// PRD 5.8: name search backed by the clients_name_idx trigram index.
// RLS (clients_select) already scopes results to the signed-in location
// (or all locations for the owner) -- no location filter needed here.
// PRD 6.1: archived clients stay retained/reactivatable, not deleted --
// the Active/Archived toggle is what makes an archived client reachable
// again (reactivating itself is just unchecking "Archived" on
// ClientProfileScreen.jsx, which already worked before this toggle existed).
export function ClientListScreen({ onClientSelected }) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [clients, setClients] = useState(null) // null = loading
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      let request = supabase
        .from('clients')
        .select('id, name, color_code, is_archived, locations(name)')
        .eq('is_archived', showArchived)
        .order('name')

      if (query.trim()) {
        request = request.ilike('name', `%${query.trim()}%`)
      }

      const { data, error } = await request

      if (cancelled) return

      if (error) {
        setLoadError(error.message)
        return
      }
      setClients(data)
    }

    loadClients()
    return () => {
      cancelled = true
    }
  }, [query, showArchived])

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Clients
        </h1>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name…"
          className="h-14 w-full rounded-xl border border-slate-300 px-4 text-lg text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`h-11 rounded-xl border text-sm font-medium transition ${
              !showArchived
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`h-11 rounded-xl border text-sm font-medium transition ${
              showArchived
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Archived
          </button>
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            Couldn't load clients: {loadError}
          </p>
        )}

        {clients === null ? (
          <p className="text-center text-slate-600">Loading clients…</p>
        ) : clients.length === 0 ? (
          <p className="text-center text-slate-600">
            {showArchived ? 'No archived clients.' : 'No clients found.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {clients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => onClientSelected(client.id)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-white px-5 py-4 text-left text-lg text-slate-900 shadow transition hover:bg-slate-50"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[client.color_code]}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{client.name}</span>
                  {client.locations?.name && (
                    <span className="text-sm font-normal text-slate-400">
                      {client.locations.name}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
