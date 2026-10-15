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
import { hasLoggedResult } from './sessionRowStatus'
import { clearRunningStopwatch, readRunningStopwatch, saveRunningStopwatch } from './stopwatchRestore'
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
// gated on the outgoing exercise's time (or reps) being logged first (PRD
// 13.3: mandatory before advancing); once that gate passes, any unrecorded
// elapsed time is still silently captured as a safety net (mainly for
// M-classification failure_time, PRD 21.3) before the display resets to
// 0:00 for the newly active cell.
function formatAgo(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

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
  const [stopwatchRestoredAgo, setStopwatchRestoredAgo] = useState(null) // seconds, or null

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

  // Accidental close (stopwatchRestore.js): a stopwatch that was running when
  // the app closed picks back up from its stored start -- only for this same
  // open session, on a row that's still there and has no result logged yet,
  // and within STOPWATCH_RESTORE_MAX_AGE_MS. That row becomes the active
  // cell again, and the toolbar says it was restored. A record for another
  // session is left alone to expire. Declared after the first-row default
  // above so the restored cell wins on mount.
  useEffect(() => {
    const saved = readRunningStopwatch()
    if (!saved || !core.session || saved.sessionId !== core.session.id) return
    const rowExists = core.rows.some((r) => r.exerciseId === saved.exerciseId && !r.isPlaceholder)
    if (!rowExists || hasLoggedResult(core.draftLogs[saved.exerciseId])) {
      clearRunningStopwatch()
      return
    }
    setActiveExerciseId(saved.exerciseId)
    stopwatch.resumeFrom(saved.startedAt)
    setStopwatchRestoredAgo(Math.floor((Date.now() - saved.startedAt) / 1000))
    // Mount only: this is recovery from a close, not something to redo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Req #1/#2/#4 (follow-up pass): switching the active cell is gated on the
  // outgoing exercise having a time (or, for E, reps) logged --
  // hasLoggedResult, the same predicate CollapsedExerciseRow uses for its
  // checkmark. An outcome notation (ⓞⓚ / ⓞⓚ SP / F / NA) is optional and
  // isn't required to move on. If no result is logged, the switch is blocked
  // with a message and the stopwatch is left exactly as the coach left it.
  // Once the gate passes, any unrecorded elapsed time is captured as a
  // safety net (item #4) before the display resets to 0:00 -- but nothing
  // auto-starts it for the newly active cell (item #2); that's a manual tap.
  //
  // Back-navigation follow-up: the gate above is meant to stop the coach from
  // *advancing* past an exercise with no result logged yet -- it was never
  // meant to block going back to re-open one that's already done. So the
  // block only applies when the target ALSO has no result logged yet (i.e.
  // this is a forward move to fresh work); tapping any row that already has
  // one -- including a previously-completed one -- is always allowed,
  // regardless of whether the exercise being left is finished.
  async function handleActivateExercise(exerciseId) {
    if (exerciseId === activeExerciseId) return
    setSwitchBlockedMessage(null)

    if (core.session && activeExerciseId) {
      const outgoingDone = hasLoggedResult(core.draftLogs[activeExerciseId])
      const targetDone = hasLoggedResult(core.draftLogs[exerciseId])

      if (!outgoingDone && !targetDone) {
        setSwitchBlockedMessage('Log this exercise’s time (or reps) before moving to the next one.')
        return
      }

      const elapsed = stopwatch.running ? stopwatch.stop() : stopwatch.elapsedSeconds
      clearRunningStopwatch()
      if (elapsed > 0) {
        await core.captureStopwatch(activeExerciseId, elapsed)
      }
    }

    stopwatch.reset()
    setStopwatchRestoredAgo(null)
    setActiveExerciseId(exerciseId)
  }

  function handleStopwatchTap() {
    if (!core.session || !activeExerciseId) return
    if (stopwatch.running) {
      const elapsed = stopwatch.stop()
      clearRunningStopwatch()
      setStopwatchRestoredAgo(null)
      core.captureStopwatch(activeExerciseId, elapsed)
    } else {
      const startedAt = stopwatch.start()
      saveRunningStopwatch({ sessionId: core.session.id, exerciseId: activeExerciseId, startedAt })
    }
  }

  // Req #5: a distinct "start over" control -- resets the display on demand
  // without capturing anything, for when the coach makes a timing mistake.
  function handleStopwatchReset() {
    stopwatch.reset()
    clearRunningStopwatch()
    setStopwatchRestoredAgo(null)
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
    // Takes whatever height SessionScreen's column has left after the banner
    // and header -- no hardcoded header height to fall out of date.
    <div className="flex min-h-0 flex-1">
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
            {stopwatchRestoredAgo !== null && (
              <p className="text-sm text-amber-600">
                Restored — started {formatAgo(stopwatchRestoredAgo)} ago
              </p>
            )}
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
            Session row. */}
        <div className="flex-1 overflow-auto p-4">
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
              onOpenSwap={(row) => setSwapTarget(row)}
              onChangeMovementClassification={core.changeMovementClassification}
              onChangeSetType={core.changeSetTypeOverride}
              onRemoveExercise={core.removeExerciseFromOrder}
              onChangeSecondPushPull={core.changeSecondPushPull}
              hipPressSplitState={{
                leadSide: core.client?.hip_press_split_lead_side,
                frozen: core.client?.hip_press_split_frozen,
                layout: core.client?.hip_press_split_layout,
                sharedSettings: core.client?.hip_press_split_shared_settings,
              }}
              onSplitHipPress={core.splitHipPress}
              onRevertHipPressSplit={core.revertHipPressSplit}
              onSetHipPressSplitFreeze={core.setHipPressSplitFreeze}
              onSetHipPressSplitLayout={core.setHipPressSplitLayout}
              onSetHipPressSplitSharedSettings={core.setHipPressSplitSharedSettings}
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

        {/* This task, req #4: same non-scrolling-strip trick as the header
            toolbar (req #2) -- the notes button lives in its own footer row
            outside the scrollable grid, so no exercise row can ever end up
            underneath it at any scroll position (a `fixed` overlay here
            would only protect the very end of the scrollable content, not
            every position in between). */}
        <div className="session-footer-safe-area flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-100 px-4 pt-2">
          {/* Bug fix (this task): this used to be the only way to reach
              NotesSidePanel, opened from any exercise cell's note icon as if
              it were that exercise's own note -- it was always writing to the
              session-wide coach_notes row instead. Its trigger now lives
              here, next to the other session-wide note control, so it's
              honestly scoped to "the session," not any one exercise. */}
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Session Notes
          </button>
          <FloatingNotesButton
            clientId={core.client.id}
            hasSession={Boolean(core.session)}
            generalNote={core.notes?.general_note}
            onSave={core.saveNotes}
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
