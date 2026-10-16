import React from 'react'
import type { Column, Table } from '@tanstack/react-table'
import { Columns3, Pin, PinOff } from 'lucide-react'
import { TOOL_BUTTON } from './toolClasses'

const columnLabel = <TData,>(column: Column<TData, unknown>) => {
  const header = column.columnDef.header
  return typeof header === 'string' ? header : column.id
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
  const ref = React.useRef<HTMLDetailsElement>(null)
  useCloseOnOutside(ref)
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide() || column.getCanPin())
  if (!columns.length) return null
  return (
    <details ref={ref} className="relative">
      <summary className={`${TOOL_BUTTON} list-none [&::-webkit-details-marker]:hidden`} aria-label="Columns" title="Columns">
        <Columns3 size={14} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-10 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {columns.map((column) => {
          const label = columnLabel(column)
          const pinned = column.getIsPinned()
          return (
            <div key={column.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 sm:hover:bg-slate-50">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  disabled={!column.getCanHide()}
                  onChange={column.getToggleVisibilityHandler()}
                />
                <span className="truncate">{label}</span>
              </label>
              {column.getCanPin() ? (
                <button
                  type="button"
                  aria-pressed={!!pinned}
                  aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
                  onClick={() => column.pin(pinned ? false : 'left')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border-0 bg-transparent text-slate-500 sm:hover:bg-slate-100"
                >
                  {pinned ? <PinOff size={12} aria-hidden="true" /> : <Pin size={12} aria-hidden="true" />}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </details>
  )
}
