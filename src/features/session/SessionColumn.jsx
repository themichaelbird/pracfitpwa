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
  activeExerciseId,
  onActivate,
  onUpdateDraft,
  onCommitFailureTime,
  onUpdateLog,
  onOpenSwap,
  onChangeMovementClassification,
  onChangeSetType,
  onRemoveExercise,
  onChangeSecondPushPull,
  hipPressSplitState,
  onSplitHipPress,
  onRevertHipPressSplit,
  onSetHipPressSplitFreeze,
  onSetHipPressSplitLayout,
  onSetHipPressSplitSharedSettings,
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

      {/* This task, item 1: swap/classification/set-type are all available
          in prep mode now, not just live -- previously gated off entirely by
          `mode === 'prep'` below. Add-exercise already worked in prep
          (SessionWorkspace's AddExercisePicker was never gated on
          session/mode). */}
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
          isActive={!readOnly && !row.isPlaceholder ? row.exerciseId === activeExerciseId : undefined}
          onActivate={
            !readOnly && !row.isPlaceholder ? () => onActivate(row.exerciseId) : undefined
          }
          onUpdateDraft={readOnly ? undefined : (patch) => onUpdateDraft(row.exerciseId, patch)}
          onCommitFailureTime={
            readOnly ? undefined : (patch) => onCommitFailureTime(row.exerciseId, patch)
          }
          onUpdateLog={readOnly ? undefined : (patch) => onUpdateLog(row.exerciseId, patch)}
          onOpenSwap={readOnly ? undefined : onOpenSwap}
          onChangeMovementClassification={
            readOnly
              ? undefined
              : (value, permanent) => onChangeMovementClassification(row.exerciseId, value, permanent)
          }
          onChangeSetType={
            readOnly
              ? undefined
              : (override, value) => onChangeSetType(row.exerciseId, override, value)
          }
          onRemoveExercise={
            readOnly || row.isPlaceholder ? undefined : () => onRemoveExercise(row.exerciseId)
          }
          onChangeSecondPushPull={
            readOnly || row.isPlaceholder
              ? undefined
              : (enabled, weightOffset) => onChangeSecondPushPull(row.exerciseId, enabled, weightOffset)
          }
          hipPressSplitState={readOnly ? undefined : hipPressSplitState}
          onSplitHipPress={readOnly ? undefined : onSplitHipPress}
          onRevertHipPressSplit={readOnly ? undefined : onRevertHipPressSplit}
          onSetHipPressSplitFreeze={readOnly ? undefined : onSetHipPressSplitFreeze}
          onSetHipPressSplitLayout={readOnly ? undefined : onSetHipPressSplitLayout}
          onSetHipPressSplitSharedSettings={readOnly ? undefined : onSetHipPressSplitSharedSettings}
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
