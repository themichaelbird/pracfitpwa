import { useState } from 'react'
import { useSessionCore } from './useSessionCore'
import { ClientHeaderBar } from './ClientHeaderBar'
import { ReviewGateScreen } from './ReviewGateScreen'
import { StartSessionGate } from './StartSessionGate'
import { PainIntakeStep } from './PainIntakeStep'
import { SessionWorkspace } from './SessionWorkspace'
import { SessionCloseStep } from './SessionCloseStep'

// PRD 5.4/5.5: Session Core. Step order once a client is picked: 6-session
// review gate (only when due) -> gate (Start Session) -> pain intake -> the
// live workout grid -> close. A session already open on load (app closed
// mid-workout) resumes straight into the workspace -- pain intake only ever
// runs once, right after Start Session. The review gate has no local
// "resolved" flag: completing or declining it writes to the DB and reloads
// core state, so core.reviewDue itself flips to false and this component
// just stops rendering ReviewGateScreen on the next render.
export function SessionScreen({ clientId, coach, onBack, onGoToRecap }) {
  const core = useSessionCore({ clientId, coachId: coach.id })
  const [step, setStep] = useState('gate')

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

  const effectiveStep = core.session && step === 'gate' ? 'workspace' : step
  const showReviewGate = effectiveStep === 'gate' && !core.session && core.reviewDue

  return (
    <div className="min-h-screen bg-slate-100">
      <ClientHeaderBar client={core.client} onBack={onBack} />

      {showReviewGate && (
        <ReviewGateScreen
          client={core.client}
          loadReviewData={core.loadReviewData}
          onComplete={core.resolveReviewComplete}
          onDecline={core.resolveReviewDecline}
        />
      )}

      {effectiveStep === 'gate' && !showReviewGate && (
        <StartSessionGate
          client={core.client}
          onStart={async (options) => {
            await core.startSession(options)
            setStep('pain-intake')
          }}
        />
      )}

      {effectiveStep === 'pain-intake' && (
        <PainIntakeStep
          painReports={core.painReports}
          onSave={core.savePainReport}
          onDone={() => setStep('workspace')}
        />
      )}

      {effectiveStep === 'workspace' && (
        <SessionWorkspace core={core} onCloseSession={() => setStep('close')} />
      )}

      {effectiveStep === 'close' && (
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
