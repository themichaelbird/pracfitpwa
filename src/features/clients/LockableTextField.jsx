// This task, req #3: same lock pattern as DateOfBirthField.jsx (commit
// 12ff2ff) generalized to any plain text profile field. Once a value has
// been saved at least once, it displays as locked read-only text with a lock
// icon; tapping the icon unlocks it for a correction, no confirmation step.
// `hasBeenSet` reflects the persisted client record, not an unsaved
// in-progress edit, so a brand-new client (field still empty) always gets a
// normal text input on first setup. ClientProfileScreen owns
// `unlocked`/`onUnlock` so it can re-lock automatically after a save.
export function LockableTextField({ label, value, hasBeenSet, unlocked, onUnlock, onChange }) {
  if (!hasBeenSet || unlocked) {
    return (
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    )
  }

  return (
    <div className="flex h-12 items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-4">
      <span className="text-slate-900">{value || '—'}</span>
      <button
        type="button"
        onClick={onUnlock}
        aria-label={`Unlock ${label.toLowerCase()} for editing`}
        className="rounded p-1 text-lg text-slate-500 hover:text-slate-900"
      >
        🔒
      </button>
    </div>
  )
}
