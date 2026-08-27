import { useState } from 'react'
import { FailureTimeInput } from './FailureTimeInput'
import { RepsNumberPad } from './RepsNumberPad'
import { StopwatchControl } from './StopwatchControl'
import { ProgressionControl } from './ProgressionControl'
import { NotationBar } from './NotationBar'

const CLASSIFICATION_COLOR = {
  D: 'bg-sky-100 text-sky-700',
  M: 'bg-amber-100 text-amber-700',
  E: 'bg-violet-100 text-violet-700',
}

function formatSeconds(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ProgressionLabel({ progression, progressionAmount }) {
  if (progression === 'up') return <>+{progressionAmount ?? ''}</>
  if (progression === 'down') return <>−{progressionAmount ?? ''}</>
  if (progression === 'hold') return <>OK</>
  return <>—</>
}

// v0.1 notation spec: "Eccentric sets (movement classification = E): show a
// circled number for reps completed instead of a time. The circle goes
// around the number only." Static (read-only) rendering.
function CircledReps({ reps }) {
  return (
    <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 text-sm font-semibold text-slate-900">
      {reps ?? '—'}
    </span>
  )
}

// Live/editable counterpart -- tap opens RepsNumberPad, same interaction
// family as FailureTimeInput's number pad. v0.2 req #10: empty state reads
// "Outcome" (not a bare dash) so it's obviously something to tap.
function RepsField({ reps, onChange }) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <RepsNumberPad
        initialReps={reps}
        onDone={(value) => {
          onChange(value)
          setOpen(false)
        }}
      />
    )
  }

  if (reps == null) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border-2 border-dashed border-slate-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:border-slate-600 hover:text-slate-700"
        >
          Outcome
        </button>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 text-lg font-semibold text-slate-900 hover:bg-slate-50"
      >
        {reps}
      </button>
    </div>
  )
}

// v0.2 req #5: an unassigned Auxiliary A/B row. Auxiliary A is tappable from
// day 1; Auxiliary B stays a non-interactive "Set after session 1" label
// until the client's first session has ever completed.
function AuxiliaryPlaceholderCell({ row, columnIndex, gridRow, canAssign, onAssign }) {
  const style = { gridColumn: columnIndex, gridRow }
  const label = row.auxiliarySlot === 'B' && !canAssign ? 'Set after session 1' : 'Tap to set'

  return (
    <button
      type="button"
      disabled={!canAssign}
      onClick={onAssign}
      style={style}
      className={`flex flex-col items-center justify-center gap-1 border border-dashed p-2 text-center ${
        canAssign
          ? 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
          : 'cursor-default border-slate-200 bg-slate-50 text-slate-400'
      }`}
    >
      <span className="text-sm font-semibold">Auxiliary {row.auxiliarySlot}</span>
      <span className="text-[11px]">{label}</span>
    </button>
  )
}

