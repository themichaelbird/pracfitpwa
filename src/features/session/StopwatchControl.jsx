function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Req #4 (coach session UI/UX pass): now a single shared, controlled
// stopwatch rendered once at the top-middle of the session screen instead of
// one instance per exercise cell -- SessionWorkspace.jsx owns the underlying
// useStopwatch instance and routes the running/elapsed state and taps to
// whichever exercise cell is currently active (useSessionCore.captureStopwatch).
export function StopwatchControl({ running, elapsedSeconds, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`h-16 w-48 rounded-xl text-4xl font-semibold tabular-nums tracking-tight transition ${
        running ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {running
        ? formatSeconds(elapsedSeconds)
        : elapsedSeconds > 0
          ? formatSeconds(elapsedSeconds)
          : '▶'}
    </button>
  )
}
