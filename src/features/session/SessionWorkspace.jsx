import { useState } from 'react'
import { SettingsColumn } from './SettingsColumn'
import { SessionColumn } from './SessionColumn'
import { NotesSidePanel } from './NotesSidePanel'
import { SwapExercisePicker } from './SwapExercisePicker'
import { AuxiliaryAssignmentPicker } from './AuxiliaryAssignmentPicker'
import { AddExercisePicker } from './AddExercisePicker'
import { BeginSessionPanel } from './BeginSessionPanel'
import { FloatingNotesButton } from './FloatingNotesButton'

// v0.2: settings sidebar is now independent of the session grid (see
// SettingsColumn.jsx) -- its row count no longer matches core.rows, so it
// no longer shares gridColumn/gridRow with the session columns. Previous
// session columns (read-only) and the live/prep column still share one CSS
// grid among themselves so their rows stay aligned. "Prep" mode (no session
// row yet -- req #4) renders the live column with inert logging inputs and
// a prominent Begin Session button; tapping it opens BeginSessionPanel.
export function SessionWorkspace({ core, onCloseSession, onBeginRequested, beginError }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [swapTarget, setSwapTarget] = useState(null) // row currently open in SwapExercisePicker, or null
  const [auxTarget, setAuxTarget] = useState(null) // row (placeholder or assigned) currently open in AuxiliaryAssignmentPicker
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [beginPanelOpen, setBeginPanelOpen] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [shuffleError, setShuffleError] = useState(null)

  const orderedPrevious = [...core.previousSessions].reverse()
  const columnCount = 1 + orderedPrevious.length

  // v0.1: the live column gets significantly more width than the read-only
  // previous-session columns so the enlarged StopwatchControl has room to
  // be legible and easy to tap one-handed -- previous columns stay compact.
  const sessionColumnsTemplate = [
    orderedPrevious.length > 0 ? `repeat(${orderedPrevious.length}, minmax(220px, 1fr))` : null,
    'minmax(420px, 1.7fr)',
  ]
    .filter(Boolean)
    .join(' ')

  async function handleShuffle() {
    setShuffling(true)
    setShuffleError(null)
    try {
      await core.shuffleRotation()
    } catch (err) {
      setShuffleError(err.message)
    } finally {
      setShuffling(false)
    }
  }

  function canAssignSlot(slot) {
    return slot === 'A' || core.hasCompletedSession
  }

  const existingExerciseIds = core.rows.filter((r) => !r.isPlaceholder).map((r) => r.exerciseId)

  return (
    <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
      <FloatingNotesButton
        hasSession={Boolean(core.session)}
        generalNote={core.notes?.general_note}
        onSave={core.saveNotes}
      />

      <SettingsColumn cards={core.machineSettingsCards} onUpdateSettings={core.updateMachineSettings} />

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3 flex items-center justify-end gap-3">
          {shuffleError && <p className="text-sm text-red-600">{shuffleError}</p>}
          {!core.session && beginError && <p className="text-sm text-red-600">{beginError}</p>}
          <button
            type="button"
            onClick={handleShuffle}
            disabled={shuffling}
            title="Manually advance rotation"
            className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {shuffling ? 'Shuffling…' : 'Shuffle'}
          </button>
          <button
            type="button"
            onClick={() => setAddExerciseOpen(true)}
            className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            + Add More
          </button>
          {core.session ? (
            <button
              type="button"
              onClick={onCloseSession}
              className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Close Session
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBeginPanelOpen(true)}
              className="h-14 rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-700"
            >
              Begin Session
            </button>
          )}
        </div>

        <div
          className="grid gap-px overflow-x-auto bg-slate-200"
          style={{ gridTemplateColumns: sessionColumnsTemplate }}
        >
          {orderedPrevious.map((column, index) => (
            <SessionColumn
              key={column.session.id}
              rows={core.rows}
              session={column.session}
              columnData={column.rows}
              columnIndex={index + 1}
              notationCatalog={core.notationCatalog}
              readOnly
            />
          ))}

          <SessionColumn
            key={core.session?.id ?? 'prep'}
            rows={core.rows}
            session={core.session}
            draftLogs={core.draftLogs}
            exercisesById={core.exercisesById}
            notationCatalog={core.notationCatalog}
            columnIndex={columnCount}
            readOnly={false}
            mode={core.session ? 'live' : 'prep'}
            isLive={Boolean(core.session)}
            canAssignAuxiliary={(row) => canAssignSlot(row.auxiliarySlot)}
            onAssignAuxiliary={(row) => setAuxTarget(row)}
            onUpdateDraft={core.updateDraft}
            onCommitFailureTime={core.commitFailureTime}
            onUpdateLog={core.updateLog}
            onOpenNotes={() => setNotesOpen(true)}
            onOpenSwap={(row) => setSwapTarget(row)}
            onToggleFlagNotation={core.toggleFlagNotation}
            onAdjustEffortNotation={core.adjustEffortNotation}
            onSelectOutcomeNotation={core.selectOutcomeNotation}
          />
        </div>
      </div>

      <NotesSidePanel
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={core.notes}
        onSave={core.saveNotes}
      />

      <SwapExercisePicker
        isOpen={Boolean(swapTarget)}
        row={swapTarget}
        currentExerciseId={swapTarget ? core.draftLogs[swapTarget.exerciseId]?.exerciseId : null}
        exercises={core.exerciseCatalog}
        onClose={() => setSwapTarget(null)}
        onConfirm={async ({ exerciseId, reason }) => {
          await core.swapExercise(swapTarget.exerciseId, exerciseId, reason)
          setSwapTarget(null)
        }}
      />

      <AuxiliaryAssignmentPicker
        isOpen={Boolean(auxTarget)}
        slot={auxTarget?.auxiliarySlot}
        exercises={core.exerciseCatalog}
        onClose={() => setAuxTarget(null)}
        onConfirm={async ({ exerciseId, movementClassification }) => {
          await core.assignAuxiliary(auxTarget.auxiliarySlot, exerciseId, movementClassification)
          setAuxTarget(null)
        }}
      />

      <AddExercisePicker
        isOpen={addExerciseOpen}
        exercises={core.exerciseCatalog}
        existingExerciseIds={existingExerciseIds}
        onClose={() => setAddExerciseOpen(false)}
        onConfirm={async (exerciseId) => {
          await core.addExerciseToOrder(exerciseId)
          setAddExerciseOpen(false)
        }}
      />

      <BeginSessionPanel
        isOpen={beginPanelOpen}
        error={beginError}
        onClose={() => setBeginPanelOpen(false)}
        onConfirm={async (options) => {
          await onBeginRequested(options)
          setBeginPanelOpen(false)
        }}
      />
    </div>
  )
}
