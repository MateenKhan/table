import type React from 'react'
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowData,
  SortingState,
} from '@tanstack/react-table'

export type { ColumnFiltersState, PaginationState, SortingState }

export type ListTableProps<TData> = {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string
  onRowClick?: (row: TData, index: number, event: React.MouseEvent | React.KeyboardEvent) => void
  getRowHref?: (row: TData) => string | undefined
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
    readOnly?: boolean
  }
}
