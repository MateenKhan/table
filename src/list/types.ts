import type React from 'react'
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  RowData,
  SortingState,
} from '@tanstack/react-table'
import type { ListLabels } from './labels'

export type { ColumnFiltersState, ExpandedState, ListLabels, PaginationState, SortingState }

export type RowProps = {
  className?: string
  style?: React.CSSProperties
  'data-testid'?: string
  [data: `data-${string}`]: string | number | boolean | undefined
}

export type ListTheme = 'light' | 'dark'

export type ListTableProps<TData> = {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string
  onRowClick?: (row: TData, index: number, event: React.MouseEvent | React.KeyboardEvent) => void
  getRowHref?: (row: TData) => string | undefined
  getRowProps?: (row: TData, index: number) => RowProps | undefined
  renderExpanded?: (row: TData, index: number) => React.ReactNode
  getRowCanExpand?: (row: TData) => boolean
  expanded?: ExpandedState
  onExpandedChange?: (expanded: ExpandedState) => void
  showExpandColumn?: boolean
  manual?: boolean
  rowCount?: number
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  pageSize?: number
  pageSizeOptions?: number[]
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  globalFilter?: string
  onGlobalFilterChange?: (globalFilter: string) => void
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: (columnFilters: ColumnFiltersState) => void
  searchDebounceMs?: number
  searchPlaceholder?: string
  searchLabel?: string
  labels?: Partial<ListLabels>
  hideToolbar?: boolean
  hidePagination?: boolean | 'auto'
  theme?: ListTheme
  loading?: boolean
  emptyMessage?: React.ReactNode
  stickyFirstColumn?: boolean
  exportFileName?: string | false
  toolbar?: React.ReactNode
  className?: string
  caption?: string
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'center' | 'right'
    wrap?: boolean
    readOnly?: boolean
  }
}
