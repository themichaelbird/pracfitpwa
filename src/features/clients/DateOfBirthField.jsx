import { DateOfBirthPicker } from './DateOfBirthPicker'

function formatDisplay(iso) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

// Req #1: once a client's DOB has been saved at least once, replace the
// scroll-wheel picker with a locked, read-only display -- guards against an
// accidental wheel nudge silently changing a client's age on file. Tapping
// the lock re-enables the picker with no confirmation step (ClientProfileScreen
// owns `unlocked`/`onUnlock` so it can re-lock automatically after a save).
// `hasBeenSet` reflects the persisted client record, not an unsaved
// in-progress edit, so a brand-new client (date_of_birth still null) always
// gets the normal scroll-wheel entry on first setup.
export function DateOfBirthField({ value, hasBeenSet, unlocked, onUnlock, onChange }) {
  if (!hasBeenSet || unlocked) {
    return <DateOfBirthPicker value={value} onChange={onChange} />
  }

  return (
    <div className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-4">
      <span className="text-slate-900">{formatDisplay(value)}</span>
      <button
        type="button"
        onClick={onUnlock}
        aria-label="Unlock date of birth for editing"
        className="rounded p-1 text-lg text-slate-500 hover:text-slate-900"
      >
        🔒
      </button>
    </div>
  )
}
