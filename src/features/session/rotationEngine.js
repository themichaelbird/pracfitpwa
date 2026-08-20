// PRD 8.2/8.3: Type A rows are fixed and always present; Type B rows rotate
// position by a mutable per-client rotation_index (advanced by the
// advance_client_rotation DB function -- see useSessionCore.js); the single
// auxiliary row (Type C, PRD 8.2/8.3: "two or three auxiliary slots per
// client alternating per session") is synthesized separately and always
// sorted last. Pure function, no Supabase import, so it's independently
// testable against the rotation math without a live session.
export function sortSessionRows(rows) {
  const typeA = rows
    .filter((row) => row.exerciseType === 'A')
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))

  const typeB = rows
    .filter((row) => row.exerciseType === 'B')
    .sort((a, b) => a.rotationIndex - b.rotationIndex)

  const auxiliary = rows.filter((row) => row.isAuxiliary)

  return [...typeA, ...typeB, ...auxiliary]
}
