// What counts as "done" for a live session row: a time (or, for E, reps) is
// logged for the row's current classification. Gates advancing to the next
// cell (SessionWorkspace.jsx) and drives the collapsed row's checkmark
// (ExerciseCell.jsx). Outcome notations are optional and don't count.
//
// Checks the value, not just logId: a logged row changed across the E
// boundary (e.g. D -> E before any reps are entered) keeps its logId but has
// no value for its new shape yet -- and its classification change is held
// on the device until one is entered (useSessionCore.js saveLogPatch).
export function hasLoggedResult(draft) {
  if (!draft?.logId) return false
  return draft.movementClassification === 'E' ? draft.repsCompleted != null : draft.failureTime != null
}
