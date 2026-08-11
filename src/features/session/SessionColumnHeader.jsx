const SET_TYPE_LABEL = {
  S: 'Strength · 1:30',
  T: 'Tone · 2:15',
  E: 'Endurance · 3:00',
}

const SESSION_TYPE_LABEL = {
  recurring: 'RECURRING',
  flex: 'FLEX',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// PRD 5.4: date, RECURRING/FLEX badge, set type badge (S/T/E), LIVE
// indicator (current session only).
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
      <div className="flex gap-1">
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">
          {SESSION_TYPE_LABEL[session.session_type]}
        </span>
        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">
          {SET_TYPE_LABEL[session.set_type]}
        </span>
      </div>
    </div>
  )
}
