import { useStopwatch } from '../../lib/useStopwatch'

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// PRD 5.4/13, v0.1: stopwatch, manual start, stops on tap. Sized to roughly
// a standard iPhone stopwatch display -- big enough to read at a glance and
// hit one-handed mid-session -- which is why SessionWorkspace.jsx now gives
// the live session column extra width relative to the read-only previous
// columns; this control is meant to dominate that column, not share a thin
// row with other controls. ("...or advancing to the next cell" would need
// sequential cell navigation, which isn't part of this build -- tap-to-stop
// is the only trigger for now.)
export function StopwatchControl({ onStop }) {
  const { running, elapsedSeconds, start, stop } = useStopwatch()

  function handleTap() {
    if (running) {
      onStop(stop())
    } else {
      start()
    }
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`h-20 w-full rounded-xl text-5xl font-semibold tabular-nums tracking-tight transition ${
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
