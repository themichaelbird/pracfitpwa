import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { sortSessionRows } from './rotationEngine'
import { mutateOnlineOrQueue } from '../../lib/mutateOnlineOrQueue'
import { loadSnapshot, saveSnapshot } from '../../lib/offlineQueue'

const ROTATION_HOLD_STATUSES = ['late_cancel', 'no_show']

// PRD 8.3: "Auxiliary A on session 1, B on session 2, C (where applicable)
// on session 3" -- alphabetical cycling among whichever slot letters the
// client actually has an is_current auxiliary_config row for. Mirrors the
// initialization branch of advance_client_rotation (0013): before the first
// advance, clients.auxiliary_active_slot is still null, so both the DB
// function and this read path fall back to the first configured letter
// rather than showing no auxiliary row at all.
function resolveActiveAuxiliarySlot(configuredSlots, storedActiveSlot) {
  if (configuredSlots.length === 0) return null
  if (storedActiveSlot && configuredSlots.includes(storedActiveSlot)) return storedActiveSlot
  return [...configuredSlots].sort()[0]
}

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

function buildPreviousColumn(session, logs, exercisesById, canonicalRows) {
  return {
    session,
    rows: canonicalRows.map((row) => {
      const log = matchLog(logs, row.exerciseId)
      if (!log) return { exerciseId: row.exerciseId, log: null }

      return {
        exerciseId: row.exerciseId,
        log,
        performedExercise: exercisesById[log.exercise_id] ?? null,
        isSwap: log.exercise_id !== row.exerciseId,
      }
    }),
  }
}

function emptyDraft(row, prefillWeight) {
  return {
    weight: prefillWeight ?? '',
    movementClassification: row.movementClassification,
    movementClassificationOverride: false,
    setTypeOverride: false,
    setTypeOverrideValue: null,
    stopwatchElapsed: null,
    failureTime: null,
    failureTimeSource: null,
    progression: null,
    progressionAmount: null,
    exerciseId: row.exerciseId, // Type D swap target; defaults to the row's canonical exercise
    originalExerciseId: null,
    swapReason: null,
    logId: null, // set once a session_exercise_logs row actually exists
  }
}

function fromCommittedLog(log) {
  return {
    weight: log.weight ?? '',
    movementClassification: log.movement_classification,
    movementClassificationOverride: log.movement_classification_override,
    setTypeOverride: log.set_type_override,
    setTypeOverrideValue: log.set_type_override_value,
    stopwatchElapsed: log.stopwatch_elapsed,
    failureTime: log.failure_time,
    failureTimeSource: log.failure_time_source,
    progression: log.progression,
    progressionAmount: log.progression_amount,
    exerciseId: log.exercise_id,
    originalExerciseId: log.original_exercise_id,
    swapReason: log.swap_reason,
    logId: log.id,
  }
}

// PRD 6.2/8.2: Type D swap -- exercise_id is the replacement actually
// performed, original_exercise_id preserves the row's canonical exercise.
// draft.exerciseId defaults to the row's own exercise (emptyDraft) so this
// is a no-op payload until swapExercise changes it.
function toLogPayload(row, draft) {
  return {
    exercise_id: draft.exerciseId,
    original_exercise_id: draft.originalExerciseId,
    swap_reason: draft.swapReason,
    weight: draft.weight === '' ? null : draft.weight,
    movement_classification: draft.movementClassification,
    movement_classification_override: draft.movementClassificationOverride,
    set_type_override: draft.setTypeOverride,
    set_type_override_value: draft.setTypeOverrideValue,
    stopwatch_elapsed: draft.stopwatchElapsed,
    failure_time: draft.failureTime,
    failure_time_source: draft.failureTimeSource,
    progression: draft.progression,
    progression_amount: draft.progressionAmount,
  }
}

