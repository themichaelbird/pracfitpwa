import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { sortSessionRows } from './rotationEngine'
import { mutateOnlineOrQueue } from '../../lib/mutateOnlineOrQueue'
import { loadSnapshot, saveSnapshot } from '../../lib/offlineQueue'
import { FIXED_MACHINE_CARDS, FIXED_MACHINE_NAMES } from './machineSettingsFields'

const ROTATION_HOLD_STATUSES = ['late_cancel', 'no_show']

// v0.2 req #3: the 8 fixed/rotating exercises every new client gets seeded
// with the first time their session is opened (client_exercise_order has
// zero rows -- true for every client now that ExerciseOrderSetupScreen is
// gone, per useSessionCore's bootstrap in load() below). rotationIndex here
// is the *session-1* Type B ordering (CP, PD, INC, RW) that
// rotationEngine.sortSessionRows interleaves with the fixed Type A order
// (HP, LX, ISO, MHP) to produce the exact req #3 sequence: CP, HP, PD, LX,
// INC, ISO, RW, MHP.
const DEFAULT_EXERCISE_BOOTSTRAP = [
  ['CP', 'B', 0],
  ['HP', 'A', 0],
  ['PD', 'B', 1],
  ['LX', 'A', 0],
  ['INC', 'B', 2],
  ['ISO', 'A', 0],
  ['RW', 'B', 3],
  ['MHP', 'A', 0],
]

// A previous session's log matches a row either directly (exercise_id) or
// via a same-day swap (original_exercise_id records the pre-swap exercise).
// Previous columns must show what was actually performed, with a swap flag
// when it differs from the client's canonical exercise for that row.
function matchLog(logs, canonicalExerciseId) {
  return logs.find(
    (log) =>
      log.exercise_id === canonicalExerciseId ||
      log.original_exercise_id === canonicalExerciseId
  )
}

function buildPreviousColumn(session, logs, exercisesById, canonicalRows, notationsByLogId) {
  return {
    session,
    rows: canonicalRows.map((row) => {
      if (row.isPlaceholder) return { exerciseId: row.exerciseId, log: null }
      const log = matchLog(logs, row.exerciseId)
      if (!log) return { exerciseId: row.exerciseId, log: null }

      return {
        exerciseId: row.exerciseId,
        log,
        performedExercise: exercisesById[log.exercise_id] ?? null,
        isSwap: log.exercise_id !== row.exerciseId,
        notations: notationsByLogId[log.id] ?? [],
      }
    }),
  }
}

function emptyDraft(row, prefillWeight) {
  return {
    weight: prefillWeight ?? '',
    movementClassification: row.movementClassification,
    movementClassificationOverride: false,
    movementClassificationPermanent: false,
    setTypeOverride: false,
    setTypeOverrideValue: null,
    stopwatchElapsed: null,
    failureTime: null,
    failureTimeSource: null,
    repsCompleted: null, // v0.1: E-classification reps, in place of failureTime -- see toLogPayload
    progression: null,
    progressionAmount: null,
    exerciseId: row.exerciseId, // Type D swap target; defaults to the row's canonical exercise
    originalExerciseId: null,
    swapReason: null,
    swapPermanentChange: false,
    logId: null, // set once a session_exercise_logs row actually exists
    notations: [], // v0.1: [{ notationId, code, category, count }], see session_exercise_log_notations
  }
}

function fromCommittedLog(log) {
  return {
    weight: log.weight ?? '',
    movementClassification: log.movement_classification,
    movementClassificationOverride: log.movement_classification_override,
    movementClassificationPermanent: log.movement_classification_permanent_change,
    setTypeOverride: log.set_type_override,
    setTypeOverrideValue: log.set_type_override_value,
    stopwatchElapsed: log.stopwatch_elapsed,
    failureTime: log.failure_time,
    failureTimeSource: log.failure_time_source,
    repsCompleted: log.reps_completed,
    progression: log.progression,
    progressionAmount: log.progression_amount,
    exerciseId: log.exercise_id,
    originalExerciseId: log.original_exercise_id,
    swapReason: log.swap_reason,
    swapPermanentChange: log.swap_permanent_change,
    logId: log.id,
    notations: [], // filled in by the caller once notation rows are fetched (needs log.id first)
  }
}

// PRD 6.2/8.2: Type D swap -- exercise_id is the replacement actually
// performed, original_exercise_id preserves the row's canonical exercise.
// draft.exerciseId defaults to the row's own exercise (emptyDraft) so this
// is a no-op payload until swapExercise changes it.
//
// v0.1 (0017 migration): Eccentric (E) exercises log reps_completed instead
// of failure_time/failure_time_source -- the DB check constraint requires
// exactly one of the two "what happened at the end of the set" shapes per
// row, matching movement_classification.
function toLogPayload(row, draft) {
  const isEccentric = draft.movementClassification === 'E'
  return {
    exercise_id: draft.exerciseId,
    original_exercise_id: draft.originalExerciseId,
    swap_reason: draft.swapReason,
    swap_permanent_change: draft.swapPermanentChange,
    weight: draft.weight === '' ? null : draft.weight,
    movement_classification: draft.movementClassification,
    movement_classification_override: draft.movementClassificationOverride,
    movement_classification_permanent_change: draft.movementClassificationPermanent,
    set_type_override: draft.setTypeOverride,
    set_type_override_value: draft.setTypeOverrideValue,
    stopwatch_elapsed: draft.stopwatchElapsed,
    failure_time: isEccentric ? null : draft.failureTime,
    failure_time_source: isEccentric ? null : draft.failureTimeSource,
    reps_completed: isEccentric ? draft.repsCompleted : null,
    progression: draft.progression,
    progression_amount: draft.progressionAmount,
  }
}

function buildMachineSettingsCards(rows, machineSettingsByName, exerciseSettingsByExerciseId) {
  const fixedCards = FIXED_MACHINE_CARDS.map(([machineName, label]) => ({
    key: machineName,
    storage: 'machine',
    machineName,
    label,
    settings: machineSettingsByName[machineName]?.settings ?? {},
    hasSettings: Boolean(machineSettingsByName[machineName]),
  }))

  const seenExtraMachines = new Set()
  const extraCards = []
  for (const row of rows) {
    if (row.isPlaceholder) continue
    if (!row.isAuxiliary && !row.isManuallyAdded) continue
    if (!row.machineName || row.machineName === 'No machine') continue
    if (FIXED_MACHINE_NAMES.has(row.machineName)) continue
    if (seenExtraMachines.has(row.exerciseId)) continue
    seenExtraMachines.add(row.exerciseId)
    extraCards.push({
      key: row.exerciseId,
      storage: 'exercise',
      exerciseId: row.exerciseId,
      machineName: row.machineName,
      label: row.abbreviation,
      settings: exerciseSettingsByExerciseId[row.exerciseId]?.settings ?? {},
      hasSettings: Boolean(exerciseSettingsByExerciseId[row.exerciseId]),
    })
  }

  return [...fixedCards, ...extraCards]
}

