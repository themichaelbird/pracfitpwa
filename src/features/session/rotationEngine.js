// v0.2 req #3: default exercise order is CP -> HP -> PD -> LX -> OHP/INC ->
// ISO -> RW -> MHP -> Auxiliary A -> Auxiliary B -> (manually-added rows) ->
// Add More. That's Type B and Type A interleaved, not grouped -- and the
// Type A ordering itself (HP, LX, ISO, MHP) isn't alphabetical either, so
// both groups need a fixed canonical position order rather than a sort rule.
// Westlake-specific hardcoding, same precedent as the old
// ExerciseOrderSetupScreen's MACHINE_FIELD_DEFS.
const TYPE_A_CANONICAL_ORDER = ['HP', 'LX', 'ISO', 'MHP']

// PRD 8.3: "4 exercises cycle through positions across 4 sessions" -- Type B
// rows are still ordered by rotation_index (which exercise sits in which of
// the four interleaved B-slots changes session to session via
// advance_client_rotation), just interleaved with Type A now instead of
// grouped separately.
export function sortSessionRows(rows) {
  const typeA = rows
    .filter((row) => row.exerciseType === 'A' && !row.isAuxiliary && !row.isManuallyAdded)
    .sort(
      (a, b) =>
        TYPE_A_CANONICAL_ORDER.indexOf(a.abbreviation) - TYPE_A_CANONICAL_ORDER.indexOf(b.abbreviation)
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

  return [...interleaved, ...auxiliary, ...manuallyAdded]
}
