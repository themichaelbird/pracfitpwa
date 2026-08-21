// PRD 7: "No session data losable from accidental tap... offline session
// logging required." A coach shouldn't have to wonder whether an entry made
// with no signal actually reached the server -- this makes the pending-sync
// state visible instead of silent. Nothing renders when there's nothing to
// report (online, empty outbox).
export function OfflineStatusBadge({ online, pendingCount }) {
  if (online && pendingCount === 0) return null

  const label = !online
    ? pendingCount > 0
      ? `Offline — ${pendingCount} pending`
      : 'Offline'
    : `Syncing — ${pendingCount} pending`

  return (
    <span
      role="status"
      className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
    >
      {label}
    </span>
  )
}