// Data layer for the Session Core screen: the client's exercise rows (PRD
// 5.4 settings column), the last two completed sessions (read-only
// columns), and the live session's in-progress logs. A session_exercise_logs
// row is only ever written once failure_time is known (NOT NULL in the
// schema), so field edits before that stay local-only via updateDraft;
// commitFailureTime does the one insert that gates cell advance, and
// updateLog handles autosaved edits to an already-committed row.
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
  const [exerciseCatalog, setExerciseCatalog] = useState([]) // all active exercises, for Type D swap candidates
  const [reviewDue, setReviewDue] = useState(false) // PRD 5.5: 6-session review gate

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
        { data: orderRows, error: orderError },
        { data: auxiliaryRows, error: auxiliaryError },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase
          .from('client_exercise_order')
          .select(
            'exercise_id, movement_classification, rotation_index, exercises(id, name, abbreviation, exercise_type, machine_name, body_section, muscle_group)'
          )
          .eq('client_id', clientId)
          .eq('is_active', true),
        // PRD 8.2/8.3: the client's current A/B slot assignments for the
        // rotating auxiliary row -- see resolveActiveAuxiliarySlot below.
        supabase
          .from('auxiliary_config')
          .select(
            'slot, exercise_id, exercises(id, name, abbreviation, exercise_type, machine_name, body_section, muscle_group, default_movement_classification)'
          )
          .eq('client_id', clientId)
          .eq('is_current', true),
      ])
      if (clientError) throw clientError
      if (orderError) throw orderError
      if (auxiliaryError) throw auxiliaryError

      const { data: settingsRows, error: settingsError } = await supabase
        .from('client_exercise_settings')
        .select('*')
        .eq('client_id', clientId)
      if (settingsError) throw settingsError
      const settingsByExercise = Object.fromEntries(
        settingsRows.map((s) => [s.exercise_id, s])
      )

      // Type D swap candidates (PRD 8.2: "any exercise") -- full active catalog.
      const { data: catalogRows, error: catalogError } = await supabase
        .from('exercises')
        .select('id, name, abbreviation, default_movement_classification')
        .eq('is_active', true)
        .order('abbreviation')
      if (catalogError) throw catalogError

      // Type C exercises no longer come from client_exercise_order -- the
      // rotation engine sources the one auxiliary row from auxiliary_config
      // instead (see below). A client's own Type A/B rows are the only rows
      // built directly off their order list.
      const fixedRows = orderRows
        .filter((o) => o.exercises.exercise_type === 'A' || o.exercises.exercise_type === 'B')
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
          settings: settingsByExercise[o.exercise_id]?.settings ?? {},
          settingsId: settingsByExercise[o.exercise_id]?.id ?? null,
        }))

      const configuredSlots = auxiliaryRows.map((a) => a.slot)
      const activeSlot = resolveActiveAuxiliarySlot(configuredSlots, clientRow.auxiliary_active_slot)
      const activeAuxiliary = auxiliaryRows.find((a) => a.slot === activeSlot) ?? null

      const auxiliaryRow = activeAuxiliary
        ? {
            exerciseId: activeAuxiliary.exercise_id,
            name: activeAuxiliary.exercises.name,
            abbreviation: activeAuxiliary.exercises.abbreviation,
            exerciseType: activeAuxiliary.exercises.exercise_type,
            machineName: activeAuxiliary.exercises.machine_name,
            bodySection: activeAuxiliary.exercises.body_section,
            muscleGroup: activeAuxiliary.exercises.muscle_group,
            movementClassification: activeAuxiliary.exercises.default_movement_classification,
            rotationIndex: null,
            isAuxiliary: true,
            settings: settingsByExercise[activeAuxiliary.exercise_id]?.settings ?? {},
            settingsId: settingsByExercise[activeAuxiliary.exercise_id]?.id ?? null,
          }
        : null

      const builtRows = sortSessionRows(
        auxiliaryRow ? [...fixedRows, auxiliaryRow] : fixedRows
      )

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

      // Resume an already-open session (app closed mid-session) instead of
      // forcing a fresh Start Session.
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
          .in('id', performedExerciseIds)
        if (performedError) throw performedError
        const exercisesById = Object.fromEntries(performedExercises.map((e) => [e.id, e]))

        previousColumns = pastSessions.map((s) =>
          buildPreviousColumn(
            s,
            pastLogs.filter((l) => l.session_id === s.id),
            exercisesById,
            builtRows
          )
        )
      }

      const mostRecentColumn = previousColumns[0]
      let drafts = Object.fromEntries(
        builtRows.map((row) => {
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
  ])

  // Settings column edits (tap-and-hold, PRD 5.4) must land in both
  // client_exercise_settings and settings_audit_log together -- same
  // reasoning as update_client_color_code (0010): a reason is required
  // (settings_audit_log.reason is NOT NULL) since this is the machine
  // settings audit trail, not a casual edit.
  const updateExerciseSettings = useCallback(
    async (exerciseId, newSettings, reason) => {
      const row = rows.find((r) => r.exerciseId === exerciseId)
      const previousSettings = row.settings

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'upsert',
        table: 'client_exercise_settings',
        payload: { client_id: clientId, exercise_id: exerciseId, settings: newSettings },
        onConflict: 'client_id,exercise_id',
      })

      await mutateOnlineOrQueue({
        id: crypto.randomUUID(),
        kind: 'insert',
        table: 'settings_audit_log',
        payload: {
          id: crypto.randomUUID(),
          client_id: clientId,
          exercise_id: exerciseId,
          changed_by: coachId,
          previous_settings: previousSettings,
          new_settings: newSettings,
          reason,
        },
      })

      setRows((current) =>
        current.map((r) => (r.exerciseId === exerciseId ? { ...r, settings: newSettings } : r))
      )
    },
    [rows, clientId, coachId]
  )

  // PRD 5.8: "Session logged as unscheduled in status field." There's no
  // schedule to compare against to infer this, so StartSessionGate has the
  // coach declare it explicitly -- everything else about the walk-in flow
  // (search -> profile -> Start Session) already matches a normal session.
  const startSession = useCallback(
    async ({ sessionType, setType, isUnscheduled }) => {
      const id = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      const status = isUnscheduled ? 'unscheduled_walk_in' : 'completed'
      const payload = {
        id,
        client_id: clientId,
        coach_id: coachId,
        location_id: client.location_id,
        session_type: sessionType,
        set_type: setType,
        pin_override_used: pinOverrideUsed,
        status,
      }

      await mutateOnlineOrQueue({ id, kind: 'insert', table: 'sessions', payload })

      // Mirrors the row shape the DB would hand back, using the same
      // defaults declared in 0002_schema.sql -- so closeSession's
      // status/rotation-hold check and every other reader of `session`
      // works identically whether this insert already reached the server.
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
          rows.map((row) => {
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
  const swapExercise = useCallback(
    async (rowExerciseId, newExerciseId, reason) => {
      const row = rows.find((r) => r.exerciseId === rowExerciseId)
      const draft = draftLogs[rowExerciseId]
      const replacement = exercisesById[newExerciseId]
      const nextDraft = {
        ...draft,
        exerciseId: newExerciseId,
        originalExerciseId: row.exerciseId,
        swapReason: reason,
        movementClassification:
          replacement?.default_movement_classification ?? draft.movementClassification,
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
    [rows, draftLogs, session, exercisesById]
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
      // There's no UI yet that can produce those statuses (Schedule view,
      // not built), so this guard is currently always true in practice, but
      // it's the correct condition for when that UI exists.
      if (!ROTATION_HOLD_STATUSES.includes(nextSession.status)) {
        await mutateOnlineOrQueue({
          id: crypto.randomUUID(),
          kind: 'rpc',
          name: 'advance_client_rotation',
          params: { p_client_id: clientId },
        })
      }

      setSession(nextSession)
      return nextSession
    },
    [session, clientId]
  )

  // PRD 6.2 Shuffle button: manual rotation advance, same underlying DB
  // function session close uses. Reloads so the grid reflects the new
  // order/auxiliary exercise immediately. Known limitation: if queued
  // offline, the visible row order won't actually change until reconnect --
  // the rotation math lives in the advance_client_rotation DB function, and
  // isn't duplicated client-side for this rare, non-session-logging action.
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
  // name/abbreviation for display. Not offline-cached: the review gate is a
  // rare (every 6th session), gating step outside the normal session-logging
  // flow this week's offline support targets -- a coach hitting it with no
  // connection at all sees ReviewGateScreen's existing load-error state.
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

  // Review happens before Start Session creates a session row (PRD 5.5:
  // "before Start Session is available"), so session is still null here --
  // review_history.session_id is nullable for exactly this reason.
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
    updateExerciseSettings,
    startSession,
    updateDraft,
    commitFailureTime,
    updateLog,
    swapExercise,
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
