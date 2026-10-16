export type ListLabels = {
  search: string
  searchPlaceholder: string
  columnFilters: string
  columns: string
  exportCsv: string
  rowsPerPage: string
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  pagination: string
  loading: string
  empty: string
  expandRow: string
  collapseRow: string
  filterPlaceholder: string
  filter: (column: string) => string
  pin: (column: string) => string
  unpin: (column: string) => string
  range: (from: string, to: string, total: string) => string
  page: (page: string, pageCount: string) => string
}

export const DEFAULT_LABELS: ListLabels = {
  search: 'Search',
  searchPlaceholder: 'Search…',
  columnFilters: 'Column filters',
  columns: 'Columns',
  exportCsv: 'Export CSV',
  rowsPerPage: 'Rows',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  pagination: 'Pagination',
  loading: 'Loading…',
  empty: 'No results',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  filterPlaceholder: 'Filter…',
  filter: (column) => `Filter ${column}`,
  pin: (column) => `Pin ${column}`,
  unpin: (column) => `Unpin ${column}`,
  range: (from, to, total) => `${from}–${to} of ${total}`,
  page: (page, pageCount) => `${page} / ${pageCount}`,
}
