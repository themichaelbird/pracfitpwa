import { useState } from 'react'
import { SettingsColumn } from './SettingsColumn'
import { SessionColumn } from './SessionColumn'
import { NotesSidePanel } from './NotesSidePanel'
import { SwapExercisePicker } from './SwapExercisePicker'

// PRD 5.4: fixed settings column, then previous session columns
// (oldest-to-newest, read-only, omitted entirely if no history exists yet),
// then the live session on the far right. One shared CSS grid keeps
// exercise rows aligned across every column regardless of cell content
// height -- columns place their own cells via explicit gridColumn/gridRow
// rather than nesting independent grids per column.
export function SessionWorkspace({ core, onCloseSession }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [swapTarget, setSwapTarget] = useState(null) // row currently open in SwapExercisePicker, or null

  const orderedPrevious = [...core.previousSessions].reverse()
  const columnCount = 1 + orderedPrevious.length + (core.session ? 1 : 0)

  return (
    <div className="p-4">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onCloseSession}
          className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Close Session
        </button>
      </div>

      <div
        className="grid gap-px overflow-x-auto bg-slate-200"
        style={{
          gridTemplateColumns: `220px repeat(${columnCount - 1}, minmax(260px, 1fr))`,
        }}
      >
        <SettingsColumn
          rows={core.rows}
          columnIndex={1}
          onUpdateSettings={core.updateExerciseSettings}
        />

        {orderedPrevious.map((column, index) => (
          <SessionColumn
            key={column.session.id}
            rows={core.rows}
            session={column.session}
            columnData={column.rows}
            columnIndex={index + 2}
            readOnly
          />
        ))}

        {core.session && (
          <SessionColumn
            key={core.session.id}
            rows={core.rows}
            session={core.session}
            draftLogs={core.draftLogs}
            exercisesById={core.exercisesById}
            columnIndex={columnCount}
            readOnly={false}
            isLive
            onUpdateDraft={core.updateDraft}
            onCommitFailureTime={core.commitFailureTime}
            onUpdateLog={core.updateLog}
            onOpenNotes={() => setNotesOpen(true)}
            onOpenSwap={(row) => setSwapTarget(row)}
          />
        )}
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
    </div>
  )
}
