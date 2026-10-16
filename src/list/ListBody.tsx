import React from 'react'
import { flexRender, type Cell, type Row, type Table } from '@tanstack/react-table'
import { alignClass, pinEdgeClass, pinStyle } from './pinStyle'
import { hasTextSelection, isOwnInteraction, ROW_LINK_ATTR, wantsNewTab } from './rowClick'
import type { ListTableProps } from './types'

type Props<TData> = Pick<ListTableProps<TData>, 'onRowClick' | 'getRowHref' | 'emptyMessage'> & {
  table: Table<TData>
  loading: boolean
}

const openInNewTab = (href: string) => window.open(href, '_blank', 'noopener')

const isRowLink = (target: EventTarget | null) =>
  !!(target as Element | null)?.closest?.(`[${ROW_LINK_ATTR}]`)

function BodyCell<TData>({ cell, href, linked }: { cell: Cell<TData, unknown>; href?: string; linked: boolean }) {
  const content = flexRender(cell.column.columnDef.cell, cell.getContext())
  return (
    <td
      style={pinStyle(cell.column)}
      className={`border-b border-slate-100 bg-white px-3 py-2 text-sm text-slate-800 group-hover:bg-slate-50 ${alignClass(cell.column)} ${pinEdgeClass(cell.column)}`}
    >
      {linked && href ? (
        <a {...{ [ROW_LINK_ATTR]: '' }} href={href} className="block text-inherit no-underline">
          {content}
        </a>
      ) : (
        content
      )}
    </td>
  )
}

function BodyRow<TData>({ row, onRowClick, getRowHref }: Pick<Props<TData>, 'onRowClick' | 'getRowHref'> & { row: Row<TData> }) {
  const href = getRowHref?.(row.original)
  const clickable = !!onRowClick || !!href

  const onClick = (event: React.MouseEvent) => {
    if (isOwnInteraction(event) || hasTextSelection()) return
    const onLink = isRowLink(event.target)
    if (href && wantsNewTab(event)) {
      if (!onLink) openInNewTab(href)
      return
    }
    if (onRowClick) {
      if (onLink) event.preventDefault()
      onRowClick(row.original, row.index, event)
      return
    }
    if (href && !onLink) window.location.assign(href)
  }

  const onAuxClick = (event: React.MouseEvent) => {
    if (event.button !== 1 || !href || isRowLink(event.target) || isOwnInteraction(event)) return
    openInNewTab(href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onRowClick?.(row.original, row.index, event)
  }

  const focusable = !!onRowClick && !href
  return (
    <tr
      data-row-id={row.id}
      className={`group ${clickable ? 'cursor-pointer' : ''}`}
      onClick={clickable ? onClick : undefined}
      onAuxClick={href ? onAuxClick : undefined}
      onKeyDown={focusable ? onKeyDown : undefined}
      tabIndex={focusable ? 0 : undefined}
    >
      {row.getVisibleCells().map((cell, index) => (
        <BodyCell key={cell.id} cell={cell} href={href} linked={index === 0} />
      ))}
    </tr>
  )
}

export function ListBody<TData>({ table, loading, emptyMessage, onRowClick, getRowHref }: Props<TData>) {
  const rows = table.getRowModel().rows
  if (!rows.length) {
    return (
      <tbody>
        <tr>
          <td
            colSpan={table.getVisibleLeafColumns().length || 1}
            className="px-3 py-10 text-center text-sm text-slate-500"
          >
            {loading ? 'Loading…' : (emptyMessage ?? 'No results')}
          </td>
        </tr>
      </tbody>
    )
  }
  return (
    <tbody className={loading ? 'opacity-60 transition-opacity' : undefined}>
      {rows.map((row) => (
        <BodyRow key={row.id} row={row} onRowClick={onRowClick} getRowHref={getRowHref} />
      ))}
    </tbody>
  )
}
