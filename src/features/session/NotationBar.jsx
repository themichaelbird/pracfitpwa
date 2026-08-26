const EFFORT_COLOR = {
  EFFORT_E: 'bg-violet-100 text-violet-700',
  EFFORT_M: 'bg-amber-100 text-amber-700',
}

// v0.1 notation spec, left to right: [time/reps field, rendered by the
// caller] -> DIS -> effort notations (+1E/+2E/+3E, +1M/+2M/+3M) -> outcome
// (ⓞⓚ / ⓞⓚ SP / F / NA). `catalog` is the live `notations` table contents
// (fetched once per session load in useSessionCore.js) rather than a
// hardcoded list, so a new notation added to the DB shows up here with no
// code change -- the extensibility requirement from the spec. Read-only
// historical cells pass no handlers and render static (non-interactive)
// badges instead of buttons.
export function NotationBar({ catalog, notations, disabled, onToggleFlag, onAdjustEffort, onSelectOutcome }) {
  if (!catalog || catalog.length === 0) return null

  const interactive = Boolean(onToggleFlag && onAdjustEffort && onSelectOutcome)
  const Tag = interactive ? 'button' : 'span'

  const flags = catalog.filter((n) => n.category === 'flag')
  const effort = catalog.filter((n) => n.category === 'effort')
  const outcomes = catalog.filter((n) => n.category === 'outcome')

  function countFor(notationId) {
    return notations?.find((n) => n.notationId === notationId)?.count ?? 0
  }

  function isApplied(notationId) {
    return notations?.some((n) => n.notationId === notationId) ?? false
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${
        disabled ? 'pointer-events-none opacity-40' : ''
      }`}
    >
      {flags.map((notation) => {
        if (!interactive && !isApplied(notation.id)) return null
        return (
          <Tag
            key={notation.id}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onToggleFlag(notation) : undefined}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
              isApplied(notation.id) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {notation.symbol}
          </Tag>
        )
      })}

      {effort.map((notation) => {
        const count = countFor(notation.id)
        return (
          <div key={notation.id} className="flex items-center gap-0.5">
            {interactive && count > 0 && (
              <button
                type="button"
                onClick={() => onAdjustEffort(notation, -1)}
                aria-label={`Remove one ${notation.label}`}
                className="rounded px-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
              >
                −
              </button>
            )}
            {(count > 0 || interactive) && (
              <Tag
                type={interactive ? 'button' : undefined}
                onClick={interactive ? () => onAdjustEffort(notation, 1) : undefined}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  count > 0
                    ? (EFFORT_COLOR[notation.code] ?? 'bg-slate-200 text-slate-700')
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                +{count > 0 ? count : 1}
                {notation.symbol}
              </Tag>
            )}
          </div>
        )
      })}

      {outcomes.map((notation) => {
        if (!interactive && !isApplied(notation.id)) return null
        return (
          <Tag
            key={notation.id}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onSelectOutcome(notation) : undefined}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
              isApplied(notation.id) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {notation.symbol}
          </Tag>
        )
      })}
    </div>
  )
}
