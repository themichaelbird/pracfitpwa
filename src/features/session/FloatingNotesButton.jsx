import { useEffect, useRef, useState } from 'react'

// v0.2 req #11: floating button, stays visible while scrolling. Opens a
// free-text field with the keyboard appearing automatically (autofocus);
// minimizing dismisses the keyboard (blur) and saves. Stored as
// coach_notes.general_note -- its own field, separate from the four
// structured fields, surfaced read-only at session close
// (SessionCloseStep.jsx) so the coach can reference it while filling those
// in. Usable during prep too (before Begin Session, per req #4) -- if there's
// no session yet to attach to, the text is buffered locally and flushed via
// onSave once hasSession flips true.
//
// Follow-up pass, req #4: moved from top-left to bottom-right. First tried
// as a `fixed` overlay, but that only guarantees it never scrolls behind the
// very LAST bit of content (the Close Session row, via reserved bottom
// padding) -- at any OTHER scroll position, whatever collapsed exercise row
// happens to land in that screen corner would still end up underneath a
// fixed element and get covered/blocked. So instead this button is now a
// plain in-flow element that SessionWorkspace places in its own
// non-scrolling footer strip, the same structural-separation trick item #2
// uses for the stopwatch -- the scrollable grid is sized to the space
// between the header and footer strips, so no row can ever be positioned
// under either one, at any scroll offset.
//
// Accidental close: text being typed is saved when the page is hidden, the
// same save minimizing does (blur doesn't reliably fire when the iPad app is
// backgrounded or swiped away). The pre-session buffer has nowhere to be
// saved yet, so it's kept on the device per client and put back -- labeled
// -- when that client's prep is reopened within BUFFER_MAX_AGE_MS.
const BUFFER_MAX_AGE_MS = 12 * 60 * 60 * 1000 // same as useSessionCore's RESTORE_MAX_AGE_MS
const bufferKey = (clientId) => `pracfit-general-note-buffer:${clientId}`

function readBuffer(clientId) {
  try {
    const record = JSON.parse(localStorage.getItem(bufferKey(clientId)) ?? 'null')
    if (record && Date.now() - record.editedAt < BUFFER_MAX_AGE_MS) return record.text
    localStorage.removeItem(bufferKey(clientId))
  } catch {
    // storage blocked or unreadable: nothing to restore
  }
  return null
}

// Synchronous on purpose -- it has to be on disk before the app can be killed.
function writeBuffer(clientId, text) {
  try {
    if (text) localStorage.setItem(bufferKey(clientId), JSON.stringify({ text, editedAt: Date.now() }))
    else localStorage.removeItem(bufferKey(clientId))
  } catch {
    // storage blocked: the buffer still works for as long as the app stays open
  }
}

export function FloatingNotesButton({ clientId, hasSession, generalNote, onSave }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [initialBuffer] = useState(() => (hasSession ? null : readBuffer(clientId)))
  const [bufferedDraft, setBufferedDraft] = useState(initialBuffer)
  const [restoredFromDevice, setRestoredFromDevice] = useState(initialBuffer !== null)
  const textareaRef = useRef(null)
  // The general_note last sent by a hide-flush while open, so minimizing
  // afterwards doesn't send the same text again.
  const sentRef = useRef(null)
  const flushRef = useRef(null)

  function bufferDraft(text) {
    if (text === bufferedDraft) return
    setBufferedDraft(text)
    writeBuffer(clientId, text)
    setRestoredFromDevice(false)
  }

  useEffect(() => {
    if (open) {
      sentRef.current = null
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
      writeBuffer(clientId, null)
      setRestoredFromDevice(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession])

  function handleMinimize() {
    textareaRef.current?.blur()
    if (hasSession) {
      if (sentRef.current === null || draft !== sentRef.current) onSave({ general_note: draft || null })
    } else {
      bufferDraft(draft)
    }
    setOpen(false)
  }

  flushRef.current = () => {
    if (!hasSession) {
      bufferDraft(draft)
      return
    }
    if (draft === (sentRef.current ?? generalNote ?? '')) return
    sentRef.current = draft
    onSave({ general_note: draft || null })
  }

  useEffect(() => {
    if (!open) return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [open])

  const hasContent = Boolean((bufferedDraft ?? generalNote ?? '').trim())

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="General session note"
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition ${
          hasContent ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
        }`}
      >
        📝
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/20 p-4" onClick={handleMinimize}>
          <div
            className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">General note</h2>
                {restoredFromDevice && !hasSession && (
                  <p className="text-[11px] font-medium text-amber-700">Restored from this device</p>
                )}
              </div>
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
