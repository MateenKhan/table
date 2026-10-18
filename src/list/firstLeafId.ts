import type { ColumnDef } from '@tanstack/react-table'

type AnyDef = ColumnDef<any, any> & { accessorKey?: string; columns?: AnyDef[] }

export function firstLeafId(columns: ColumnDef<any, any>[]): string | undefined {
  const first = columns[0] as AnyDef | undefined
  if (!first) return undefined
  if (first.columns?.length) return firstLeafId(first.columns)
  return (
    first.id ??
    first.accessorKey?.replace(/\./g, '_') ??
    (typeof first.header === 'string' ? first.header : undefined)
  )
}
