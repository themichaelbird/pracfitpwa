import { useEffect, useRef, useState } from 'react'

// v0.2 req #11: floating button pinned top-left, stays visible while
// scrolling. Opens a free-text field with the keyboard appearing
// automatically (autofocus); minimizing dismisses the keyboard (blur) and
// saves. Stored as coach_notes.general_note -- its own field, separate from
// the four structured fields, surfaced read-only at session close
// (SessionCloseStep.jsx) so the coach can reference it while filling those
// in. Usable during prep too (before Begin Session, per req #4) -- if there's
// no session yet to attach to, the text is buffered locally and flushed via
// onSave once hasSession flips true.
export function FloatingNotesButton({ hasSession, generalNote, onSave }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [bufferedDraft, setBufferedDraft] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (open) {
      setDraft(bufferedDraft ?? generalNote ?? '')
      // Autofocus opens the keyboard on iPad Safari; a tick after mount so
      // the element is actually in the DOM first.
      const id = setTimeout(() => textareaRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Flush a buffered pre-session draft the moment a real session exists.
  useEffect(() => {
    if (hasSession && bufferedDraft !== null) {
      onSave({ general_note: bufferedDraft || null })
      setBufferedDraft(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])

  function handleMinimize() {
    textareaRef.current?.blur()
    if (hasSession) {
      onSave({ general_note: draft || null })
    } else {
      setBufferedDraft(draft)
    }
    setOpen(false)
  }

  const hasContent = Boolean((bufferedDraft ?? generalNote ?? '').trim())

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="General session note"
        className={`fixed left-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition ${
          hasContent ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
        }`}
      >
        📝
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-start bg-black/20 p-4" onClick={handleMinimize}>
          <div
            className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">General note</h2>
              <button
                type="button"
                onClick={handleMinimize}
                className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Minimize note"
              >
                ✕
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              placeholder="Anything worth remembering for this session…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>
      )}
    </>
  )
}
