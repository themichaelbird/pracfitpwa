import { useCallback, useEffect, useRef, useState } from 'react'

// Generic manual stopwatch: start/stop, elapsed whole seconds while running.
export function useStopwatch() {
  const [running, setRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAtRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const start = useCallback(() => {
    if (running) return
    startedAtRef.current = Date.now() - elapsedSeconds * 1000
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
  }, [running, elapsedSeconds])

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

  // Unconditional reset-and-go, independent of the `running`/`elapsedSeconds`
  // closures start()/reset() capture -- needed by callers (a shared stopwatch
  // switching which exercise it's tracking) that fire from an effect and
  // can't rely on a stale `running` read from a prior render.
  const restart = useCallback(() => {
    clearInterval(intervalRef.current)
    startedAtRef.current = Date.now()
    setElapsedSeconds(0)
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
  }, [])

  return { running, elapsedSeconds, start, stop, reset, restart }
}
