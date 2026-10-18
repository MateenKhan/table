import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { viewOf } from './viewOf'

export function formattedCell<TData>({ table, column, getValue }: CellContext<TData, unknown>) {
  const value = getValue()
  const text = viewOf(table)?.display(column.id, value)
  if (text !== undefined) return text
  return value === null || value === undefined ? null : String(value)
}

type Def<TData> = ColumnDef<TData, any> & { columns?: Def<TData>[] }

export function withFormattedCells<TData>(columns: ColumnDef<TData, any>[]): ColumnDef<TData, any>[] {
  return (columns as Def<TData>[]).map((def) => {
    if (def.columns) return { ...def, columns: withFormattedCells(def.columns) } as ColumnDef<TData, any>
    return def.cell ? def : ({ ...def, cell: formattedCell } as ColumnDef<TData, any>)
  })
}
