import { MachineSettingsCell } from './MachineSettingsCell'

// PRD 5.4: fixed far-left column, always visible. Placed into the shared
// SessionWorkspace grid via explicit gridColumn/gridRow rather than owning
// its own nested grid, so rows stay aligned with the session columns.
export function SettingsColumn({ rows, columnIndex, onUpdateSettings }) {
  return (
    <>
      <div
        style={{ gridColumn: columnIndex, gridRow: 1 }}
        className="flex items-center bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Machine settings
      </div>

      {rows.map((row, index) => (
        <MachineSettingsCell
          key={row.exerciseId}
          row={row}
          columnIndex={columnIndex}
          gridRow={index + 2}
          onUpdateSettings={onUpdateSettings}
        />
      ))}
    </>
  )
}