// PRD 5.4/13, v0.2: one row's cell. Layout: abbreviation + swap button
// top-left (with the set-type-override label beneath, shown only when this
// exercise deviates from the session's default set type), D/M/E badge +
// weight top-right, failure time (or circled reps for E) dead-center with
// the notation bar (v0.1: DIS -> effort -> outcome) beside it, stopwatch
// below that as its own full-width row, progression + notes icon on the
// last row. Read-only columns render the same regions from historical data
// instead of live inputs. `mode` 'prep' (v0.2 req #4/#5) renders the row
// but keeps logging inputs inert -- a session hasn't begun yet.
export function ExerciseCell({
  row,
  columnIndex,
  gridRow,
  readOnly,
  mode,
  sessionSetType,
  columnEntry,
  draft,
  exercisesById,
  notationCatalog,
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
  const style = { gridColumn: columnIndex, gridRow }

  if (row.isPlaceholder && !readOnly) {
    const canAssign = canAssignAuxiliary?.(row) ?? false
    return (
      <AuxiliaryPlaceholderCell
        row={row}
        columnIndex={columnIndex}
        gridRow={gridRow}
        canAssign={canAssign}
        onAssign={() => canAssign && onAssignAuxiliary(row)}
      />
    )
  }

  if (readOnly) {
    if (!columnEntry?.log) {
      return (
        <div
          style={style}
          className="flex items-center justify-center bg-white p-2 text-xs text-slate-300"
        >
          —
        </div>
      )
    }

    const { log, performedExercise, isSwap, notations } = columnEntry
    const overrideLabel = log.set_type_override ? log.set_type_override_value : null
    const isEccentric = log.movement_classification === 'E'

    return (
      <div style={style} className="space-y-1 bg-white p-2 opacity-90">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {performedExercise?.abbreviation ?? row.abbreviation}
              {isSwap && (
                <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] font-medium text-orange-700">
                  SWAP
                </span>
              )}
            </p>
            {overrideLabel && overrideLabel !== sessionSetType && (
              <p className="text-[10px] font-medium text-slate-500">{overrideLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CLASSIFICATION_COLOR[log.movement_classification]}`}
            >
              {log.movement_classification}
            </span>
            <span className="text-xs text-slate-700">{log.weight != null ? `${log.weight}` : '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1">
          {isEccentric ? (
            <CircledReps reps={log.reps_completed} />
          ) : (
            <p className="text-lg font-semibold text-slate-900">{formatSeconds(log.failure_time)}</p>
          )}
          <NotationBar catalog={notationCatalog} notations={notations} />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatSeconds(log.stopwatch_elapsed)}</span>
          <span className="font-medium">
            <ProgressionLabel
              progression={log.progression}
              progressionAmount={log.progression_amount}
            />
          </span>
        </div>
      </div>
    )
  }

  const isPrep = mode === 'prep'

  // Live / editable cell. A session_exercise_logs row only exists once
  // failure_time (or, for E exercises, reps_completed) has been committed
  // (draft.logId set); until then, field edits stay local via
  // onUpdateDraft. saveField routes each change to the right place: the
  // gating insert, an autosaved update, or a local draft edit. Notations
  // reference session_exercise_logs.id directly (see 0016_notations.sql),
  // so NotationBar stays disabled until draft.logId exists.
  function saveField(patch) {
    if (isPrep) return
    if (('failureTime' in patch || 'repsCompleted' in patch) && !draft.logId) {
      onCommitFailureTime(patch)
      return
    }
    if (draft.logId) {
      onUpdateLog(patch)
    } else {
      onUpdateDraft(patch)
    }
  }

  const overrideLabel = draft.setTypeOverride ? draft.setTypeOverrideValue : null
  const swappedExercise =
    draft.exerciseId && draft.exerciseId !== row.exerciseId ? exercisesById?.[draft.exerciseId] : null
  const isEccentric = draft.movementClassification === 'E'

  return (
    <div
      style={style}
      className={`space-y-1.5 bg-white p-2 ring-1 ring-inset ${
        isPrep ? 'ring-slate-200' : 'ring-emerald-200'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* v0.2 req #9: swap button moved next to the exercise name/abbreviation
            (top-left area), no longer beside the D/M/E badge. */}
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-slate-900">
              {swappedExercise?.abbreviation ?? row.abbreviation}
              {swappedExercise && (
                <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] font-medium text-orange-700">
                  SWAP
                </span>
              )}
            </p>
            {onOpenSwap && !isPrep && (
              <button
                type="button"
                onClick={() => onOpenSwap(row)}
                className="rounded px-1 text-slate-400 hover:text-slate-700"
                aria-label="Swap exercise"
              >
                ⇄
              </button>
            )}
          </div>
          {overrideLabel && overrideLabel !== sessionSetType && (
            <p className="text-[10px] font-medium text-slate-500">{overrideLabel}</p>
          )}
        </div>

        {/* v0.2 req #8: weight input moved to the top-right, narrow -- not a
            full-width bar. */}
        <div className="flex items-center gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CLASSIFICATION_COLOR[draft.movementClassification]}`}
          >
            {draft.movementClassification}
          </span>
          <input
            type="number"
            inputMode="decimal"
            disabled={isPrep}
            value={draft.weight}
            onChange={(event) =>
              saveField({ weight: event.target.value === '' ? '' : Number(event.target.value) })
            }
            placeholder="Wt"
            className="h-8 w-16 rounded border border-slate-300 px-1 text-right text-sm disabled:bg-slate-50 disabled:text-slate-300"
          />
        </div>
      </div>

      {isPrep ? (
        <p className="rounded-lg bg-slate-50 py-2 text-center text-[11px] text-slate-400">
          Tap Begin Session to start logging
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {isEccentric ? (
              <RepsField reps={draft.repsCompleted} onChange={(value) => saveField({ repsCompleted: value })} />
            ) : (
              <div className="min-w-[64px] flex-1">
                <FailureTimeInput
                  movementClassification={draft.movementClassification}
                  failureTime={draft.failureTime}
                  stopwatchElapsed={draft.stopwatchElapsed}
                  onChange={(value) => saveField({ failureTime: value, failureTimeSource: 'manual' })}
                />
              </div>
            )}
            <NotationBar
              catalog={notationCatalog}
              notations={draft.notations}
              disabled={!draft.logId}
              onToggleFlag={onToggleFlagNotation}
              onAdjustEffort={onAdjustEffortNotation}
              onSelectOutcome={onSelectOutcomeNotation}
            />
          </div>

          <StopwatchControl
            onStop={(elapsedSeconds) => {
              const patch = { stopwatchElapsed: elapsedSeconds }
              if (draft.movementClassification === 'M') {
                patch.failureTime = elapsedSeconds
                patch.failureTimeSource = 'auto'
              }
              saveField(patch)
            }}
          />

          <div className="flex items-center justify-between gap-1">
            <ProgressionControl
              progression={draft.progression}
              progressionAmount={draft.progressionAmount}
              onChange={(progression, progressionAmount) =>
                saveField({ progression, progressionAmount })
              }
            />

            <button
              type="button"
              onClick={onOpenNotes}
              className="rounded px-1 text-slate-400 hover:text-slate-700"
              aria-label="Open notes"
            >
              📝
            </button>
          </div>
        </>
      )}
    </div>
  )
}
