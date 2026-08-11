const COLOR_DOT = {
  P: 'bg-rose-500',
  C: 'bg-amber-500',
  E: 'bg-emerald-500',
}

// PRD 5.4: always visible at the top of the session screen, regardless of
// which step (gate / pain intake / workspace / close) is showing.
export function ClientHeaderBar({ client, onBack }) {
  return (
    <div className="flex items-center justify-between bg-white px-6 py-3 shadow">
      <button
        type="button"
        onClick={onBack}
        className="h-11 rounded-xl px-3 text-slate-600 hover:text-slate-900"
      >
        ← Back
      </button>

      <div className="flex items-center gap-4">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[client.color_code]}`}
          aria-hidden="true"
        />
        <span className="text-lg font-semibold text-slate-900">{client.name}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>🎵 {client.music_preference || '—'}</span>
        <span>🌀 {client.fan_preference || '—'}</span>
      </div>
    </div>
  )
}
