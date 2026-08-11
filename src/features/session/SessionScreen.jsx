import { useState } from 'react'
import { useSessionCore } from './useSessionCore'
import { ClientHeaderBar } from './ClientHeaderBar'
import { StartSessionGate } from './StartSessionGate'
import { PainIntakeStep } from './PainIntakeStep'
import { SessionWorkspace } from './SessionWorkspace'
import { SessionCloseStep } from './SessionCloseStep'

// PRD 5.4: Session Core. Step order once a client is picked: gate (Start
// Session) -> pain intake -> the live workout grid -> close. A session
// already open on load (app closed mid-workout) resumes straight into the
// workspace -- pain intake only ever runs once, right after Start Session.
export function SessionScreen({ clientId, coach, onBack }) {
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

  return (
    <div className="min-h-screen bg-slate-100">
      <ClientHeaderBar client={core.client} onBack={onBack} />

      {effectiveStep === 'gate' && (
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
          onClose={async (options) => {
            await core.closeSession(options)
            onBack()
          }}
        />
      )}
    </div>
  )
}
