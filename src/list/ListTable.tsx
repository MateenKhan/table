import React from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type PaginationState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import { cx } from './classNames'
import { EXPAND_COLUMN_ID, expandColumn } from './expandColumn'
import { firstLeafId } from './firstLeafId'
import type { ColumnFormats, FormatOptions } from './format'
import { withFormattedCells } from './formattedCell'
import { useListView } from './listView'
import { useHorizontalWheel } from './useHorizontalWheel'
import { readView, useStoredView } from './viewStorage'
import { DEFAULT_LABELS } from './labels'
import { LabelsContext } from './labelsContext'
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
const NO_EXPANDED: ExpandedState = {}
const CAN_EXPAND = () => true
const NO_FORMATS: ColumnFormats = {}
const NO_VISIBILITY: VisibilityState = {}
const DEFAULT_COLUMN = { filterFn: 'includesString' as const, minSize: 48 }

export function ListTable<TData>({
  columns,
  data,
  getRowId,
  onRowClick,
  getRowHref,
  getRowProps,
  renderExpanded,
  getRowCanExpand,
  expanded: expandedProp,
  onExpandedChange,
  showExpandColumn = true,
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
  searchPlaceholder,
  searchLabel,
  labels: labelsProp,
  hideToolbar = false,
  hidePagination = false,
  theme,
  loading = false,
  emptyMessage,
  stickyFirstColumn = true,
  columnFormats: columnFormatsProp,
  onColumnFormatsChange,
  dateFormat = 'dd-MMM-yyyy',
  locale,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  storageKey,
  exportFormatted = false,
  exportFileName = 'export',
  toolbar,
  className,
  caption,
}: ListTableProps<TData>) {
  const labels = React.useMemo(
    () => ({
      ...DEFAULT_LABELS,
      ...labelsProp,
      ...(searchLabel ? { search: searchLabel } : null),
      ...(searchPlaceholder ? { searchPlaceholder } : null),
    }),
    [labelsProp, searchLabel, searchPlaceholder],
  )
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
  const [stored] = React.useState(() => readView(storageKey))
  const [columnFormats, setColumnFormats] = useControllable<ColumnFormats>(
    columnFormatsProp,
    onColumnFormatsChange,
    stored.formats ?? NO_FORMATS,
  )
  const [columnVisibility, setColumnVisibility] = useControllable<VisibilityState>(
    columnVisibilityProp,
    onColumnVisibilityChange,
    stored.visibility ?? NO_VISIBILITY,
  )
  useStoredView(storageKey, { visibility: columnVisibility, formats: columnFormats })
  const formatOptions = React.useMemo<FormatOptions>(() => ({ locale, dateFormat }), [locale, dateFormat])
  const metaRef = React.useRef<{ listView?: ReturnType<typeof useListView<TData>> }>({})
  const scrollRef = React.useRef<HTMLDivElement>(null)
  useHorizontalWheel(scrollRef)
  const [expanded, setExpanded] = useControllable(expandedProp, onExpandedChange, NO_EXPANDED)
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

  const withExpander = !!renderExpanded && showExpandColumn
  const allColumns = React.useMemo(
    () => {
      const formatted = withFormattedCells(columns)
      return withExpander ? [expandColumn<TData>(), ...formatted] : formatted
    },
    [withExpander, columns],
  )

  const [initialState] = React.useState(() => {
    const first = stickyFirstColumn ? firstLeafId(columns) : undefined
    const left = [withExpander && EXPAND_COLUMN_ID, first].filter(Boolean) as string[]
    return { columnPinning: { left } }
  })

  const canExpand = React.useCallback(
    (row: { original: TData }) => (getRowCanExpand ?? CAN_EXPAND)(row.original),
    [getRowCanExpand],
  )

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    getRowCanExpand: renderExpanded ? canExpand : undefined,
    defaultColumn: DEFAULT_COLUMN,
    initialState,
    meta: metaRef.current,
    state: { pagination, sorting, globalFilter, columnFilters, expanded, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
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

  metaRef.current.listView = useListView(table, data, allColumns, columnFormats, setColumnFormats, formatOptions)

  const pagerHidden =
    hidePagination === true ||
    (hidePagination === 'auto' && table.getPageCount() <= 1 && pagination.pageIndex === 0)

  return (
    <LabelsContext.Provider value={labels}>
      <div data-jt="list" data-theme={theme} className={cx('jtl-root', className)}>
        {hideToolbar ? null : (
          <ListToolbar
            table={table}
            search={globalFilter}
            onSearch={search}
            searchDelay={searchDebounceMs}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((open) => !open)}
            exportFileName={exportFileName}
            exportFormatted={exportFormatted}
          >
            {toolbar}
          </ListToolbar>
        )}
        <div ref={scrollRef} className="jtl-scroll">
          <table aria-busy={loading || undefined} style={{ width: table.getTotalSize() }} className="jtl-table">
            {caption ? <caption className="jtl-sr-only">{caption}</caption> : null}
            <ListHead table={table} showFilters={showFilters && !hideToolbar} filterDelay={searchDebounceMs} />
            <ListBody
              table={table}
              loading={loading}
              emptyMessage={emptyMessage}
              onRowClick={onRowClick}
              getRowHref={getRowHref}
              getRowProps={getRowProps}
              renderExpanded={renderExpanded}
            />
          </table>
        </div>
        {pagerHidden ? null : <ListPager table={table} pageSizeOptions={pageSizeOptions} loading={loading} />}
      </div>
    </LabelsContext.Provider>
  )
}

export default ListTable
