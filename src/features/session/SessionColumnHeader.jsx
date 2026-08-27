const SET_TYPE_LABEL = {
  S: 'Strength · 1:30',
  T: 'Tone · 2:15',
  E: 'Endurance · 3:00',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// PRD 5.4, v0.2 req #7: date, set type badge (S/T/E), LIVE indicator
// (current session only). The RECURRING/FLEX session-type badge is gone --
// session_type no longer exists (replaced entirely by
// clients.membership_package_type, which lives only on the client profile).
export function SessionColumnHeader({ session, isLive, columnIndex }) {
  return (
    <div
      style={{ gridColumn: columnIndex, gridRow: 1 }}
      className={`space-y-1 px-3 py-2 ${isLive ? 'bg-emerald-50' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">
          {formatDate(session.started_at)}
        </span>
        {isLive && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
            LIVE
          </span>
        )}
      </div>
      <span className="inline-block rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">
        {SET_TYPE_LABEL[session.set_type]}
      </span>
    </div>
  )
}
