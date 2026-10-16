import type { Table } from '@tanstack/react-table'

const escapeCell = (value: unknown): string => {
  const text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<TData>(table: Table<TData>): string {
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.accessorFn)
  const head = columns.map((column) => {
    const header = column.columnDef.header
    return escapeCell(typeof header === 'string' ? header : column.id)
  })
  const rows = table.getPrePaginationRowModel().rows.map((row) =>
    columns.map((column) => escapeCell(row.getValue(column.id))).join(','),
  )
  return [head.join(','), ...rows].join('\r\n')
}

export function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
