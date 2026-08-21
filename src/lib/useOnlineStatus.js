import { useEffect, useRef, useState } from 'react'
import { countQueuedMutations, onOutboxChanged } from './offlineQueue'

// PRD 7: "Syncs on reconnect." Tracks navigator.onLine for display, and the
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
  const [online, setOnline] = useState(navigator.onLine)
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

    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }

    refreshCount()
    const unsubscribe = onOutboxChanged(refreshCount)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [onReconnect])

  return { online, pendingCount }
}
