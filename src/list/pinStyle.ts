import type React from 'react'
import type { Column } from '@tanstack/react-table'

export function pinStyle<TData>(column: Column<TData, unknown>): React.CSSProperties | undefined {
  const side = column.getIsPinned()
  if (!side) return undefined
  return side === 'left'
    ? { position: 'sticky', left: column.getStart('left'), zIndex: 1 }
    : { position: 'sticky', right: column.getAfter('right'), zIndex: 1 }
}

export function pinEdgeClass<TData>(column: Column<TData, unknown>): string {
  if (column.getIsLastColumn('left')) return 'shadow-[inset_-1px_0_0_#e2e8f0]'
  if (column.getIsFirstColumn('right')) return 'shadow-[inset_1px_0_0_#e2e8f0]'
  return ''
}

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const

export function alignClass<TData>(column: Column<TData, unknown>): string {
  return ALIGN_CLASS[column.columnDef.meta?.align ?? 'left']
}
