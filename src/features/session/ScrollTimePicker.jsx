import { useEffect, useRef } from 'react'

const ITEM_HEIGHT = 32
const MINUTES = Array.from({ length: 6 }, (_, i) => i) // 0-5
const SECONDS = Array.from({ length: 60 }, (_, i) => i) // 0-59

function WheelColumn({ values, value, onChange }) {
  const containerRef = useRef(null)
  const scrollTimeout = useRef(null)

  useEffect(() => {
    const index = values.indexOf(value)
    if (index >= 0 && containerRef.current) {
      containerRef.current.scrollTop = index * ITEM_HEIGHT
    }
  }, [value, values])

  function handleScroll(event) {
    clearTimeout(scrollTimeout.current)
    const scrollTop = event.target.scrollTop
    scrollTimeout.current = setTimeout(() => {
      const index = Math.min(
        Math.max(Math.round(scrollTop / ITEM_HEIGHT), 0),
        values.length - 1
      )
      onChange(values[index])
    }, 100)
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-24 w-12 snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none]"
      >
        <div style={{ height: ITEM_HEIGHT }} />
        {values.map((v) => (
          <div
            key={v}
            className="flex snap-center items-center justify-center text-sm text-slate-700"
            style={{ height: ITEM_HEIGHT }}
          >
            {String(v).padStart(2, '0')}
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT }} />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 border-y border-slate-300"
        aria-hidden="true"
      />
    </div>
  )
}

// PRD 5.4/13: scroll-wheel time picker, used for D/E exercise failure time
// and for the M-exercise manual override. Value is total seconds.
export function ScrollTimePicker({ seconds, onChange }) {
  const minutes = Math.floor((seconds ?? 0) / 60)
  const secs = (seconds ?? 0) % 60

  return (
    <div className="flex items-center justify-center gap-1">
      <WheelColumn values={MINUTES} value={minutes} onChange={(m) => onChange(m * 60 + secs)} />
      <span className="text-slate-400">:</span>
      <WheelColumn values={SECONDS} value={secs} onChange={(s) => onChange(minutes * 60 + s)} />
    </div>
  )
}
