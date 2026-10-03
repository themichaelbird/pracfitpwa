import { useCallback, useEffect, useRef, useState } from 'react'

// Generic manual stopwatch: start/stop, elapsed whole seconds while running.
// start() returns the start timestamp it counts from, and resumeFrom() picks
// a running stopwatch back up from one -- so a caller can keep it somewhere
// that survives the app closing (SessionWorkspace.jsx).
export function useStopwatch() {
  const [running, setRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAtRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const tick = useCallback(() => {
    setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
  }, [])

  const start = useCallback(() => {
    if (running) return startedAtRef.current
    startedAtRef.current = Date.now() - elapsedSeconds * 1000
    setRunning(true)
    intervalRef.current = setInterval(tick, 250)
    return startedAtRef.current
  }, [running, elapsedSeconds, tick])

  const resumeFrom = useCallback(
    (startedAt) => {
      clearInterval(intervalRef.current)
      startedAtRef.current = startedAt
      tick()
      setRunning(true)
      intervalRef.current = setInterval(tick, 250)
    },
    [tick]
  )

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    return elapsedSeconds
  }, [elapsedSeconds])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsedSeconds(0)
  }, [])

  return { running, elapsedSeconds, start, stop, reset, resumeFrom }
}
