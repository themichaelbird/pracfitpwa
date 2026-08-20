import { FailureTimeInput } from './FailureTimeInput'
import { StopwatchControl } from './StopwatchControl'
import { ProgressionControl } from './ProgressionControl'

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

// PRD 5.4/13: one row's cell. Layout: abbreviation top-left (with the
// set-type-override label beneath it, shown only when this exercise
// deviates from the session's default set type), D/M/E badge top-middle,
// weight top-right, failure time dead-center, stopwatch bottom-left,
// progression bottom-right, note icon. Read-only columns render the same
// regions from historical data instead of live inputs.
export function ExerciseCell({
  row,
  columnIndex,
  gridRow,
  readOnly,
  sessionSetType,
  columnEntry,
  draft,
  exercisesById,
  onUpdateDraft,
  onCommitFailureTime,
  onUpdateLog,
  onOpenNotes,
  onOpenSwap,
}) {
  const style = { gridColumn: columnIndex, gridRow }

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

    const { log, performedExercise, isSwap } = columnEntry
    const overrideLabel = log.set_type_override ? log.set_type_override_value : null

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
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CLASSIFICATION_COLOR[log.movement_classification]}`}
          >
            {log.movement_classification}
          </span>
        </div>

        <p className="text-right text-sm text-slate-700">
          {log.weight != null ? `${log.weight} lb` : '—'}
        </p>

        <p className="text-center text-lg font-semibold text-slate-900">
          {formatSeconds(log.failure_time)}
        </p>

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

  // Live / editable cell. A session_exercise_logs row only exists once
  // failure_time has been committed (draft.logId set); until then, field
  // edits stay local via onUpdateDraft. saveField routes each change to
  // the right place: the gating insert, an autosaved update, or a local
  // draft edit.
  function saveField(patch) {
    if ('failureTime' in patch && !draft.logId) {
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

  return (
    <div style={style} className="space-y-1 bg-white p-2 ring-1 ring-inset ring-emerald-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {swappedExercise?.abbreviation ?? row.abbreviation}
            {swappedExercise && (
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
          {row.exerciseType === 'D' && onOpenSwap && (
            <button
              type="button"
              onClick={() => onOpenSwap(row)}
              className="rounded px-1 text-slate-400 hover:text-slate-700"
              aria-label="Swap exercise"
            >
              ⇄
            </button>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CLASSIFICATION_COLOR[draft.movementClassification]}`}
          >
            {draft.movementClassification}
          </span>
        </div>
      </div>

      <input
        type="number"
        inputMode="decimal"
        value={draft.weight}
        onChange={(event) =>
          saveField({ weight: event.target.value === '' ? '' : Number(event.target.value) })
        }
        placeholder="Weight"
        className="h-8 w-full rounded border border-slate-300 px-2 text-right text-sm"
      />

      <FailureTimeInput
        movementClassification={draft.movementClassification}
        failureTime={draft.failureTime}
        stopwatchElapsed={draft.stopwatchElapsed}
        onChange={(value) => saveField({ failureTime: value, failureTimeSource: 'manual' })}
      />

      <div className="flex items-center justify-between gap-1">
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
    </div>
  )
}
