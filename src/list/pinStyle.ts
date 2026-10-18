import type React from 'react'
import type { Column } from '@tanstack/react-table'

export function pinStyle<TData>(column: Column<TData, unknown>): React.CSSProperties | undefined {
  const side = column.getIsPinned()
  if (!side) return undefined
  return side === 'left'
    ? { position: 'sticky', left: column.getStart('left'), zIndex: 1 }
    : { position: 'sticky', right: column.getAfter('right'), zIndex: 1 }
}

export function pinEdgeClass<TData>(column: Column<TData, unknown>): string | undefined {
  if (column.getIsLastColumn('left')) return 'jtl-pin-edge--left'
  if (column.getIsFirstColumn('right')) return 'jtl-pin-edge--right'
  return undefined
}

export function alignClass<TData>(column: Column<TData, unknown>): string | undefined {
  const align = column.columnDef.meta?.align
  return align && align !== 'left' ? `jtl-align--${align}` : undefined
}
