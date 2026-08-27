// v0.2 req #8: machine settings column order is fixed regardless of exercise
// order -- HP, CP, RW, PD, "Incline/OHP" (combined -- OHP and INC share one
// physical machine, see 0018_v0_2_session_restructure.sql), LX, ISO, then an
// Add More button. These 7 always render, in this order, keyed by
// machine_name (client_machine_settings) rather than by exercise -- that's
// what lets MHP share HP's card (req #14) instead of duplicating it.
export const FIXED_MACHINE_CARDS = [
  ['Hip Press Machine', 'HP'],
  ['Chest Press Machine', 'CP'],
  ['Row Machine', 'RW'],
  ['Pull Down Machine', 'PD'],
  ['Incline/OHP Machine', 'Incline/OHP'],
  ['Lumbar Extension Machine', 'LX'],
  ['Ab ISO Machine', 'ISO'],
]

export const FIXED_MACHINE_NAMES = new Set(FIXED_MACHINE_CARDS.map(([name]) => name))

// PRD 6.5 field suggestions, keyed by machine_name -- pre-fills the field
// keys a coach fills in on first open so they aren't guessing field names.
// settings stays a free-form jsonb blob either way (client_machine_settings
// or client_exercise_settings), so keys can still be added/removed freely
// for machines not covered here.
export const MACHINE_FIELD_DEFS = {
  'Hip Press Machine': ['SH', 'S', 'SB'],
  'Chest Press Machine': ['S', 'B', 'R'],
  'Pull Down Machine': ['S', 'R'],
  'Row Machine': ['C', 'R'],
  'Incline/OHP Machine': ['S', 'I', 'O'],
  'Lumbar Extension Machine': ['F', 'K'],
  'Rotary Torso Machine': ['F', 'K', 'R'],
  'Fly Machine': ['SB', 'R', 'C'],
  'Ab ISO Machine': ['S', 'R'],
  'Leg Extension Machine': ['S', 'R'],
}

export function defaultSettingsFor(machineName) {
  const keys = MACHINE_FIELD_DEFS[machineName]
  if (!keys) return {}
  return Object.fromEntries(keys.map((key) => [key, '']))
}
