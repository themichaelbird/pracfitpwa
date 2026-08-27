import { useEffect, useMemo, useRef } from 'react'

const ITEM_HEIGHT = 40 // px -- also drives the wheel's visible height (5 rows) below
const VISIBLE_ROWS = 5
const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2)

const MONTHS = [
  ['01', 'Jan'],
  ['02', 'Feb'],
  ['03', 'Mar'],
  ['04', 'Apr'],
  ['05', 'May'],
  ['06', 'Jun'],
  ['07', 'Jul'],
  ['08', 'Aug'],
  ['09', 'Sep'],
  ['10', 'Oct'],
  ['11', 'Nov'],
  ['12', 'Dec'],
]

function daysInMonth(month, year) {
  if (!month) return 31
  // Falls back to a leap year (31/29-safe) when year isn't picked yet, so Feb
  // still offers 29 days rather than clamping to 28 before a year exists.
  return new Date(year || 2024, Number(month), 0).getDate()
}

// One scroll-snap column: renders `items` (each [value, label]) plus
// PAD_ROWS blank rows above/below so the first/last real item can still
// scroll-snap to the vertical center. Reports the centered item on scroll
// (debounced via scrollend/rAF) and re-syncs its scroll position whenever
// `value` changes from outside (e.g. day count clamping after a month/year
// change).
function WheelColumn({ items, value, onChange, ariaLabel }) {
  const containerRef = useRef(null)
  const scrollingFromProp = useRef(false)

  const selectedIndex = Math.max(
    0,
    items.findIndex(([itemValue]) => itemValue === value)
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    scrollingFromProp.current = true
    el.scrollTop = selectedIndex * ITEM_HEIGHT
    const reset = setTimeout(() => {
      scrollingFromProp.current = false
    }, 50)
    return () => clearTimeout(reset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, items.length])

  function handleScroll(event) {
    if (scrollingFromProp.current) return
    const el = event.currentTarget
    const index = Math.round(el.scrollTop / ITEM_HEIGHT)
    const clamped = Math.min(Math.max(index, 0), items.length - 1)
    const nextValue = items[clamped]?.[0]
    if (nextValue !== undefined && nextValue !== value) {
      onChange(nextValue)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      className="h-[200px] w-full snap-y snap-mandatory overflow-y-auto scroll-smooth rounded-xl border border-slate-300 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {Array.from({ length: PAD_ROWS }).map((_, i) => (
        <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
      ))}
      {items.map(([itemValue, label], index) => (
        <div
          key={itemValue}
          role="option"
          aria-selected={index === selectedIndex}
          style={{ height: ITEM_HEIGHT }}
          className={`flex snap-center items-center justify-center text-lg transition ${
            index === selectedIndex ? 'font-semibold text-slate-900' : 'text-slate-400'
          }`}
        >
          {label}
        </div>
      ))}
      {Array.from({ length: PAD_ROWS }).map((_, i) => (
        <div key={`pad-bottom-${i}`} style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
      ))}
    </div>
  )
}

function parseIso(value) {
  if (!value) return { month: '', day: '', year: '' }
  const [year, month, day] = value.split('-')
  return { month, day, year }
}

// Req #1 (v0.2): DOB entry as three independent scroll wheels rather than a
// single native date input. Emits/accepts a plain ISO 'YYYY-MM-DD' string --
// clients.date_of_birth needs no schema change for this. Year range covers
// adult clients back 100 years; day count clamps to the selected month/year
// (leap years included via daysInMonth's Date(year, month, 0) trick).
export function DateOfBirthPicker({ value, onChange }) {
  const { month, day, year } = parseIso(value)

  const currentYear = new Date().getFullYear()
  const years = useMemo(() => {
    const list = []
    for (let y = currentYear; y >= currentYear - 100; y -= 1) list.push(y)
    return list.reverse().map((y) => [String(y), String(y)])
  }, [currentYear])

  const dayCount = daysInMonth(month, year)
  const days = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, i) => {
        const d = String(i + 1).padStart(2, '0')
        return [d, d]
      }),
    [dayCount]
  )

  function emit(nextMonth, nextDay, nextYear) {
    if (!nextMonth || !nextDay || !nextYear) return
    const clampedDay = String(Math.min(Number(nextDay), daysInMonth(nextMonth, nextYear))).padStart(2, '0')
    onChange(`${nextYear}-${nextMonth}-${clampedDay}`)
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <p className="text-center text-xs font-medium text-slate-500">Month</p>
          <WheelColumn
            items={MONTHS}
            value={month}
            ariaLabel="Birth month"
            onChange={(nextMonth) => emit(nextMonth, day || '01', year || String(currentYear - 30))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-center text-xs font-medium text-slate-500">Day</p>
          <WheelColumn
            items={days}
            value={day}
            ariaLabel="Birth day"
            onChange={(nextDay) => emit(month || '01', nextDay, year || String(currentYear - 30))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-center text-xs font-medium text-slate-500">Year</p>
          <WheelColumn
            items={years}
            value={year}
            ariaLabel="Birth year"
            onChange={(nextYear) => emit(month || '01', day || '01', nextYear)}
          />
        </div>
      </div>
    </div>
  )
}
