import type { Table } from '@tanstack/react-table'
import { Icon } from './icons'
import { useLabels } from './labelsContext'

type Props<TData> = {
  table: Table<TData>
  pageSizeOptions: number[]
  loading: boolean
}

const formatCount = (value: number) => value.toLocaleString()

export function ListPager<TData>({ table, pageSizeOptions, loading }: Props<TData>) {
  const labels = useLabels()
  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getRowCount()
  const pageCount = Math.max(1, table.getPageCount())
  const from = total ? pageIndex * pageSize + 1 : 0
  const to = Math.min(total, (pageIndex + 1) * pageSize)
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)
  const canBack = table.getCanPreviousPage()
  const canForward = table.getCanNextPage()

  return (
    <nav aria-label={labels.pagination} className="jtl-pager">
      <span role="status" aria-live="polite">
        {loading ? labels.loading : labels.range(formatCount(from), formatCount(to), formatCount(total))}
      </span>
      <div className="jtl-pager-group">
        <label className="jtl-pager-size">
          <span>{labels.rowsPerPage}</span>
          <select
            value={pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="jtl-select"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>{labels.page(formatCount(pageIndex + 1), formatCount(pageCount))}</span>
        <div className="jtl-tools">
          <button type="button" className="jtl-btn" aria-label={labels.firstPage} disabled={!canBack} onClick={() => table.firstPage()}>
            <Icon name="chevronsLeft" />
          </button>
          <button type="button" className="jtl-btn" aria-label={labels.previousPage} disabled={!canBack} onClick={() => table.previousPage()}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="jtl-btn" aria-label={labels.nextPage} disabled={!canForward} onClick={() => table.nextPage()}>
            <Icon name="chevronRight" />
          </button>
          <button type="button" className="jtl-btn" aria-label={labels.lastPage} disabled={!canForward} onClick={() => table.lastPage()}>
            <Icon name="chevronsRight" />
          </button>
        </div>
      </div>
    </nav>
  )
}
