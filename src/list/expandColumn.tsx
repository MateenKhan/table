import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { Icon } from './icons'
import { useLabels } from './labelsContext'

export const EXPAND_COLUMN_ID = 'jtl-expand'

function ExpandToggle<TData>({ row }: CellContext<TData, unknown>) {
  const labels = useLabels()
  if (!row.getCanExpand()) return null
  const open = row.getIsExpanded()
  return (
    <button
      type="button"
      className="jtl-btn jtl-btn--bare"
      aria-expanded={open}
      aria-label={open ? labels.collapseRow : labels.expandRow}
      onClick={row.getToggleExpandedHandler()}
    >
      {open ? <Icon name="chevronDown" /> : <Icon name="chevronRight" />}
    </button>
  )
}

export function expandColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: EXPAND_COLUMN_ID,
    header: '',
    size: 44,
    minSize: 44,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    enableResizing: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    cell: ExpandToggle,
  }
}
