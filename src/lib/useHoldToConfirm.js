import { useCallback, useEffect, useRef, useState } from 'react'

// Press-and-hold to confirm an action (used by the session screen's Shuffle
// button). The action runs once, from a timer, after the finger has stayed
// down for HOLD_DURATION_MS without lifting or moving more than
// MOVE_TOLERANCE_PX. A quick tap does nothing.
//
// The decision logic lives in holdTransition below, a plain function with no
// React or browser code, so it can be tested with Node on its own
// (scripts/test-hold-to-confirm.mjs). The hook only feeds it pointer events
// and carries out the command it returns (start the timer, cancel it, or
// run the action).

export const HOLD_DURATION_MS = 2000
export const MOVE_TOLERANCE_PX = 10

// idle:    no press in progress.
// holding: the primary pointer is down and the timer is running.
// fired:   the action has run; nothing else happens until that pointer lifts.
export const PHASE_IDLE = 'idle'
export const PHASE_HOLDING = 'holding'
export const PHASE_FIRED = 'fired'

// What the hook must do after a transition.
export const COMMAND_NONE = 'none'
export const COMMAND_START_TIMER = 'startTimer'
export const COMMAND_CANCEL_TIMER = 'cancelTimer'
export const COMMAND_FIRE = 'fire'

export const INITIAL_HOLD_STATE = {
  phase: PHASE_IDLE,
  pointerId: null,
  startX: 0,
  startY: 0,
}

export function movedTooFar(startX, startY, x, y) {
  const distance = Math.hypot(x - startX, y - startY)
  return distance > MOVE_TOLERANCE_PX
}

function result(state, command) {
  return { state, command }
}

// Events:
//   { type: 'down', pointerId, isPrimary, button, x, y, disabled }
//   { type: 'move', pointerId, x, y }
//   { type: 'end', pointerId }      pointerup, pointercancel, lostpointercapture
//   { type: 'timer' }               the hold timer elapsed
//   { type: 'reset' }               button disabled, or component unmounting
export function holdTransition(state, event) {
  if (event.type === 'down') {
    if (event.disabled) return result(state, COMMAND_NONE)
    if (!event.isPrimary) return result(state, COMMAND_NONE)
    if (event.button !== 0) return result(state, COMMAND_NONE)
    if (state.phase !== PHASE_IDLE) return result(state, COMMAND_NONE)
    const holdingState = {
      phase: PHASE_HOLDING,
      pointerId: event.pointerId,
      startX: event.x,
      startY: event.y,
    }
    return result(holdingState, COMMAND_START_TIMER)
  }

  if (event.type === 'move') {
    if (state.phase !== PHASE_HOLDING) return result(state, COMMAND_NONE)
    if (event.pointerId !== state.pointerId) return result(state, COMMAND_NONE)
    if (!movedTooFar(state.startX, state.startY, event.x, event.y)) {
      return result(state, COMMAND_NONE)
    }
    return result(INITIAL_HOLD_STATE, COMMAND_CANCEL_TIMER)
  }

  if (event.type === 'end') {
    if (state.phase === PHASE_IDLE) return result(state, COMMAND_NONE)
    if (event.pointerId !== state.pointerId) return result(state, COMMAND_NONE)
    if (state.phase === PHASE_HOLDING) return result(INITIAL_HOLD_STATE, COMMAND_CANCEL_TIMER)
    return result(INITIAL_HOLD_STATE, COMMAND_NONE)
  }

  if (event.type === 'timer') {
    if (state.phase !== PHASE_HOLDING) return result(state, COMMAND_NONE)
    const firedState = { ...state, phase: PHASE_FIRED }
    return result(firedState, COMMAND_FIRE)
  }

  if (event.type === 'reset') {
    if (state.phase === PHASE_HOLDING) return result(INITIAL_HOLD_STATE, COMMAND_CANCEL_TIMER)
    return result(INITIAL_HOLD_STATE, COMMAND_NONE)
  }

  return result(state, COMMAND_NONE)
}

// Returns:
//   holding     true while the timer is running (drives the progress bar)
//   handlers    spread onto the button
export function useHoldToConfirm({ onConfirm, disabled }) {
  const [holding, setHolding] = useState(false)
  const stateRef = useRef(INITIAL_HOLD_STATE)
  const timerRef = useRef(null)
  const onConfirmRef = useRef(onConfirm)

  useEffect(() => {
    onConfirmRef.current = onConfirm
  }, [onConfirm])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dispatch = useCallback(
    (event) => {
      const { state, command } = holdTransition(stateRef.current, event)
      stateRef.current = state

      if (command === COMMAND_START_TIMER) {
        clearTimer()
        const timerId = setTimeout(() => {
          // Ignore a timer that was replaced or cleared in the meantime.
          if (timerRef.current !== timerId) return
          timerRef.current = null
          dispatch({ type: 'timer' })
        }, HOLD_DURATION_MS)
        timerRef.current = timerId
      } else if (command === COMMAND_CANCEL_TIMER) {
        clearTimer()
      }

      setHolding(state.phase === PHASE_HOLDING)

      if (command === COMMAND_FIRE) {
        onConfirmRef.current()
      }
    },
    [clearTimer]
  )

  // When the button becomes disabled (mid-hold, or right after firing),
  // return to idle. A disabled button may never receive the pointerup, so
  // without this a "fired" state could outlive the press and block the next
  // one once the button is enabled again (for example after a failed shuffle
  // that didn't reload the screen).
  useEffect(() => {
    if (disabled && stateRef.current.phase !== PHASE_IDLE) {
      dispatch({ type: 'reset' })
    }
  }, [disabled, dispatch])

  // The session screen unmounts this button while it reloads. A timer left
  // running must never fire after that.
  useEffect(() => {
    return () => {
      clearTimer()
      stateRef.current = INITIAL_HOLD_STATE
    }
  }, [clearTimer])

  function handlePointerDown(e) {
    const event = {
      type: 'down',
      pointerId: e.pointerId,
      isPrimary: e.isPrimary,
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      disabled,
    }
    dispatch(event)
    if (stateRef.current.phase === PHASE_HOLDING) {
      // Keep receiving this pointer's events even if it leaves the button,
      // so moving away is caught by the distance check.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Not supported: the distance check and pointercancel still apply.
      }
    }
  }

  function handlePointerMove(e) {
    dispatch({ type: 'move', pointerId: e.pointerId, x: e.clientX, y: e.clientY })
  }

  function handlePointerEnd(e) {
    dispatch({ type: 'end', pointerId: e.pointerId })
  }

  function handleContextMenu(e) {
    // No long-press callout or context menu on the hold button.
    e.preventDefault()
  }

  const handlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    onLostPointerCapture: handlePointerEnd,
    onContextMenu: handleContextMenu,
  }

  return { holding, handlers }
}