// Data layer for the Session Core screen: the client's exercise rows (PRD
// 5.4 settings column, now decoupled -- see machineSettingsCards), the last
// two completed sessions (read-only columns), and the live session's
// in-progress logs.
//
// v0.2: opening a session no longer creates a session record (req #4) --
// `session` stays null while the coach preps rows/settings/auxiliaries.
// Tapping "Begin Session" (BeginSessionPanel.jsx) runs the review gate if
// due, then calls beginSession() below, which creates the sessions row
// immediately (not deferred to the first log) -- that's what lets pain
// intake attach to a real session_id right after.
//
// A session_exercise_logs row is only ever written once failure_time is
// known (NOT NULL in the schema), so field edits before that stay
// local-only via updateDraft; commitFailureTime does the one insert that
// gates cell advance, and updateLog handles autosaved edits to an
// already-committed row.
//
// PRD 7/9.2 offline: every write below generates its own row id with
// crypto.randomUUID() *before* attempting the network call, and goes
// through mutateOnlineOrQueue (src/lib/mutateOnlineOrQueue.js) instead of
// calling supabase directly. That removes the usual hard part of
// offline-first sync (reconciling a local placeholder id with a
// server-assigned one once a queued insert finally lands) -- there's only
// ever one id, so a later call that references it (e.g. updateLog needing
// commitFailureTime's logId) works identically whether the insert already
// reached the server or is still sitting in the outbox. State updates apply
// immediately (optimistic), so the UI never blocks on connectivity.
export function useSessionCore({ clientId, coachId, pinOverrideUsed }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [client, setClient] = useState(null)
  const [rows, setRows] = useState([])
  const [session, setSession] = useState(null) // live (unended) session, or null
  const [previousSessions, setPreviousSessions] = useState([]) // up to 2, most recent first
  const [draftLogs, setDraftLogs] = useState({}) // exerciseId -> draft
  const [painReports, setPainReports] = useState([])
  const [notes, setNotes] = useState(null)
  const [exerciseCatalog, setExerciseCatalog] = useState([]) // all active exercises, for Type D swap / Add More / Auxiliary candidates
  const [reviewDue, setReviewDue] = useState(false) // PRD 5.5: 6-session review gate
  const [notationCatalog, setNotationCatalog] = useState([]) // v0.1: notations table, see 0016_notations.sql
  const [machineSettingsCards, setMachineSettingsCards] = useState([]) // v0.2 req #6/#8/#14
  const [hasCompletedSession, setHasCompletedSession] = useState(false) // v0.2 req #5: Auxiliary B eligibility

  const exercisesById = useMemo(
    () => Object.fromEntries(exerciseCatalog.map((e) => [e.id, e])),
    [exerciseCatalog]
  )

  function hydrateFromSnapshot(snapshot) {
    setClient(snapshot.client)
    setRows(snapshot.rows)
    setSession(snapshot.session)
    setPreviousSessions(snapshot.previousSessions)
    setDraftLogs(snapshot.draftLogs)
    setNotes(snapshot.notes)
    setPainReports(snapshot.painReports)
    setExerciseCatalog(snapshot.exerciseCatalog)
    setReviewDue(snapshot.reviewDue)
    setNotationCatalog(snapshot.notationCatalog ?? [])
    setMachineSettingsCards(snapshot.machineSettingsCards ?? [])
    setHasCompletedSession(snapshot.hasCompletedSession ?? false)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    if (!navigator.onLine) {
      const snapshot = await loadSnapshot(clientId)
      if (snapshot) {
        hydrateFromSnapshot(snapshot)
      } else {
        setLoadError('No connection, and this client has no cached data yet.')
      }
      setLoading(false)
      return
    }

    try {
      const [
        { data: clientRow, error: clientError },
        { data: notationRows, error: notationError },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        // v0.1: notation config catalog (0016_notations.sql) -- fetched
        // once per session load, not hardcoded, so a new notation added to
        // the DB shows up in NotationBar with no app code change.
        supabase.from('notations').select('*').eq('is_active', true).order('category').order('sort_order'),
      ])
      if (clientError) throw clientError
      if (notationError) throw notationError

      const notationCatalogById = Object.fromEntries(notationRows.map((n) => [n.id, n]))

      // Type D swap / Add More / Auxiliary assignment candidates (v0.2 req
      // #13/#15: "any exercise") -- full active catalog. body_section/
      // muscle_group included (this task, req #7) so the picker components
      // can search on them alongside name/abbreviation.
      const { data: catalogRows, error: catalogError } = await supabase
        .from('exercises')
        .select(
          'id, name, abbreviation, exercise_type, default_movement_classification, machine_name, body_section, muscle_group'
        )
        .eq('is_active', true)
        .order('abbreviation')
      if (catalogError) throw catalogError

      let { data: orderRows, error: orderError } = await supabase
        .from('client_exercise_order')
        .select(
          'exercise_id, movement_classification, rotation_index, is_manually_added, added_at, exercises(id, name, abbreviation, exercise_type, machine_name, body_section, muscle_group)'
        )
        .eq('client_id', clientId)
        .eq('is_active', true)
      if (orderError) throw orderError

      // v0.2 req #3: first-ever open for this client -- auto-populate the
      // default 8-exercise order. No auxiliary_config rows are created here;
      // Auxiliary A/B start empty, set from the session view (req #5).
      if (orderRows.length === 0) {
        const abbreviations = DEFAULT_EXERCISE_BOOTSTRAP.map(([abbr]) => abbr)
        const { data: bootstrapExercises, error: bootstrapLookupError } = await supabase
          .from('exercises')
          .select('id, abbreviation, default_movement_classification')
          .in('abbreviation', abbreviations)
        if (bootstrapLookupError) throw bootstrapLookupError
        const byAbbreviation = Object.fromEntries(bootstrapExercises.map((e) => [e.abbreviation, e]))

        const insertRows = DEFAULT_EXERCISE_BOOTSTRAP.filter(([abbr]) => byAbbreviation[abbr]).map(
          ([abbr, , rotationIndex]) => ({
            client_id: clientId,
            exercise_id: byAbbreviation[abbr].id,
            rotation_index: rotationIndex,
            movement_classification: byAbbreviation[abbr].default_movement_classification,
            is_active: true,
          })
        )
        if (insertRows.length > 0) {
          const { error: bootstrapInsertError } = await supabase
            .from('client_exercise_order')
            .upsert(insertRows, { onConflict: 'client_id,exercise_id' })
          if (bootstrapInsertError) throw bootstrapInsertError
        }

        const { data: reloadedOrderRows, error: reloadError } = await supabase
          .from('client_exercise_order')
          .select(
            'exercise_id, movement_classification, rotation_index, is_manually_added, added_at, exercises(id, name, abbreviation, exercise_type, machine_name, body_section, muscle_group)'
          )
          .eq('client_id', clientId)
          .eq('is_active', true)
        if (reloadError) throw reloadError
        orderRows = reloadedOrderRows
      }

      // PRD 8.2/8.3: Type A rows are fixed and always present; Type B rows
      // rotate position by a mutable per-client rotation_index (advanced by
      // advance_client_rotation, see shuffleRotation/closeSession below).
      // v0.2 req #13: manually-added rows (is_manually_added) behave like
      // Type A -- always present, in the order added, never rotating.
      const fixedRows = orderRows
        .filter((o) => !o.is_manually_added && (o.exercises.exercise_type === 'A' || o.exercises.exercise_type === 'B'))
        .map((o) => ({
          exerciseId: o.exercise_id,
          name: o.exercises.name,
          abbreviation: o.exercises.abbreviation,
          exerciseType: o.exercises.exercise_type,
          machineName: o.exercises.machine_name,
          bodySection: o.exercises.body_section,
          muscleGroup: o.exercises.muscle_group,
          movementClassification: o.movement_classification,
          rotationIndex: o.rotation_index,
          isAuxiliary: false,
          isManuallyAdded: false,
        }))

      const manuallyAddedRows = orderRows
        .filter((o) => o.is_manually_added)
        .map((o) => ({
          exerciseId: o.exercise_id,
          name: o.exercises.name,
          abbreviation: o.exercises.abbreviation,
          exerciseType: o.exercises.exercise_type,
          machineName: o.exercises.machine_name,
          bodySection: o.exercises.body_section,
          muscleGroup: o.exercises.muscle_group,
          movementClassification: o.movement_classification,
          rotationIndex: null,
          isAuxiliary: false,
          isManuallyAdded: true,
          addedAt: o.added_at,
        }))

      // v0.2 req #5: Auxiliary A and B are both always-shown rows (not the
      // old v0.1 single alternating auxiliary row) -- each is either a real
      // assigned exercise or a placeholder the coach taps to assign.
      const { data: auxiliaryConfigRows, error: auxiliaryError } = await supabase
        .from('auxiliary_config')
        .select(
          'slot, exercise_id, movement_classification, exercises(id, name, abbreviation, exercise_type, machine_name, body_section, muscle_group)'
        )
        .eq('client_id', clientId)
        .eq('is_current', true)
      if (auxiliaryError) throw auxiliaryError
      const auxiliaryBySlot = Object.fromEntries(auxiliaryConfigRows.map((a) => [a.slot, a]))

      const auxiliaryRows = ['A', 'B'].map((slot) => {
        const cfg = auxiliaryBySlot[slot]
        if (cfg) {
          return {
            exerciseId: cfg.exercise_id,
            name: cfg.exercises.name,
            abbreviation: cfg.exercises.abbreviation,
            exerciseType: cfg.exercises.exercise_type,
            machineName: cfg.exercises.machine_name,
            bodySection: cfg.exercises.body_section,
            muscleGroup: cfg.exercises.muscle_group,
            movementClassification: cfg.movement_classification,
            rotationIndex: null,
            isAuxiliary: true,
            auxiliarySlot: slot,
            isManuallyAdded: false,
            isPlaceholder: false,
          }
        }
        return {
          exerciseId: `__aux_placeholder_${slot}`,
          name: null,
          abbreviation: `AUX ${slot}`,
          exerciseType: null,
          machineName: null,
          bodySection: null,
          muscleGroup: null,
          movementClassification: null,
          rotationIndex: null,
          isAuxiliary: true,
          auxiliarySlot: slot,
          isManuallyAdded: false,
          isPlaceholder: true,
        }
      })

      const builtRows = sortSessionRows([...fixedRows, ...manuallyAddedRows, ...auxiliaryRows])

      // v0.2 req #6/#8/#14: machine settings, keyed by machine for the 7
      // fixed cards (client_machine_settings) and by exercise for any
      // auxiliary/manually-added exercise on a non-fixed machine
      // (client_exercise_settings).
      const [{ data: machineSettingsRows, error: machineSettingsError }, { data: exerciseSettingsRows, error: exerciseSettingsError }] =
        await Promise.all([
          supabase.from('client_machine_settings').select('*').eq('client_id', clientId),
          supabase.from('client_exercise_settings').select('*').eq('client_id', clientId),
        ])
      if (machineSettingsError) throw machineSettingsError
      if (exerciseSettingsError) throw exerciseSettingsError
      const machineSettingsByName = Object.fromEntries(machineSettingsRows.map((s) => [s.machine_name, s]))
      const exerciseSettingsByExerciseId = Object.fromEntries(exerciseSettingsRows.map((s) => [s.exercise_id, s]))
      const cards = buildMachineSettingsCards(builtRows, machineSettingsByName, exerciseSettingsByExerciseId)

      // PRD 5.5/6.4: 6-session review gate. Reset point is the most recent
      // review event for this client (either a completed review or a
      // decline -- both resolve the current cycle per PRD 5.5), falling
      // back to when the client record was created. Sessions since that
      // point are counted the same way rotation counts them (below):
      // no-show/late-cancel didn't happen, so they don't advance the cycle
      // either. Due exactly on the 6th, 12th, 18th... session.
      const [{ data: lastReview }, { data: lastDecline }] = await Promise.all([
        supabase
          .from('review_history')
          .select('recorded_at')
          .eq('client_id', clientId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('review_decline_log')
          .select('created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const reviewResetPoint = [lastReview?.recorded_at, lastDecline?.created_at, clientRow.created_at]
        .filter(Boolean)
        .sort()
        .at(-1)

      const { count: sessionsSinceReview, error: reviewCountError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .not('ended_at', 'is', null)
        .not('status', 'in', `(${ROTATION_HOLD_STATUSES.join(',')})`)
        .gt('started_at', reviewResetPoint)
      if (reviewCountError) throw reviewCountError

      const isReviewDue = sessionsSinceReview > 0 && sessionsSinceReview % 6 === 0

      // v0.2 req #5: Auxiliary B stays a non-interactive "Set after session
      // 1" placeholder until at least one session has ever completed.
      const { count: completedSessionCount, error: completedCountError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .not('ended_at', 'is', null)
      if (completedCountError) throw completedCountError

      // Resume an already-open session (app closed mid-session) instead of
      // forcing the coach back through Begin Session.
      const { data: openSession, error: openError } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', clientId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (openError) throw openError

      const { data: pastSessions, error: pastError } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', clientId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(2)
      if (pastError) throw pastError

      let previousColumns = []
      if (pastSessions.length > 0) {
        const { data: pastLogs, error: logsError } = await supabase
          .from('session_exercise_logs')
          .select('*')
          .in(
            'session_id',
            pastSessions.map((s) => s.id)
          )
        if (logsError) throw logsError

        const performedExerciseIds = [...new Set(pastLogs.map((l) => l.exercise_id))]
        const { data: performedExercises, error: performedError } = await supabase
          .from('exercises')
          .select('id, abbreviation, name')
          .in('id', performedExerciseIds.length > 0 ? performedExerciseIds : ['00000000-0000-0000-0000-000000000000'])
        if (performedError) throw performedError
        const performedExercisesById = Object.fromEntries(performedExercises.map((e) => [e.id, e]))

        let notationsByLogId = {}
        if (pastLogs.length > 0) {
          const { data: pastNotationRows, error: pastNotationError } = await supabase
            .from('session_exercise_log_notations')
            .select('session_exercise_log_id, notation_id, count')
            .in(
              'session_exercise_log_id',
              pastLogs.map((l) => l.id)
            )
          if (pastNotationError) throw pastNotationError

          notationsByLogId = {}
          for (const row of pastNotationRows) {
            const catalogEntry = notationCatalogById[row.notation_id]
            if (!catalogEntry) continue
            const bucket = (notationsByLogId[row.session_exercise_log_id] ??= [])
            bucket.push({
              notationId: row.notation_id,
              code: catalogEntry.code,
              category: catalogEntry.category,
              count: row.count,
            })
          }
        }

        previousColumns = pastSessions.map((s) =>
          buildPreviousColumn(
            s,
            pastLogs.filter((l) => l.session_id === s.id),
            performedExercisesById,
            builtRows,
            notationsByLogId
          )
        )
      }

      const mostRecentColumn = previousColumns[0]
      let drafts = Object.fromEntries(
        builtRows
          .filter((row) => !row.isPlaceholder)
          .map((row) => {
            const prefillWeight = mostRecentColumn?.rows.find(
              (r) => r.exerciseId === row.exerciseId
            )?.log?.weight
            return [row.exerciseId, emptyDraft(row, prefillWeight)]
          })
      )

      let openNotes = null
      let openPain = []
      if (openSession) {
        const [{ data: existingLogs }, { data: existingNotes }, { data: existingPain }] =
          await Promise.all([
            supabase.from('session_exercise_logs').select('*').eq('session_id', openSession.id),
            supabase
              .from('coach_notes')
              .select('*')
              .eq('session_id', openSession.id)
              .maybeSingle(),
            supabase.from('pain_reports').select('*').eq('session_id', openSession.id),
          ])
        for (const log of existingLogs ?? []) {
          drafts[log.exercise_id] = fromCommittedLog(log)
        }

        // Resume-in-progress notations (app closed mid-session with a DIS
        // tap or effort count already applied) -- fetched after
        // existingLogs since the query needs their ids.
        if (existingLogs && existingLogs.length > 0) {
          const { data: liveNotationRows, error: liveNotationError } = await supabase
            .from('session_exercise_log_notations')
            .select('session_exercise_log_id, notation_id, count')
            .in(
              'session_exercise_log_id',
              existingLogs.map((l) => l.id)
            )
          if (liveNotationError) throw liveNotationError

          for (const log of existingLogs) {
            drafts[log.exercise_id].notations = liveNotationRows
              .filter((r) => r.session_exercise_log_id === log.id)
              .map((r) => {
                const catalogEntry = notationCatalogById[r.notation_id]
                return {
                  notationId: r.notation_id,
                  code: catalogEntry?.code,
                  category: catalogEntry?.category,
                  count: r.count,
                }
              })
          }
        }

        openNotes = existingNotes ?? null
        openPain = existingPain ?? []
      }

      hydrateFromSnapshot({
        client: clientRow,
        rows: builtRows,
        session: openSession ?? null,
        previousSessions: previousColumns,
        draftLogs: drafts,
        notes: openNotes,
        painReports: openPain,
        exerciseCatalog: catalogRows,
        reviewDue: isReviewDue,
        notationCatalog: notationRows,
        machineSettingsCards: cards,
        hasCompletedSession: (completedSessionCount ?? 0) > 0,
      })
    } catch (err) {
      // Network failure (wifi dropped mid-request, not a real Supabase
      // error) falls back to the last-known-good snapshot instead of
      // showing an error for a client the coach was already working with.
      if (!navigator.onLine || err instanceof TypeError) {
        const snapshot = await loadSnapshot(clientId)
        if (snapshot) {
          hydrateFromSnapshot(snapshot)
          setLoading(false)
          return
        }
      }
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  // PRD 7 data integrity: re-snapshots on every state change (not just
  // after a successful load), so a page reload mid-offline-session doesn't
  // lose optimistically-applied local state that only otherwise exists in
  // React state + the outbox queue -- e.g. a coach who's been offline the
  // whole session and refreshes the page.
  useEffect(() => {
    if (loading || !client) return
    saveSnapshot(clientId, {
      client,
      rows,
      session,
      previousSessions,
      draftLogs,
      notes,
      painReports,
      exerciseCatalog,
      reviewDue,
      notationCatalog,
      machineSettingsCards,
      hasCompletedSession,
    })
  }, [
    clientId,
    loading,
    client,
    rows,
    session,
    previousSessions,
    draftLogs,
    notes,
    painReports,
    exerciseCatalog,
    reviewDue,
    notationCatalog,
    machineSettingsCards,
    hasCompletedSession,
  ])

  // v0.2 req #6/#8/#14: settings column edits. First-ever fill for a card
  // (hasSettings false) is a plain tap with no reason required -- nothing to
  // compare against yet. Every edit after that requires the tap-and-hold +
  // reason gesture (MachineSettingsCard.jsx), written to settings_audit_log
  // with machine_name (and exercise_id only for the per-exercise storage
  // case) so the audit trail stays meaningful now that a card can represent
  // more than one exercise (HP+MHP, OHP+INC).
  const updateMachineSettings = useCallback(
    async (card, newSettings, reason) => {
      const previousSettings = card.settings
      const auditReason = reason?.trim() || 'Initial settings entry'

      if (card.storage === 'machine') {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'upsert',
          table: 'client_machine_settings',
          payload: { client_id: clientId, machine_name: card.machineName, settings: newSettings },
          onConflict: 'client_id,machine_name',
        })
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'insert',
          table: 'settings_audit_log',
          payload: {
            id: crypto.randomUUID(),
            client_id: clientId,
            exercise_id: null,
            machine_name: card.machineName,
            changed_by: coachId,
            previous_settings: previousSettings,
            new_settings: newSettings,
            reason: auditReason,
          },
        })
      } else {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'upsert',
          table: 'client_exercise_settings',
          payload: { client_id: clientId, exercise_id: card.exerciseId, settings: newSettings },
          onConflict: 'client_id,exercise_id',
        })
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'insert',
          table: 'settings_audit_log',
          payload: {
            id: crypto.randomUUID(),
            client_id: clientId,
            exercise_id: card.exerciseId,
            machine_name: card.machineName,
            changed_by: coachId,
            previous_settings: previousSettings,
            new_settings: newSettings,
            reason: auditReason,
          },
        })
      }

      setMachineSettingsCards((current) =>
        current.map((c) => (c.key === card.key ? { ...c, settings: newSettings, hasSettings: true } : c))
      )
    },
    [clientId, coachId]
  )

  // v0.2 req #12: music/fan preferences, editable in-session behind the same
  // deliberate-action gesture as machine settings (ClientHeaderBar.jsx).
  const updateClientPreferences = useCallback(
    async (patch) => {
      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'update',
        table: 'clients',
        payload: patch,
        matchId: clientId,
      })
      setClient((current) => ({ ...current, ...patch }))
    },
    [clientId]
  )

  // v0.2 req #15: any exercise can be assigned Auxiliary A/B, with a
  // coach-chosen movement classification (not just the exercise's DB
  // default). First-ever assignment for this client also initializes
  // clients.auxiliary_active_slot -- retained for backward-compat with
  // advance_client_rotation (0013_rotation_and_review_gate.sql), though
  // nothing reads it for display anymore now that A and B are both always
  // shown rather than alternating.
  const assignAuxiliary = useCallback(
    async (slot, exerciseId, movementClassification) => {
      const existing = rows.find((r) => r.isAuxiliary && r.auxiliarySlot === slot && !r.isPlaceholder)

      if (existing) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'update',
          table: 'auxiliary_config',
          payload: { is_current: false, effective_to: new Date().toISOString() },
          match: { client_id: clientId, slot, is_current: true },
        })
      }

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'insert',
        table: 'auxiliary_config',
        payload: {
          id: crypto.randomUUID(),
          client_id: clientId,
          slot,
          exercise_id: exerciseId,
          movement_classification: movementClassification,
          is_current: true,
        },
      })

      const anyConfigured = rows.some((r) => r.isAuxiliary && !r.isPlaceholder)
      if (!anyConfigured) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'update',
          table: 'clients',
          payload: { auxiliary_active_slot: 'A' },
          matchId: clientId,
        })
      }

      await load()
    },
    [clientId, rows, load]
  )

  // v0.2 req #13: "Add More" -- any exercise, permanently saved to the
  // client's order as a fixed extra row (behaves like Type A: always
  // present, in the order added, no rotation). See rotationEngine.js and
  // the is_manually_added / added_at columns (0018 migration).
  const addExerciseToOrder = useCallback(
    async (exerciseId) => {
      const exercise = exercisesById[exerciseId]
      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'upsert',
        table: 'client_exercise_order',
        payload: {
          client_id: clientId,
          exercise_id: exerciseId,
          rotation_index: 0,
          movement_classification: exercise?.default_movement_classification ?? 'D',
          is_active: true,
          is_manually_added: true,
          added_at: new Date().toISOString(),
        },
        onConflict: 'client_id,exercise_id',
      })
      await load()
    },
    [clientId, exercisesById, load]
  )

  // v0.2 req #4/#5: creates the sessions row -- called when the coach taps
  // "Begin Session" (after the review gate, if due, has been cleared), not
  // when the session view is merely opened. session_type is gone (req #7).
  const beginSession = useCallback(
    async ({ setType, isUnscheduled }) => {
      const id = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      const status = isUnscheduled ? 'unscheduled_walk_in' : 'completed'
      const payload = {
        id,
        client_id: clientId,
        coach_id: coachId,
        location_id: client.location_id,
        set_type: setType,
        pin_override_used: pinOverrideUsed,
        status,
      }

      await mutateOnlineOrQueue({ id, kind: 'insert', table: 'sessions', payload })

      const data = {
        ...payload,
        started_at: nowIso,
        ended_at: null,
        next_session_booked: null,
        is_six_session_review: false,
        created_at: nowIso,
      }

      const mostRecentColumn = previousSessions[0]
      setSession(data)
      setNotes(null)
      setPainReports([])
      setDraftLogs(
        Object.fromEntries(
          rows
            .filter((row) => !row.isPlaceholder)
            .map((row) => {
              const prefillWeight = mostRecentColumn?.rows.find(
                (r) => r.exerciseId === row.exerciseId
              )?.log?.weight
              return [row.exerciseId, emptyDraft(row, prefillWeight)]
            })
        )
      )
      return data
    },
    [clientId, coachId, client, rows, previousSessions, pinOverrideUsed]
  )

  // Local-only edit for a row that hasn't been committed yet (failure_time
  // still unknown, so there's nothing to write -- see module comment).
  const updateDraft = useCallback((exerciseId, patch) => {
    setDraftLogs((current) => ({
      ...current,
      [exerciseId]: { ...current[exerciseId], ...patch },
    }))
  }, [])

  // The one insert that creates a row's session_exercise_logs record and
  // gates cell advance in the UI. Takes a full patch (not just
  // failureTime/failureTimeSource) so the M-classification auto-capture
  // case can commit stopwatchElapsed in the same insert, rather than
  // relying on a prior updateDraft call landing in state first.
  const commitFailureTime = useCallback(
    async (exerciseId, patch) => {
      const row = rows.find((r) => r.exerciseId === exerciseId)
      const draft = { ...draftLogs[exerciseId], ...patch }
      const orderIndex = rows.findIndex((r) => r.exerciseId === exerciseId)
      const id = crypto.randomUUID()
      const payload = {
        id,
        session_id: session.id,
        order_index: orderIndex,
        ...toLogPayload(row, draft),
      }

      await mutateOnlineOrQueue({ id, kind: 'insert', table: 'session_exercise_logs', payload })

      setDraftLogs((current) => ({
        ...current,
        [exerciseId]: { ...draft, logId: id },
      }))
      return { id, ...payload }
    },
    [rows, draftLogs, session]
  )

  // Autosaved edit to an already-committed row (e.g. correcting weight or
  // progression after the fact). Writes the field change to auto_save_history
  // alongside the update, per PRD's autosave audit trail.
  const updateLog = useCallback(
    async (exerciseId, patch) => {
      const draft = draftLogs[exerciseId]
      const row = rows.find((r) => r.exerciseId === exerciseId)
      const nextDraft = { ...draft, ...patch }

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'update',
        table: 'session_exercise_logs',
        payload: toLogPayload(row, nextDraft),
        matchId: draft.logId,
      })

      const historyRows = Object.keys(patch)
        .filter((field) => patch[field] !== draft[field])
        .map((field) => ({
          id: crypto.randomUUID(),
          session_id: session.id,
          field_name: `${row.abbreviation}.${field}`,
          previous_value: draft[field] == null ? null : String(draft[field]),
          new_value: patch[field] == null ? null : String(patch[field]),
        }))
      if (historyRows.length > 0) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'insert',
          table: 'auto_save_history',
          payload: historyRows,
        })
      }

      setDraftLogs((current) => ({ ...current, [exerciseId]: nextDraft }))
    },
    [draftLogs, rows, session]
  )

  // Type D swap (PRD 6.2/8.2): available at session open or mid-set.
  // original_exercise_id preserves the row's canonical exercise,
  // exercise_id becomes the replacement, swap_reason is required.
  // Movement classification inherits the replacement's default (8.2) --
  // coach can still adjust weight/progression/etc. normally afterward.
  // Before failure_time is committed there's no log row yet, so the swap
  // is draft-only and rides along in the eventual commitFailureTime
  // insert; after commit it's an update, mirroring updateLog's autosave
  // history pattern.
  //
  // This task, req #6: same "Make permanent" pattern as
  // changeMovementClassification -- `permanent` is a session-only default
  // unless checked, in which case the replacement also becomes the client's
  // stored default for this slot (client_exercise_order.exercise_id updated
  // in place) in addition to being logged for this session via
  // swap_permanent_change (0020 migration), which -- like
  // movement_classification_permanent_change -- distinguishes the two paths
  // in the log since swap_reason alone can't tell them apart. The
  // client_exercise_order write happens immediately regardless of whether
  // the log row exists yet, since it's independent of session-log timing.
  //
  // Follow-up fix: whether the row also gets flipped to is_manually_added
  // depends on the REPLACEMENT's exercise_type, not a blanket true. Row
  // categorization (sortSessionRows/rotationEngine.js) buckets a
  // client_exercise_order row by the CURRENT exercise's type (A/B) unless
  // is_manually_added is set. advance_client_rotation (0013/0020 migrations)
  // scopes its rotation_index update the same way -- by the row's CURRENT
  // exercise_id's type, via a join against `exercises`, not by
  // is_manually_added -- so the DB will keep advancing this row's
  // rotation_index on every Shuffle for as long as its exercise_id resolves
  // to a Type B exercise, permanent swap or not.
  //   - Replacement is Type B: leave is_manually_added untouched (don't set
  //     it true) and keep the row's existing rotation_index as-is. It stays
  //     in sortSessionRows' rotating Type B bucket and keeps advancing on
  //     Shuffle/session-close like any other Type B slot -- the DB is
  //     already advancing it regardless, so the app needs to agree.
  //   - Replacement is anything else (e.g. Type C, the Hammer Curl case):
  //     set is_manually_added: true as before. A row matching neither the
  //     Type A/B bucket nor manually-added would otherwise vanish from the
  //     exercise order on the next load; manually-added is the correct
  //     semantic fit for "a fixed, always-present, non-rotating slot," which
  //     is exactly what such a permanently swapped slot becomes.
  const swapExercise = useCallback(
    async (rowExerciseId, newExerciseId, reason, permanent = false) => {
      const row = rows.find((r) => r.exerciseId === rowExerciseId)
      const draft = draftLogs[rowExerciseId]
      const replacement = exercisesById[newExerciseId]
      const nextDraft = {
        ...draft,
        exerciseId: newExerciseId,
        originalExerciseId: row.exerciseId,
        swapReason: reason,
        swapPermanentChange: permanent,
        movementClassification:
          replacement?.default_movement_classification ?? draft.movementClassification,
      }

      if (permanent) {
        const replacementIsTypeB = replacement?.exercise_type === 'B'
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'update',
          table: 'client_exercise_order',
          // is_manually_added is set explicitly either way (not just added
          // when true) so a row that was previously flagged manually-added
          // by an earlier non-Type-B permanent swap correctly returns to
          // rotation eligibility if it's later swapped into a Type B
          // exercise, rather than staying stuck excluded.
          payload: replacementIsTypeB
            ? { exercise_id: newExerciseId, is_manually_added: false }
            : {
                exercise_id: newExerciseId,
                is_manually_added: true,
                added_at: new Date().toISOString(),
              },
          match: { client_id: clientId, exercise_id: rowExerciseId },
        })
      }

      if (!draft.logId) {
        setDraftLogs((current) => ({ ...current, [rowExerciseId]: nextDraft }))
        return
      }

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'update',
        table: 'session_exercise_logs',
        payload: toLogPayload(row, nextDraft),
        matchId: draft.logId,
      })

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'insert',
        table: 'auto_save_history',
        payload: [
          {
            id: crypto.randomUUID(),
            session_id: session.id,
            field_name: `${row.abbreviation}.exercise_id`,
            previous_value: draft.exerciseId,
            new_value: newExerciseId,
          },
          {
            id: crypto.randomUUID(),
            session_id: session.id,
            field_name: `${row.abbreviation}.swap_reason`,
            previous_value: draft.swapReason,
            new_value: reason,
          },
        ],
      })

      setDraftLogs((current) => ({ ...current, [rowExerciseId]: nextDraft }))
    },
    [rows, draftLogs, session, exercisesById, clientId]
  )

  // Req #4 (coach session UI/UX pass): a single shared stopwatch now tracks
  // whichever exercise cell is active (SessionWorkspace.jsx), rather than one
  // stopwatch instance per cell. This is the capture step that used to live
  // in ExerciseCell's local StopwatchControl onStop handler -- fired either
  // by a manual tap on the shared stopwatch or by switching which exercise
  // is active (PRD 8.4: "auto-captured when coach clicks stopwatch or moves
  // to next cell"). M-classification exercises also auto-capture failure
  // time from the same elapsed reading, same as before.
  const captureStopwatch = useCallback(
    async (exerciseId, elapsedSeconds) => {
      const draft = draftLogs[exerciseId]
      if (!draft) return
      const patch = { stopwatchElapsed: elapsedSeconds }
      if (draft.movementClassification === 'M') {
        patch.failureTime = elapsedSeconds
        patch.failureTimeSource = 'auto'
      }
      if ('failureTime' in patch && !draft.logId) {
        await commitFailureTime(exerciseId, patch)
        return
      }
      if (draft.logId) {
        await updateLog(exerciseId, patch)
      } else {
        updateDraft(exerciseId, patch)
      }
    },
    [draftLogs, commitFailureTime, updateLog, updateDraft]
  )

  // Req #5 (this task): the D/M/E picker's default path is a session-only
  // override -- reuses movement_classification_override, unchanged from PRD
  // 21.2 ("override does not change the stored default"). "Make permanent"
  // additionally writes the new classification back to client_exercise_order
  // so it becomes the default for every future session, and is tracked
  // separately via movement_classification_permanent_change (0019 migration)
  // so the log can still tell the two paths apart.
  const changeMovementClassification = useCallback(
    async (exerciseId, movementClassification, permanent) => {
      const draft = draftLogs[exerciseId]
      const patch = {
        movementClassification,
        movementClassificationOverride: true,
        movementClassificationPermanent: permanent,
      }

      if (draft.logId) {
        await updateLog(exerciseId, patch)
      } else {
        updateDraft(exerciseId, patch)
      }

      if (permanent) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'update',
          table: 'client_exercise_order',
          payload: { movement_classification: movementClassification },
          match: { client_id: clientId, exercise_id: exerciseId },
        })
        setRows((current) =>
          current.map((row) =>
            row.exerciseId === exerciseId ? { ...row, movementClassification } : row
          )
        )
      }
    },
    [draftLogs, updateLog, updateDraft, clientId]
  )

  // v0.1 notation system (0016_notations.sql): a session_exercise_log_notations
  // row only makes sense once the log itself exists (it's an FK to
  // session_exercise_logs.id), so all three mutations below are no-ops
  // until draft.logId is set -- NotationBar is rendered disabled in
  // ExerciseCell.jsx for exactly that state. `onConflict` upserts guard
  // against the rare double-tap race rather than the app tracking whether
  // a row already exists before writing.

  // DIS: present or absent, always count = 1.
  const toggleFlagNotation = useCallback(
    async (exerciseId, notation) => {
      const draft = draftLogs[exerciseId]
      if (!draft?.logId) return
      const notations = draft.notations ?? [] // guards a stale pre-v0.1 offline snapshot
      const applied = notations.some((n) => n.notationId === notation.id)

      if (applied) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'delete',
          table: 'session_exercise_log_notations',
          match: { session_exercise_log_id: draft.logId, notation_id: notation.id },
        })
        setDraftLogs((current) => ({
          ...current,
          [exerciseId]: {
            ...current[exerciseId],
            notations: notations.filter((n) => n.notationId !== notation.id),
          },
        }))
        return
      }

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'upsert',
        table: 'session_exercise_log_notations',
        payload: { session_exercise_log_id: draft.logId, notation_id: notation.id, count: 1 },
        onConflict: 'session_exercise_log_id,notation_id',
      })
      setDraftLogs((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          notations: [
            ...notations,
            { notationId: notation.id, code: notation.code, category: notation.category, count: 1 },
          ],
        },
      }))
    },
    [draftLogs]
  )

  // +1E/+2E/+3E, +1M/+2M/+3M: stacking counters, "numbers can go higher."
  // delta is +1 (tap the notation chip) or -1 (tap its small decrement).
  // Count dropping to 0 removes the row entirely rather than storing a
  // meaningless count:0 row.
  const adjustEffortNotation = useCallback(
    async (exerciseId, notation, delta) => {
      const draft = draftLogs[exerciseId]
      if (!draft?.logId) return
      const notations = draft.notations ?? [] // guards a stale pre-v0.1 offline snapshot
      const existing = notations.find((n) => n.notationId === notation.id)
      const nextCount = (existing?.count ?? 0) + delta

      if (nextCount <= 0) {
        if (existing) {
          await mutateOnlineOrQueue({
            id: crypto.randomUUID(),
            kind: 'delete',
            table: 'session_exercise_log_notations',
            match: { session_exercise_log_id: draft.logId, notation_id: notation.id },
          })
        }
        setDraftLogs((current) => ({
          ...current,
          [exerciseId]: {
            ...current[exerciseId],
            notations: notations.filter((n) => n.notationId !== notation.id),
          },
        }))
        return
      }

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'upsert',
        table: 'session_exercise_log_notations',
        payload: { session_exercise_log_id: draft.logId, notation_id: notation.id, count: nextCount },
        onConflict: 'session_exercise_log_id,notation_id',
      })
      setDraftLogs((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          notations: existing
            ? notations.map((n) => (n.notationId === notation.id ? { ...n, count: nextCount } : n))
            : [
                ...notations,
                { notationId: notation.id, code: notation.code, category: notation.category, count: nextCount },
              ],
        },
      }))
    },
    [draftLogs]
  )

  // ⓞⓚ / ⓞⓚ SP / F / NA: single-select within the outcome category --
  // selecting a new one clears whichever outcome notation was previously
  // applied; tapping the currently-applied one clears it with nothing
  // selected.
  const selectOutcomeNotation = useCallback(
    async (exerciseId, notation) => {
      const draft = draftLogs[exerciseId]
      if (!draft?.logId) return
      const notations = draft.notations ?? [] // guards a stale pre-v0.1 offline snapshot
      const outcomeNotationIds = notationCatalog
        .filter((n) => n.category === 'outcome')
        .map((n) => n.id)
      const currentOutcome = notations.find((n) => outcomeNotationIds.includes(n.notationId))
      const isDeselecting = currentOutcome?.notationId === notation.id

      if (currentOutcome) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'delete',
          table: 'session_exercise_log_notations',
          match: { session_exercise_log_id: draft.logId, notation_id: currentOutcome.notationId },
        })
      }
      if (!isDeselecting) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'upsert',
          table: 'session_exercise_log_notations',
          payload: { session_exercise_log_id: draft.logId, notation_id: notation.id, count: 1 },
          onConflict: 'session_exercise_log_id,notation_id',
        })
      }

      setDraftLogs((current) => ({
        ...current,
        [exerciseId]: {
          ...current[exerciseId],
          notations: [
            ...notations.filter((n) => !outcomeNotationIds.includes(n.notationId)),
            ...(isDeselecting
              ? []
              : [{ notationId: notation.id, code: notation.code, category: notation.category, count: 1 }]),
          ],
        },
      }))
    },
    [draftLogs, notationCatalog]
  )

  const savePainReport = useCallback(
    async ({ bodyArea, severity, notes: painNotes }) => {
      const id = crypto.randomUUID()
      const payload = {
        id,
        session_id: session.id,
        body_area: bodyArea,
        severity,
        notes: painNotes ?? null,
      }
      await mutateOnlineOrQueue({ id, kind: 'insert', table: 'pain_reports', payload })
      setPainReports((current) => [...current, payload])
      return payload
    },
    [session]
  )

  // PRD 6.3: follow-up flag for manager outreach, set at session close
  // alongside next_session_booked. Reason required (follow_up_flags.reason
  // is NOT NULL) -- same "no casual write" pattern as the settings audit
  // log and color-code log.
  const flagFollowUp = useCallback(
    async (reason) => {
      const id = crypto.randomUUID()
      const payload = {
        id,
        client_id: clientId,
        session_id: session.id,
        flagged_by: coachId,
        reason,
      }
      await mutateOnlineOrQueue({ id, kind: 'insert', table: 'follow_up_flags', payload })
      return payload
    },
    [clientId, coachId, session]
  )

  const saveNotes = useCallback(
    async (patch) => {
      const nextNotes = { session_id: session.id, ...notes, ...patch }
      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'upsert',
        table: 'coach_notes',
        payload: nextNotes,
        onConflict: 'session_id',
      })
      setNotes(nextNotes)
      return nextNotes
    },
    [session, notes]
  )

  const closeSession = useCallback(
    async ({ nextSessionBooked }) => {
      const endedAt = new Date().toISOString()

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'update',
        table: 'sessions',
        payload: { ended_at: endedAt, next_session_booked: nextSessionBooked },
        matchId: session.id,
      })

      const nextSession = { ...session, ended_at: endedAt, next_session_booked: nextSessionBooked }

      // PRD 8.3: rotation advances on session completion only -- no-show
      // and late-cancel sessions didn't happen, so they hold the rotation.
      if (!ROTATION_HOLD_STATUSES.includes(nextSession.status)) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'rpc',
          name: 'advance_client_rotation',
          params: { p_client_id: clientId },
        })
      }

      setSession(nextSession)
      setHasCompletedSession(true)
      return nextSession
    },
    [session, clientId]
  )

  // PRD 6.2 Shuffle button: manual rotation advance, same underlying DB
  // function session close uses. Reloads so the grid reflects the new Type
  // B order immediately. Known limitation: if queued offline, the visible
  // row order won't actually change until reconnect -- the rotation math
  // lives in the advance_client_rotation DB function, and isn't duplicated
  // client-side for this rare, non-session-logging action.
  const shuffleRotation = useCallback(async () => {
    await mutateOnlineOrQueue({
      id: crypto.randomUUID(),
      kind: 'rpc',
      name: 'advance_client_rotation',
      params: { p_client_id: clientId },
    })
    await load()
  }, [clientId, load])

  // PRD 5.5/6.4: lazily fetched by ReviewGateScreen only when the gate
  // actually renders -- original_baselines (locked founding weight) and the
  // full review_history log, both per exercise, joined with exercise
  // name/abbreviation for display.
  const loadReviewData = useCallback(async () => {
    const [{ data: baselines, error: baselinesError }, { data: history, error: historyError }] =
      await Promise.all([
        supabase
          .from('original_baselines')
          .select('exercise_id, weight, failure_time, exercises(name, abbreviation)')
          .eq('client_id', clientId),
        supabase
          .from('review_history')
          .select('exercise_id, weight, review_type, recorded_at')
          .eq('client_id', clientId)
          .order('recorded_at', { ascending: false }),
      ])
    if (baselinesError) throw baselinesError
    if (historyError) throw historyError
    return { baselines, history }
  }, [clientId])

  // Review happens before beginSession creates a session row, so session is
  // still null here -- review_history.session_id is nullable for exactly
  // this reason.
  const resolveReviewComplete = useCallback(
    async (weightsByExerciseId) => {
      const insertRows = Object.entries(weightsByExerciseId).map(([exerciseId, weight]) => ({
        id: crypto.randomUUID(),
        client_id: clientId,
        exercise_id: exerciseId,
        session_id: session?.id ?? null,
        review_type: 'six_session',
        weight,
        recorded_by: coachId,
      }))
      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'insert',
        table: 'review_history',
        payload: insertRows,
      })
      // The resolution itself is known good regardless of connectivity;
      // load() below reconciles with the server once it can.
      setReviewDue(false)
      await load()
    },
    [clientId, coachId, session, load]
  )

  const resolveReviewDecline = useCallback(
    async ({ reason, otherText }) => {
      const id = crypto.randomUUID()
      await mutateOnlineOrQueue({
        id,
        kind: 'insert',
        table: 'review_decline_log',
        payload: {
          id,
          client_id: clientId,
          session_id: session?.id ?? null,
          coach_id: coachId,
          decline_reason: reason,
          decline_reason_other: reason === 'other' ? otherText : null,
        },
      })
      setReviewDue(false)
      await load()
    },
    [clientId, coachId, session, load]
  )

  return {
    loading,
    loadError,
    client,
    rows,
    session,
    previousSessions,
    draftLogs,
    painReports,
    notes,
    exerciseCatalog,
    exercisesById,
    reviewDue,
    notationCatalog,
    machineSettingsCards,
    hasCompletedSession,
    updateMachineSettings,
    updateClientPreferences,
    assignAuxiliary,
    addExerciseToOrder,
    beginSession,
    updateDraft,
    commitFailureTime,
    updateLog,
    swapExercise,
    captureStopwatch,
    changeMovementClassification,
    toggleFlagNotation,
    adjustEffortNotation,
    selectOutcomeNotation,
    shuffleRotation,
    loadReviewData,
    resolveReviewComplete,
    resolveReviewDecline,
    savePainReport,
    flagFollowUp,
    saveNotes,
    closeSession,
    reload: load,
  }
}
