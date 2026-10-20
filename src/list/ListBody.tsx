import React from 'react'
import { flexRender, type Cell, type Row, type Table } from '@tanstack/react-table'
import { cx } from './classNames'
import { EXPAND_COLUMN_ID } from './expandColumn'
import { formattedCell } from './formattedCell'
import { useLabels } from './labelsContext'
import { alignClass, pinEdgeClass, pinStyle } from './pinStyle'
import { hasTextSelection, isOwnInteraction, ROW_LINK_ATTR, wantsNewTab } from './rowClick'
import type { ListTableProps } from './types'
import { viewOf } from './viewOf'

type RowOptions<TData> = Pick<ListTableProps<TData>, 'onRowClick' | 'getRowHref' | 'getRowProps' | 'renderExpanded'>

type Props<TData> = RowOptions<TData> & {
  table: Table<TData>
  loading: boolean
  emptyMessage?: React.ReactNode
}

const openInNewTab = (href: string) => window.open(href, '_blank', 'noopener')

const isRowLink = (target: EventTarget | null) => !!(target as Element | null)?.closest?.(`[${ROW_LINK_ATTR}]`)

function CellContent<TData>({ cell }: { cell: Cell<TData, unknown> }) {
  const { column } = cell
  const view = viewOf(cell.getContext().table)
  const wrap = view ? view.wraps(column.id) : !!column.columnDef.meta?.wrap
  const value = cell.getValue()
  const shown = column.columnDef.cell === formattedCell ? (view?.display(column.id, value) ?? value) : value
  return (
    <span
      className={cx('jtl-cell', wrap && 'jtl-cell--wrap')}
      title={!wrap && (typeof shown === 'string' || column.columnDef.cell === formattedCell) && shown != null ? String(shown) : undefined}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </span>
  )
}

function BodyCell<TData>({ cell, href }: { cell: Cell<TData, unknown>; href?: string }) {
  const expander = cell.column.id === EXPAND_COLUMN_ID
  const content = expander ? flexRender(cell.column.columnDef.cell, cell.getContext()) : <CellContent cell={cell} />
  return (
    <td
      style={{ minWidth: cell.column.columnDef.minSize, ...pinStyle(cell.column) }}
      className={cx('jtl-td', expander && 'jtl-td--expander', alignClass(cell.column), pinEdgeClass(cell.column))}
    >
      {href ? (
        <a {...{ [ROW_LINK_ATTR]: '' }} href={href} className="jtl-link">
          {content}
        </a>
      ) : (
        content
      )}
    </td>
  )
}

function BodyRow<TData>({ row, onRowClick, getRowHref, getRowProps, renderExpanded }: RowOptions<TData> & { row: Row<TData> }) {
  const href = getRowHref?.(row.original)
  const clickable = !!onRowClick || !!href
  const rowProps = getRowProps?.(row.original, row.index)
  const cells = row.getVisibleCells()
  const linkCell = href ? cells.find((cell) => cell.column.id !== EXPAND_COLUMN_ID) : undefined

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
    <>
      <tr
        {...rowProps}
        data-row-id={row.id}
        className={cx('jtl-row', clickable && 'jtl-row--clickable', rowProps?.className)}
        onClick={clickable ? onClick : undefined}
        onAuxClick={href ? onAuxClick : undefined}
        onKeyDown={focusable ? onKeyDown : undefined}
        tabIndex={focusable ? 0 : undefined}
      >
        {cells.map((cell) => (
          <BodyCell key={cell.id} cell={cell} href={cell === linkCell ? href : undefined} />
        ))}
      </tr>
      {renderExpanded && row.getIsExpanded() ? (
        <tr className="jtl-row" data-expanded-for={row.id}>
          <td colSpan={cells.length} className="jtl-td jtl-td--expanded">
            {renderExpanded(row.original, row.index)}
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function ListBody<TData>({ table, loading, emptyMessage, ...rowOptions }: Props<TData>) {
  const labels = useLabels()
  const rows = table.getRowModel().rows
  if (!rows.length) {
    return (
      <tbody>
        <tr className="jtl-row">
          <td colSpan={table.getVisibleLeafColumns().length || 1} className="jtl-td jtl-td--empty">
            {loading ? labels.loading : (emptyMessage ?? labels.empty)}
          </td>
        </tr>
      </tbody>
    )
  }
  return (
    <tbody className={loading ? 'jtl-body--loading' : undefined}>
      {rows.map((row) => (
        <BodyRow key={row.id} row={row} {...rowOptions} />
      ))}
    </tbody>
  )
}
