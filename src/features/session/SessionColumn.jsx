import { SessionColumnHeader } from './SessionColumnHeader'
import { ExerciseCell } from './ExerciseCell'

// v0.2 req #4/#5: before "Begin Session" is tapped there's no session row
// yet to show a real header for -- this renders in its place so the coach
// still sees the live column while prepping.
function PrepColumnHeader({ columnIndex }) {
  return (
    <div
      style={{ gridColumn: columnIndex, gridRow: 1 }}
      className="flex items-center justify-center bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700"
    >
      Not yet begun
    </div>
  )
}

// One column per session: up to two previous (read-only, columnData
// supplied by useSessionCore, index-aligned with `rows`) plus the live
// session (draftLogs, keyed by exerciseId) -- or, v0.2, a "prep" column
// (mode='prep') rendered before Begin Session is tapped, with no session
// row and inert logging inputs. Placed into the shared SessionWorkspace
// grid via explicit gridColumn/gridRow so every column's rows line up.
export function SessionColumn({
  rows,
  session,
  columnData,
  draftLogs,
  exercisesById,
  notationCatalog,
  columnIndex,
  readOnly,
  mode,
  isLive,
  canAssignAuxiliary,
  onAssignAuxiliary,
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
      {mode === 'prep' ? (
        <PrepColumnHeader columnIndex={columnIndex} />
      ) : (
        <SessionColumnHeader session={session} isLive={isLive} columnIndex={columnIndex} />
      )}

      {rows.map((row, index) => (
        <ExerciseCell
          key={row.exerciseId}
          row={row}
          columnIndex={columnIndex}
          gridRow={index + 2}
          readOnly={readOnly}
          mode={mode}
          sessionSetType={session?.set_type}
          columnEntry={readOnly ? columnData[index] : undefined}
          draft={readOnly || row.isPlaceholder ? undefined : draftLogs[row.exerciseId]}
          exercisesById={readOnly ? undefined : exercisesById}
          notationCatalog={notationCatalog}
          canAssignAuxiliary={canAssignAuxiliary}
          onAssignAuxiliary={onAssignAuxiliary}
          onUpdateDraft={readOnly ? undefined : (patch) => onUpdateDraft(row.exerciseId, patch)}
          onCommitFailureTime={
            readOnly ? undefined : (patch) => onCommitFailureTime(row.exerciseId, patch)
          }
          onUpdateLog={readOnly ? undefined : (patch) => onUpdateLog(row.exerciseId, patch)}
          onOpenNotes={readOnly ? undefined : onOpenNotes}
          onOpenSwap={readOnly || mode === 'prep' ? undefined : onOpenSwap}
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
