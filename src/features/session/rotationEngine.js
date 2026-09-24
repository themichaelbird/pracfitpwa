// v0.2 req #3: default exercise order is CP -> HP -> PD -> LX -> OHP/INC ->
// ISO -> RW -> MHP -> Auxiliary A -> Auxiliary B -> (manually-added rows) ->
// Add More. That's Type B and Type A interleaved, not grouped -- and the
// Type A ordering itself (HP, LX, ISO, MHP) isn't alphabetical either, so
// both groups need a fixed canonical position order rather than a sort rule.
// Westlake-specific hardcoding, same precedent as the old
// ExerciseOrderSetupScreen's MACHINE_FIELD_DEFS.
const TYPE_A_CANONICAL_ORDER = ['HP', 'LX', 'ISO', 'MHP']

// This task, item 4 (Hip Press split): when a client's HP slot is split into
// HP(R)/HP(L), the LEADING side's row stands in for 'HP' in the canonical
// sort below -- useSessionCore.js includes only that row (tagged with its
// real abbreviation, 'HP(R)' or 'HP(L)') among the rows passed in here, so it
// needs to resolve to HP's canonical index the same way HP itself would.
// Every other abbreviation passes through unchanged.
function canonicalAbbreviation(abbreviation) {
  if (abbreviation === 'HP(R)' || abbreviation === 'HP(L)') return 'HP'
  return abbreviation
}

// PRD 8.3: "4 exercises cycle through positions across 4 sessions" -- Type B
// rows are still ordered by rotation_index (which exercise sits in which of
// the four interleaved B-slots changes session to session via
// advance_client_rotation), just interleaved with Type A now instead of
// grouped separately.
//
// This task, item 4: `hipPressSplit`, when provided, is
// { leadExerciseId, trailRow, layout }. `rows` already contains the leading
// side's row (see above) but never the trailing side -- it's excluded from
// every filter/sort above and spliced into the final list instead, exactly
// `layout === 'adjacent' ? 1 : 2` slots after wherever the leading side
// ended up. This is a plain array splice, not a clamped one: if the gap
// pushes the trailing side's absolute position past the fixed/rotating
// region entirely, it lands among the Aux rows instead (Aux shifts later to
// make room) rather than shortening the gap -- confirmed with Michael against
// the client's default 8-exercise order before this was implemented.
export function sortSessionRows(rows, hipPressSplit) {
  const typeA = rows
    .filter((row) => row.exerciseType === 'A' && !row.isAuxiliary && !row.isManuallyAdded)
    .sort(
      (a, b) =>
        TYPE_A_CANONICAL_ORDER.indexOf(canonicalAbbreviation(a.abbreviation)) -
        TYPE_A_CANONICAL_ORDER.indexOf(canonicalAbbreviation(b.abbreviation))
    )

  const typeB = rows
    .filter((row) => row.exerciseType === 'B' && !row.isAuxiliary && !row.isManuallyAdded)
    .sort((a, b) => a.rotationIndex - b.rotationIndex)

  const interleaved = []
  const slots = Math.max(typeA.length, typeB.length)
  for (let i = 0; i < slots; i += 1) {
    if (typeB[i]) interleaved.push(typeB[i])
    if (typeA[i]) interleaved.push(typeA[i])
  }

  const auxiliary = rows
    .filter((row) => row.isAuxiliary)
    .sort((a, b) => (a.auxiliarySlot ?? '').localeCompare(b.auxiliarySlot ?? ''))

  const manuallyAdded = rows
    .filter((row) => row.isManuallyAdded)
    .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))

  const result = [...interleaved, ...auxiliary, ...manuallyAdded]

  if (hipPressSplit) {
    const { leadExerciseId, trailRow, layout } = hipPressSplit
    const leadIndex = result.findIndex((row) => row.exerciseId === leadExerciseId)
    if (leadIndex !== -1) {
      const gap = layout === 'adjacent' ? 1 : 2
      result.splice(leadIndex + gap, 0, trailRow)
    }
  }

  return result
}
