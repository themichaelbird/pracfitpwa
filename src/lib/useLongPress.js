import { useRef } from 'react'

const LONG_PRESS_MS = 600

// Generic tap-and-hold gesture. Used to gate editing of the settings
// column (PRD 5.4: "protected from accidental edit") -- a plain tap does
// nothing, only a sustained press triggers onLongPress.
export function useLongPress(onLongPress) {
  const timerRef = useRef(null)
  const firedRef = useRef(false)

  function start() {
    firedRef.current = false
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  function clear() {
    clearTimeout(timerRef.current)
  }

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  }
}
