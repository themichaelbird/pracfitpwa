import { SessionColumnHeader } from './SessionColumnHeader'
import { ExerciseCell } from './ExerciseCell'

// One column per session: up to two previous (read-only, columnData
// supplied by useSessionCore, index-aligned with `rows`) plus the live
// session (draftLogs, keyed by exerciseId). Placed into the shared
// SessionWorkspace grid via explicit gridColumn/gridRow so every column's
// rows line up with the settings column regardless of cell content height.
export function SessionColumn({
  rows,
  session,
  columnData,
  draftLogs,
  exercisesById,
  notationCatalog,
  columnIndex,
  readOnly,
  isLive,
  onUpdateDraft,
  onCommitFailureTime,
  onUpdateLog,
  onOpenNotes,
  onOpenSwap,
  onToggleFlagNotation,
  onAdjustEffortNotation,
  onSelectOutcomeNotation,
}) {
  return (
    <>
      <SessionColumnHeader session={session} isLive={isLive} columnIndex={columnIndex} />

      {rows.map((row, index) => (
        <ExerciseCell
          key={row.exerciseId}
          row={row}
          columnIndex={columnIndex}
          gridRow={index + 2}
          readOnly={readOnly}
          sessionSetType={session.set_type}
          columnEntry={readOnly ? columnData[index] : undefined}
          draft={readOnly ? undefined : draftLogs[row.exerciseId]}
          exercisesById={readOnly ? undefined : exercisesById}
          notationCatalog={notationCatalog}
          onUpdateDraft={readOnly ? undefined : (patch) => onUpdateDraft(row.exerciseId, patch)}
          onCommitFailureTime={
            readOnly ? undefined : (patch) => onCommitFailureTime(row.exerciseId, patch)
          }
          onUpdateLog={readOnly ? undefined : (patch) => onUpdateLog(row.exerciseId, patch)}
          onOpenNotes={readOnly ? undefined : onOpenNotes}
          onOpenSwap={readOnly ? undefined : onOpenSwap}
          onToggleFlagNotation={
            readOnly ? undefined : (notation) => onToggleFlagNotation(row.exerciseId, notation)
          }
          onAdjustEffortNotation={
            readOnly
              ? undefined
              : (notation, delta) => onAdjustEffortNotation(row.exerciseId, notation, delta)
          }
          onSelectOutcomeNotation={
            readOnly ? undefined : (notation) => onSelectOutcomeNotation(row.exerciseId, notation)
          }
        />
      ))}
    </>
  )
}
