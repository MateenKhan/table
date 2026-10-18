import React from 'react'
import type { Column, ColumnDef, Table } from '@tanstack/react-table'
import { formatValue, inferKind, type ColumnFormat, type ColumnFormats, type FormatKind, type FormatOptions } from './format'
import type { ListView } from './types'

const SAMPLE_ROWS = 25

const metaFormat = <TData,>(column: Column<TData, unknown> | undefined) => column?.columnDef.meta?.format

function inferKinds<TData>(table: Table<TData>, data: TData[]): Record<string, FormatKind | undefined> {
  const rows = data.slice(0, SAMPLE_ROWS)
  const kinds: Record<string, FormatKind | undefined> = {}
  for (const column of table.getAllLeafColumns()) {
    const accessor = column.accessorFn
    kinds[column.id] = metaFormat(column)?.kind ?? (accessor ? inferKind(rows.map((row, index) => accessor(row, index))) : undefined)
  }
  return kinds
}

const IMPLIED: Partial<Record<FormatKind, ColumnFormat>> = { date: { kind: 'date' }, text: { kind: 'text' } }

export function useListView<TData>(
  table: Table<TData>,
  data: TData[],
  columns: ColumnDef<TData, any>[],
  formats: ColumnFormats,
  setFormats: (updater: (prev: ColumnFormats) => ColumnFormats) => void,
  options: FormatOptions,
): ListView {
  const kinds = React.useMemo(() => inferKinds(table, data), [table, data, columns])
  return React.useMemo<ListView>(() => {
    const baseFormatOf = (id: string) => {
      const kind = kinds[id]
      return metaFormat(table.getColumn(id)) ?? (kind ? IMPLIED[kind] : undefined)
    }
    const formatOf = (id: string) => formats[id] ?? baseFormatOf(id)
    return {
      options,
      kindOf: (id) => kinds[id],
      baseFormatOf,
      userFormatOf: (id) => formats[id],
      formatOf,
      setFormat: (id, format) =>
        setFormats((prev) => {
          const next = { ...prev }
          if (format) next[id] = format
          else delete next[id]
          return next
        }),
      display: (id, value) => {
        const format = formatOf(id)
        return format && format.kind !== 'text' ? formatValue(value, format, options) : undefined
      },
      wraps: (id) => {
        const format = formatOf(id)
        if (format?.kind === 'text' && format.overflow) return format.overflow === 'wrap'
        return !!table.getColumn(id)?.columnDef.meta?.wrap
      },
    }
  }, [kinds, formats, setFormats, options, table])
}
