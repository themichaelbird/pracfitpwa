import { useState } from 'react'
import { useSessionCore } from './useSessionCore'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { ClientHeaderBar } from './ClientHeaderBar'
import { ReviewGateScreen } from './ReviewGateScreen'
import { PainIntakeStep } from './PainIntakeStep'
import { SessionWorkspace } from './SessionWorkspace'
import { SessionCloseStep } from './SessionCloseStep'

// v0.2 req #4: "Open" no longer creates a session record or gates entry --
// the workspace renders immediately so the coach can prep machines, set
// auxiliaries, and review the workout before the client arrives. Step order
// is now driven by the coach tapping "Begin Session" (BeginSessionPanel.jsx,
// rendered inside SessionWorkspace): 6-session review gate (only when due)
// -> session record created (core.beginSession) -> pain intake -> live
// workout grid -> close. The review gate has no local "resolved" flag:
// completing or declining it writes to the DB and reloads core state, so
// core.reviewDue itself flips to false; onReviewResolved below is what then
// actually creates the session and advances to pain intake.
export function SessionScreen({ clientId, coach, onBack, onGoToRecap }) {
  const core = useSessionCore({
    clientId,
    coachId: coach.id,
    pinOverrideUsed: coach.pinOverrideUsed ?? false,
  })
  const { online, pendingCount } = useOnlineStatus(core.reload)
  const [step, setStep] = useState('workspace') // 'workspace' | 'review-gate' | 'pain-intake' | 'close'
  const [pendingBeginOptions, setPendingBeginOptions] = useState(null)
  const [beginError, setBeginError] = useState(null)

  if (core.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="text-slate-600">Loading session…</p>
      </div>
    )
  }

  if (core.loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <p className="max-w-md text-center text-red-600">
          Couldn't load session: {core.loadError}
        </p>
      </div>
    )
  }

  // Coach tapped "Begin Session" and confirmed set type / unscheduled in
  // BeginSessionPanel. Review gate first if due; otherwise create the
  // session immediately and go straight to pain intake.
  async function handleBeginRequested(options) {
    setBeginError(null)
    if (core.reviewDue) {
      setPendingBeginOptions(options)
      setStep('review-gate')
      return
    }
    try {
      await core.beginSession(options)
      setStep('pain-intake')
    } catch (err) {
      setBeginError(err.message)
    }
  }

  // Errors intentionally propagate back to ReviewGateScreen's own
  // try/catch (it already resets its submitting state and shows the
  // message inline) rather than being swallowed here -- this component
  // isn't rendering ReviewGateScreen's UI, so it has no way to surface an
  // error to the coach itself at this step.
  async function handleReviewResolved(resolve) {
    await resolve()
    await core.beginSession(pendingBeginOptions ?? { setType: 'S', isUnscheduled: false })
    setPendingBeginOptions(null)
    setStep('pain-intake')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <ClientHeaderBar
        client={core.client}
        onBack={onBack}
        online={online}
        pendingCount={pendingCount}
        onUpdatePreferences={core.updateClientPreferences}
      />

      {step === 'review-gate' && (
        <ReviewGateScreen
          client={core.client}
          loadReviewData={core.loadReviewData}
          onComplete={(weights) => handleReviewResolved(() => core.resolveReviewComplete(weights))}
          onDecline={(payload) => handleReviewResolved(() => core.resolveReviewDecline(payload))}
        />
      )}

      {step === 'pain-intake' && (
        <PainIntakeStep
          painReports={core.painReports}
          onSave={core.savePainReport}
          onDone={() => setStep('workspace')}
        />
      )}

      {step === 'workspace' && (
        <SessionWorkspace
          core={core}
          onCloseSession={() => setStep('close')}
          onBeginRequested={handleBeginRequested}
          beginError={beginError}
        />
      )}

      {step === 'close' && (
        <SessionCloseStep
          notes={core.notes}
          onSaveNotes={core.saveNotes}
          onFlagFollowUp={core.flagFollowUp}
          onClose={core.closeSession}
          onDone={onBack}
          onGoToRecap={onGoToRecap}
        />
      )}
    </div>
  )
}
