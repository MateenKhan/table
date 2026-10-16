import React from 'react'
import type { Table } from '@tanstack/react-table'
import { Icon } from './icons'
import { ColumnsMenu } from './ColumnsMenu'
import { downloadCsv, toCsv } from './csv'
import { useLabels } from './labelsContext'
import { useDebouncedCommit } from './useDebouncedCommit'

type Props<TData> = {
  table: Table<TData>
  search: string
  onSearch: (value: string) => void
  searchDelay: number
  showFilters: boolean
  onToggleFilters: () => void
  exportFileName: string | false
  children?: React.ReactNode
}

export function ListToolbar<TData>({
  table,
  search,
  onSearch,
  searchDelay,
  showFilters,
  onToggleFilters,
  exportFileName,
  children,
}: Props<TData>) {
  const labels = useLabels()
  const [text, setText] = React.useState(search)
  React.useEffect(() => setText(search), [search])
  useDebouncedCommit(text, search, searchDelay, onSearch)
  const canFilter = table.getAllLeafColumns().some((column) => column.getCanFilter())

  return (
    <div className="jtl-toolbar">
      <label className="jtl-search">
        <Icon name="search" className="jtl-search-icon" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.search}
          className="jtl-input jtl-input--search"
        />
      </label>
      <div className="jtl-tools">
        {canFilter ? (
          <button
            type="button"
            className="jtl-btn"
            aria-pressed={showFilters}
            aria-label={labels.columnFilters}
            title={labels.columnFilters}
            onClick={onToggleFilters}
          >
            <Icon name="filter" />
          </button>
        ) : null}
        <ColumnsMenu table={table} />
        {exportFileName === false ? null : (
          <button
            type="button"
            className="jtl-btn"
            aria-label={labels.exportCsv}
            title={labels.exportCsv}
            onClick={() => downloadCsv(toCsv(table), exportFileName)}
          >
            <Icon name="download" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
