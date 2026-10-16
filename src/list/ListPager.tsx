import type { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

type Props<TData> = {
  table: Table<TData>
  pageSizeOptions: number[]
  loading: boolean
}

const BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 sm:hover:bg-slate-50'

const formatCount = (value: number) => value.toLocaleString()

export function ListPager<TData>({ table, pageSizeOptions, loading }: Props<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getRowCount()
  const pageCount = Math.max(1, table.getPageCount())
  const from = total ? pageIndex * pageSize + 1 : 0
  const to = Math.min(total, (pageIndex + 1) * pageSize)
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-xs text-slate-600">
      <span role="status" aria-live="polite">
        {loading ? 'Loading…' : `${formatCount(from)}–${formatCount(to)} of ${formatCount(total)}`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-8 rounded border border-slate-200 bg-white px-1 text-xs"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span aria-label="Page">
          {formatCount(pageIndex + 1)} / {formatCount(pageCount)}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className={BUTTON} aria-label="First page" disabled={!table.getCanPreviousPage()} onClick={() => table.firstPage()}>
            <ChevronsLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" className={BUTTON} aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" className={BUTTON} aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className={BUTTON} aria-label="Last page" disabled={!table.getCanNextPage()} onClick={() => table.lastPage()}>
            <ChevronsRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
}
