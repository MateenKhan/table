import React from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import { firstLeafId } from './firstLeafId'
import { ListBody } from './ListBody'
import { ListHead } from './ListHead'
import { ListPager } from './ListPager'
import { ListToolbar } from './ListToolbar'
import type { ListTableProps } from './types'
import { useControllable } from './useControllable'

const CORE_MODEL = getCoreRowModel()
const FILTERED_MODEL = getFilteredRowModel()
const SORTED_MODEL = getSortedRowModel()
const PAGINATED_MODEL = getPaginationRowModel()
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]
const NO_SORTING: SortingState = []
const NO_FILTERS: ColumnFiltersState = []
const DEFAULT_COLUMN = { filterFn: 'includesString' as const, minSize: 48 }

export function ListTable<TData>({
  columns,
  data,
  getRowId,
  onRowClick,
  getRowHref,
  manual = false,
  rowCount,
  pagination: paginationProp,
  onPaginationChange,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  sorting: sortingProp,
  onSortingChange,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  columnFilters: columnFiltersProp,
  onColumnFiltersChange,
  searchDebounceMs = 300,
  searchPlaceholder = 'Search…',
  loading = false,
  emptyMessage,
  stickyFirstColumn = true,
  exportFileName = 'export',
  toolbar,
  className = '',
  caption,
}: ListTableProps<TData>) {
  const [pagination, setPagination] = useControllable<PaginationState>(
    paginationProp,
    onPaginationChange,
    { pageIndex: 0, pageSize },
  )
  const [sorting, setSorting] = useControllable(sortingProp, onSortingChange, NO_SORTING)
  const [globalFilter, setGlobalFilter] = useControllable(globalFilterProp, onGlobalFilterChange, '')
  const [columnFilters, setColumnFilters] = useControllable(
    columnFiltersProp,
    onColumnFiltersChange,
    NO_FILTERS,
  )
  const [showFilters, setShowFilters] = React.useState(() => !!columnFiltersProp?.length)

  const firstPage = React.useCallback(
    () => setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 })),
    [setPagination],
  )
  const changeSorting = React.useCallback(
    (updater: Updater<SortingState>) => {
      setSorting(updater)
      firstPage()
    },
    [setSorting, firstPage],
  )
  const changeFilters = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      setColumnFilters(updater)
      firstPage()
    },
    [setColumnFilters, firstPage],
  )
  const search = React.useCallback(
    (value: Updater<string>) => {
      setGlobalFilter(value)
      firstPage()
    },
    [setGlobalFilter, firstPage],
  )

  const [initialState] = React.useState(() => {
    const pinned = stickyFirstColumn ? firstLeafId(columns) : undefined
    return { columnPinning: { left: pinned ? [pinned] : [] } }
  })

  const table = useReactTable({
    data,
    columns,
    getRowId,
    defaultColumn: DEFAULT_COLUMN,
    initialState,
    state: { pagination, sorting, globalFilter, columnFilters },
    onPaginationChange: setPagination,
    onSortingChange: changeSorting,
    onGlobalFilterChange: search,
    onColumnFiltersChange: changeFilters,
    manualPagination: manual,
    manualSorting: manual,
    manualFiltering: manual,
    rowCount: manual ? rowCount : undefined,
    autoResetPageIndex: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: CORE_MODEL,
    getFilteredRowModel: manual ? undefined : FILTERED_MODEL,
    getSortedRowModel: manual ? undefined : SORTED_MODEL,
    getPaginationRowModel: manual ? undefined : PAGINATED_MODEL,
  })

  return (
    <div data-jt="list" className={`jt-list flex min-w-0 max-w-full flex-col ${className}`}>
      <ListToolbar
        table={table}
        search={globalFilter}
        onSearch={search}
        searchDelay={searchDebounceMs}
        placeholder={searchPlaceholder}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((open) => !open)}
        exportFileName={exportFileName}
      >
        {toolbar}
      </ListToolbar>
      <div className="min-h-0 max-w-full flex-1 overflow-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white">
        <table
          aria-busy={loading || undefined}
          style={{ width: table.getTotalSize() }}
          className="min-w-full table-fixed border-separate border-spacing-0"
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <ListHead table={table} showFilters={showFilters} filterDelay={searchDebounceMs} />
          <ListBody
            table={table}
            loading={loading}
            emptyMessage={emptyMessage}
            onRowClick={onRowClick}
            getRowHref={getRowHref}
          />
        </table>
      </div>
      <ListPager table={table} pageSizeOptions={pageSizeOptions} loading={loading} />
    </div>
  )
}

export default ListTable
