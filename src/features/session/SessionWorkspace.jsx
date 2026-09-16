import { useEffect, useState } from 'react'
import { SettingsColumn } from './SettingsColumn'
import { SessionColumn } from './SessionColumn'
import { NotesSidePanel } from './NotesSidePanel'
import { SwapExercisePicker } from './SwapExercisePicker'
import { AuxiliaryAssignmentPicker } from './AuxiliaryAssignmentPicker'
import { AddExercisePicker } from './AddExercisePicker'
import { BeginSessionPanel } from './BeginSessionPanel'
import { FloatingNotesButton } from './FloatingNotesButton'
import { StopwatchControl } from './StopwatchControl'
import { useStopwatch } from '../../lib/useStopwatch'

// v0.2: settings sidebar is now independent of the session grid (see
// SettingsColumn.jsx) -- its row count no longer matches core.rows, so it
// no longer shares gridColumn/gridRow with the session columns. Previous
// session columns (read-only) and the live/prep column still share one CSS
// grid among themselves so their rows stay aligned. "Prep" mode (no session
// row yet -- req #4) renders the live column with inert logging inputs and
// a prominent Begin Session button; tapping it opens BeginSessionPanel.
//
// This task (coach session UI/UX pass), req #2-4: only one exercise cell in
// the live/prep column renders expanded at a time (activeExerciseId) --
// every other row collapses to a compact summary row, which is what keeps
// the whole exercise list on screen without scrolling even though the CSS
// grid still auto-sizes each row to its tallest cell. The per-cell stopwatch
// is gone; one shared stopwatch (top-middle) tracks whichever cell is
// active.
//
// Follow-up pass: the stopwatch is fully manual now (no auto-start/restart
// on activation -- the coach taps play). Switching which cell is active is
// gated on the outgoing exercise's outcome (PRD 13.3: mandatory before
// advancing) being logged first; once that gate passes, any unrecorded
// elapsed time is still silently captured as a safety net (mainly for
// M-classification failure_time, PRD 21.3) before the display resets to
// 0:00 for the newly active cell.
export function SessionWorkspace({ core, onCloseSession, onBeginRequested, beginError }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [swapTarget, setSwapTarget] = useState(null) // row currently open in SwapExercisePicker, or null
  const [auxTarget, setAuxTarget] = useState(null) // row (placeholder or assigned) currently open in AuxiliaryAssignmentPicker
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [beginPanelOpen, setBeginPanelOpen] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [shuffleError, setShuffleError] = useState(null)
  const [activeExerciseId, setActiveExerciseId] = useState(null)
  const [switchBlockedMessage, setSwitchBlockedMessage] = useState(null)

  const stopwatch = useStopwatch()

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

  // Keeps a valid active exercise selected as rows load in, get added
  // (Add More / Auxiliary assignment), or a session begins -- defaults to
  // the first real (non-placeholder) row.
  useEffect(() => {
    if (activeExerciseId && core.rows.some((r) => r.exerciseId === activeExerciseId && !r.isPlaceholder)) {
      return
    }
    const firstRow = core.rows.find((r) => !r.isPlaceholder)
    setActiveExerciseId(firstRow ? firstRow.exerciseId : null)
  }, [core.rows, activeExerciseId])

  // Req #1/#2/#4 (follow-up pass): switching the active cell is gated on the
  // outgoing exercise's outcome (a notation from the outcome category --
  // ⓞⓚ / ⓞⓚ SP / F / NA -- the same predicate CollapsedExerciseRow uses for
  // its checkmark) already being logged. If it isn't, the switch is blocked
  // with a message and the stopwatch is left exactly as the coach left it.
  // Once the gate passes, any unrecorded elapsed time is captured as a
  // safety net (item #4) before the display resets to 0:00 -- but nothing
  // auto-starts it for the newly active cell (item #2); that's a manual tap.
  //
  // Back-navigation follow-up: the gate above is meant to stop the coach from
  // *advancing* past an exercise whose outcome isn't logged yet -- it was
  // never meant to block going back to re-open one that's already done. So
  // the block only applies when the target ALSO has no outcome logged yet
  // (i.e. this is a forward move to fresh work); tapping any row that already
  // has an outcome -- including a previously-completed one -- is always
  // allowed, regardless of whether the exercise being left is finished.
  async function handleActivateExercise(exerciseId) {
    if (exerciseId === activeExerciseId) return
    setSwitchBlockedMessage(null)

    if (core.session && activeExerciseId) {
      const outgoingDraft = core.draftLogs[activeExerciseId]
      const hasOutcome = outgoingDraft?.notations?.some((n) => n.category === 'outcome') ?? false
      const targetDraft = core.draftLogs[exerciseId]
      const targetHasOutcome = targetDraft?.notations?.some((n) => n.category === 'outcome') ?? false

      if (!hasOutcome && !targetHasOutcome) {
        setSwitchBlockedMessage(
          'Log this exercise’s outcome (ⓞⓚ / ⓞⓚ SP / F / NA) before moving to the next one.'
        )
        return
      }

      const elapsed = stopwatch.running ? stopwatch.stop() : stopwatch.elapsedSeconds
      if (elapsed > 0) {
        await core.captureStopwatch(activeExerciseId, elapsed)
      }
    }

    stopwatch.reset()
    setActiveExerciseId(exerciseId)
  }

  function handleStopwatchTap() {
    if (!core.session || !activeExerciseId) return
    if (stopwatch.running) {
      const elapsed = stopwatch.stop()
      core.captureStopwatch(activeExerciseId, elapsed)
    } else {
      stopwatch.start()
    }
  }

  // Req #5: a distinct "start over" control -- resets the display on demand
  // without capturing anything, for when the coach makes a timing mistake.
  function handleStopwatchReset() {
    stopwatch.reset()
  }

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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* This task, req #2: the toolbar (messages, shared stopwatch,
            Shuffle/Begin Session) lives outside the scrollable grid entirely,
            in its own non-scrolling strip. That's what keeps the stopwatch
            genuinely fixed in place -- not just visually pinned on top of
            content via position:sticky/fixed (which would let scrolled rows
            slide in underneath it and get covered), but structurally
            separate, so the exercise grid below never occupies the same
            screen region no matter how far it's scrolled. */}
        <div className="relative z-10 grid grid-cols-3 items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="flex items-center gap-3">
            {shuffleError && <p className="text-sm text-red-600">{shuffleError}</p>}
            {!core.session && beginError && <p className="text-sm text-red-600">{beginError}</p>}
            {switchBlockedMessage && <p className="text-sm text-amber-600">{switchBlockedMessage}</p>}
          </div>

          {/* Single shared stopwatch, top-middle of the screen, plus a
              distinct reset control (req #5) that just zeroes the display --
              it never captures anything, unlike tapping the stopwatch itself. */}
          <div className="flex items-center justify-center gap-2">
            {core.session && (
              <>
                <StopwatchControl
                  running={stopwatch.running}
                  elapsedSeconds={stopwatch.elapsedSeconds}
                  onTap={handleStopwatchTap}
                />
                <button
                  type="button"
                  onClick={handleStopwatchReset}
                  title="Reset stopwatch to 0:00"
                  aria-label="Reset stopwatch to 0:00"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600 hover:bg-slate-200"
                >
                  ↺
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleShuffle}
              disabled={shuffling}
              title="Manually advance rotation"
              className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {shuffling ? 'Shuffling…' : 'Shuffle'}
            </button>
            {!core.session && (
              <button
                type="button"
                onClick={() => setBeginPanelOpen(true)}
                className="h-14 rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-700"
              >
                Begin Session
              </button>
            )}
          </div>
        </div>

        {/* Scrollable region: the exercise grid plus the Add More/Close
            Session row. Bottom padding (pb-24) reserves enough space that,
            even scrolled all the way down, real content never sits behind
            the fixed FloatingNotesButton in the bottom-right corner (req #4). */}
        <div className="flex-1 overflow-auto p-4 pb-24">
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
              activeExerciseId={activeExerciseId}
              onActivate={handleActivateExercise}
              onUpdateDraft={core.updateDraft}
              onCommitFailureTime={core.commitFailureTime}
              onUpdateLog={core.updateLog}
              onOpenNotes={() => setNotesOpen(true)}
              onOpenSwap={(row) => setSwapTarget(row)}
              onChangeMovementClassification={core.changeMovementClassification}
              onToggleFlagNotation={core.toggleFlagNotation}
              onAdjustEffortNotation={core.adjustEffortNotation}
              onSelectOutcomeNotation={core.selectOutcomeNotation}
            />
          </div>

          {/* Req #7/#8: "+ Add More" and "Close Session" moved out of the top
              toolbar to after the last exercise row. */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAddExerciseOpen(true)}
              className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              + Add More
            </button>
            {core.session && (
              <button
                type="button"
                onClick={onCloseSession}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close Session
              </button>
            )}
          </div>
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
        onConfirm={async ({ exerciseId, reason, permanent }) => {
          await core.swapExercise(swapTarget.exerciseId, exerciseId, reason, permanent)
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
