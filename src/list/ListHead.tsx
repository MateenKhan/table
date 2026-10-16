import { flexRender, type Header, type Table } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { FilterInput } from './FilterInput'
import { alignClass, pinEdgeClass, pinStyle } from './pinStyle'

type Props<TData> = {
  table: Table<TData>
  showFilters: boolean
  filterDelay: number
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const

export const headerLabel = <TData,>(header: Header<TData, unknown>) => {
  const def = header.column.columnDef.header
  return typeof def === 'string' ? def : header.column.id
}

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (dir === 'asc') return <ArrowUp size={12} aria-hidden="true" />
  if (dir === 'desc') return <ArrowDown size={12} aria-hidden="true" />
  return <ChevronsUpDown size={12} aria-hidden="true" className="opacity-40" />
}

function HeadCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header
  const leaf = header.subHeaders.length === 0
  const sorted = column.getIsSorted()
  const content = header.isPlaceholder
    ? null
    : flexRender(column.columnDef.header, header.getContext())
  return (
    <th
      colSpan={header.colSpan}
      scope="col"
      aria-sort={leaf && sorted ? ARIA_SORT[sorted] : undefined}
      style={{ width: header.getSize(), ...(leaf ? pinStyle(column) : undefined) }}
      className={`relative border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ${alignClass(column)} ${leaf ? pinEdgeClass(column) : ''}`}
    >
      {leaf && column.getCanSort() && !header.isPlaceholder ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex max-w-full items-center gap-1 border-0 bg-transparent p-0 font-semibold text-inherit"
        >
          <span className="truncate">{content}</span>
          <SortIcon dir={sorted} />
        </button>
      ) : (
        content
      )}
      {leaf && column.getCanResize() ? (
        <div
          aria-hidden="true"
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={() => column.resetSize()}
          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none sm:hover:bg-slate-300 ${column.getIsResizing() ? 'bg-slate-400' : ''}`}
        />
      ) : null}
    </th>
  )
}

export function ListHead<TData>({ table, showFilters, filterDelay }: Props<TData>) {
  const groups = table.getHeaderGroups()
  const leafHeaders = groups[groups.length - 1]?.headers ?? []
  return (
    <thead className="sticky top-0 z-[2]">
      {groups.map((group) => (
        <tr key={group.id}>
          {group.headers.map((header) => (
            <HeadCell key={header.id} header={header} />
          ))}
        </tr>
      ))}
      {showFilters ? (
        <tr>
          {leafHeaders.map((header) => (
            <th
              key={header.id}
              style={pinStyle(header.column)}
              className={`border-b border-slate-200 bg-slate-50 px-2 py-1 ${pinEdgeClass(header.column)}`}
            >
              {header.column.getCanFilter() ? (
                <FilterInput
                  column={header.column}
                  label={headerLabel(header)}
                  delay={filterDelay}
                />
              ) : null}
            </th>
          ))}
        </tr>
      ) : null}
    </thead>
  )
}
