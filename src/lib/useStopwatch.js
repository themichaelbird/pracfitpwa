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

  return { running, elapsedSeconds, start, stop, reset }
}
