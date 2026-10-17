// Practical Fitness Coach Platform
// Check for the press-and-hold decision logic in src/lib/useHoldToConfirm.js.
//
// Run:
//   node scripts/test-hold-to-confirm.mjs
//
// Tests holdTransition, the plain function the hook uses to decide what
// happens on each pointer event. It does not test React, the browser, the
// real timer or any device. No database, no network, no new dependencies.
import assert from 'node:assert/strict'
import {
  COMMAND_CANCEL_TIMER,
  COMMAND_FIRE,
  COMMAND_NONE,
  COMMAND_START_TIMER,
  HOLD_DURATION_MS,
  INITIAL_HOLD_STATE,
  MOVE_TOLERANCE_PX,
  PHASE_FIRED,
  PHASE_HOLDING,
  PHASE_IDLE,
  holdTransition,
  movedTooFar,
} from '../src/lib/useHoldToConfirm.js'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

function down(overrides = {}) {
  return {
    type: 'down',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    x: 100,
    y: 100,
    disabled: false,
    ...overrides,
  }
}

// Runs a list of events from the initial state. Returns the final state and
// every command, in order.
function run(events) {
  let state = INITIAL_HOLD_STATE
  const commands = []
  for (const event of events) {
    const next = holdTransition(state, event)
    state = next.state
    commands.push(next.command)
  }
  return { state, commands }
}

function countFires(commands) {
  return commands.filter((c) => c === COMMAND_FIRE).length
}

test('constants match the agreed values', () => {
  assert.equal(HOLD_DURATION_MS, 2000)
  assert.equal(MOVE_TOLERANCE_PX, 10)
})

test('a press starts the timer and enters holding', () => {
  const { state, commands } = run([down()])
  assert.equal(state.phase, PHASE_HOLDING)
  assert.deepEqual(commands, [COMMAND_START_TIMER])
})

test('a quick tap (down then up before the timer) never fires', () => {
  const { state, commands } = run([down(), { type: 'end', pointerId: 1 }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.deepEqual(commands, [COMMAND_START_TIMER, COMMAND_CANCEL_TIMER])
  assert.equal(countFires(commands), 0)
})

test('holding until the timer fires runs the action once', () => {
  const { state, commands } = run([down(), { type: 'timer' }])
  assert.equal(state.phase, PHASE_FIRED)
  assert.equal(countFires(commands), 1)
})

test('a second timer event for the same press does not fire again', () => {
  const { commands } = run([down(), { type: 'timer' }, { type: 'timer' }])
  assert.equal(countFires(commands), 1)
})

test('after firing, lifting returns to idle without firing', () => {
  const { state, commands } = run([down(), { type: 'timer' }, { type: 'end', pointerId: 1 }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(countFires(commands), 1)
  assert.equal(commands.at(-1), COMMAND_NONE)
})

test('after firing, a new press is ignored until the first one lifts', () => {
  const { commands } = run([down(), { type: 'timer' }, down({ pointerId: 2 }), { type: 'timer' }])
  assert.equal(countFires(commands), 1)
})

test('a full second press after lifting can fire again', () => {
  const { commands } = run([
    down(),
    { type: 'timer' },
    { type: 'end', pointerId: 1 },
    down(),
    { type: 'timer' },
  ])
  assert.equal(countFires(commands), 2)
})

test('pointercancel (e.g. a scroll took over) cancels the hold', () => {
  const { state, commands } = run([down(), { type: 'end', pointerId: 1 }, { type: 'timer' }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(countFires(commands), 0)
})

test('moving 10 px or less keeps holding', () => {
  const { state, commands } = run([
    down(),
    { type: 'move', pointerId: 1, x: 106, y: 108 }, // exactly 10 px away
    { type: 'timer' },
  ])
  assert.equal(state.phase, PHASE_FIRED)
  assert.equal(countFires(commands), 1)
})

test('moving more than 10 px cancels, and the timer then does nothing', () => {
  const { state, commands } = run([
    down(),
    { type: 'move', pointerId: 1, x: 111, y: 100 },
    { type: 'timer' },
  ])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(commands[1], COMMAND_CANCEL_TIMER)
  assert.equal(countFires(commands), 0)
})

test('movedTooFar measures straight-line distance', () => {
  assert.equal(movedTooFar(0, 0, 6, 8), false) // 10 px
  assert.equal(movedTooFar(0, 0, 8, 8), true) // about 11.3 px
  assert.equal(movedTooFar(0, 0, -11, 0), true)
})

test('a non-primary pointer does not start a hold', () => {
  const { state, commands } = run([down({ isPrimary: false }), { type: 'timer' }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(countFires(commands), 0)
})

test('a non-main mouse button does not start a hold', () => {
  const { state } = run([down({ button: 2 })])
  assert.equal(state.phase, PHASE_IDLE)
})

test('a press while disabled does not start a hold', () => {
  const { state, commands } = run([down({ disabled: true }), { type: 'timer' }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(countFires(commands), 0)
})

test('events from another pointer do not cancel or end the hold', () => {
  const { state, commands } = run([
    down(),
    { type: 'move', pointerId: 2, x: 500, y: 500 },
    { type: 'end', pointerId: 2 },
    { type: 'timer' },
  ])
  assert.equal(state.phase, PHASE_FIRED)
  assert.equal(countFires(commands), 1)
})

test('reset mid-hold (disabled or unmounting) cancels, and the timer then does nothing', () => {
  const { state, commands } = run([down(), { type: 'reset' }, { type: 'timer' }])
  assert.equal(state.phase, PHASE_IDLE)
  assert.equal(commands[1], COMMAND_CANCEL_TIMER)
  assert.equal(countFires(commands), 0)
})

test('reset after firing returns to idle so the next press works', () => {
  const { state, commands } = run([
    down(),
    { type: 'timer' },
    { type: 'reset' },
    down(),
    { type: 'timer' },
  ])
  assert.equal(state.phase, PHASE_FIRED)
  assert.equal(countFires(commands), 2)
})

test('moves and ends while idle do nothing', () => {
  const { state, commands } = run([
    { type: 'move', pointerId: 1, x: 0, y: 0 },
    { type: 'end', pointerId: 1 },
    { type: 'timer' },
  ])
  assert.equal(state.phase, PHASE_IDLE)
  assert.deepEqual(commands, [COMMAND_NONE, COMMAND_NONE, COMMAND_NONE])
})

console.log(`\n${passed} tests passed`)
