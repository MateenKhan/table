import React from 'react'
import type { Table } from '@tanstack/react-table'
import { Download, ListFilter, Search } from 'lucide-react'
import { ColumnsMenu } from './ColumnsMenu'
import { downloadCsv, toCsv } from './csv'
import { TOOL_BUTTON } from './toolClasses'
import { useDebouncedCommit } from './useDebouncedCommit'

type Props<TData> = {
  table: Table<TData>
  search: string
  onSearch: (value: string) => void
  searchDelay: number
  placeholder: string
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
  placeholder,
  showFilters,
  onToggleFilters,
  exportFileName,
  children,
}: Props<TData>) {
  const [text, setText] = React.useState(search)
  React.useEffect(() => setText(search), [search])
  useDebouncedCommit(text, search, searchDelay, onSearch)
  const canFilter = table.getAllLeafColumns().some((column) => column.getCanFilter())

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <label className="relative flex min-w-0 flex-1 basis-48 items-center">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2 text-slate-400" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="h-8 w-full min-w-0 rounded border border-slate-200 bg-white pl-7 pr-2 text-sm text-slate-800 outline-none focus:border-slate-400"
        />
      </label>
      <div className="flex items-center gap-1">
        {canFilter ? (
          <button type="button" className={TOOL_BUTTON} aria-pressed={showFilters} aria-label="Column filters" title="Column filters" onClick={onToggleFilters}>
            <ListFilter size={14} aria-hidden="true" />
          </button>
        ) : null}
        <ColumnsMenu table={table} />
        {exportFileName === false ? null : (
          <button
            type="button"
            className={TOOL_BUTTON}
            aria-label="Export CSV"
            title="Export CSV"
            onClick={() => downloadCsv(toCsv(table), exportFileName)}
          >
            <Download size={14} aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
