import { useEffect, useRef, useState } from 'react'
import { countQueuedMutations, onOutboxChanged } from './offlineQueue'
import { isServerReachable, onConnectivityChanged } from './mutateOnlineOrQueue'

// PRD 7: "Syncs on reconnect." Tracks connectivity for display --
// navigator.onLine AND whether the last request actually reached Supabase,
// since navigator.onLine stays true on WiFi with no internet -- and the
// outbox's pending count for OfflineStatusBadge -- PRD 7's data-integrity
// principle means a coach should never have to wonder whether an entry made
// offline is actually going to reach the server. Draining the outbox itself
// happens independently of this hook's lifecycle (see the module-level
// 'online' listener in mutateOnlineOrQueue.js) -- a coach can navigate away
// from the session screen before reconnecting, so that can't depend on this
// component still being mounted. This hook instead reloads the caller's
// session (onReconnect, e.g. core.reload) by watching the outbox for this
// client drop back to zero, which works correctly whether the drain
// happened while this screen was open or already finished before it mounted.
export function useOnlineStatus(onReconnect) {
  const [online, setOnline] = useState(navigator.onLine && isServerReachable())
  const [pendingCount, setPendingCount] = useState(0)
  const wasPendingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    function refreshCount() {
      countQueuedMutations().then((count) => {
        if (cancelled) return
        setPendingCount(count)
        if (wasPendingRef.current && count === 0) {
          onReconnect?.()
        }
        wasPendingRef.current = count > 0
      })
    }

    function refreshOnline() {
      setOnline(navigator.onLine && isServerReachable())
    }

    refreshCount()
    refreshOnline()
    const unsubscribe = onOutboxChanged(refreshCount)
    const unsubscribeConnectivity = onConnectivityChanged(refreshOnline)
    window.addEventListener('online', refreshOnline)
    window.addEventListener('offline', refreshOnline)
    return () => {
      cancelled = true
      unsubscribe()
      unsubscribeConnectivity()
      window.removeEventListener('online', refreshOnline)
      window.removeEventListener('offline', refreshOnline)
    }
  }, [onReconnect])

  return { online, pendingCount }
}
