import React from 'react'
import type { Column, Table } from '@tanstack/react-table'
import { FormatPicker } from './FormatPicker'
import { Icon } from './icons'
import { useLabels } from './labelsContext'
import { viewOf } from './viewOf'

const columnLabel = <TData,>(column: Column<TData, unknown>) => {
  const header = column.columnDef.header
  return typeof header === 'string' && header ? header : column.id
}

function useCloseOnOutside(ref: React.RefObject<HTMLDetailsElement>) {
  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menu = ref.current
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ref])
}

export function ColumnsMenu<TData>({ table }: { table: Table<TData> }) {
  const labels = useLabels()
  const ref = React.useRef<HTMLDetailsElement>(null)
  useCloseOnOutside(ref)
  const view = viewOf(table)
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() || column.getCanPin() || view?.kindOf(column.id))
  if (!columns.length) return null
  return (
    <details ref={ref} className="jtl-menu">
      <summary className="jtl-btn" aria-label={labels.columns} title={labels.columns}>
        <Icon name="columns" />
      </summary>
      <div className="jtl-menu-panel">
        {columns.map((column) => {
          const label = columnLabel(column)
          const pinned = column.getIsPinned()
          return (
            <div key={column.id} className="jtl-menu-item">
              <label className="jtl-menu-label">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  disabled={!column.getCanHide()}
                  onChange={column.getToggleVisibilityHandler()}
                />
                <span className="jtl-truncate">{label}</span>
              </label>
              {column.getCanPin() ? (
                <button
                  type="button"
                  aria-pressed={!!pinned}
                  aria-label={pinned ? labels.unpin(label) : labels.pin(label)}
                  onClick={() => column.pin(pinned ? false : 'left')}
                  className="jtl-btn jtl-btn--bare"
                >
                  {pinned ? <Icon name="pinOff" size={12} /> : <Icon name="pin" size={12} />}
                </button>
              ) : null}
              {view ? <FormatPicker view={view} columnId={column.id} label={label} /> : null}
            </div>
          )
        })}
      </div>
    </details>
  )
}
