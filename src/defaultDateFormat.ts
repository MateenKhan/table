import type { ColumnDef } from '@tanstack/react-table'

type Def = ColumnDef<Record<string, unknown>> & { columns?: Def[] }

const isDate = (type?: string) => type === 'date' || type === 'datetime'

export function withDateFormat(columns: Def[] | undefined, dateFormat: string | undefined): Def[] | undefined {
  if (!columns || !dateFormat) return columns
  return columns.map((def) => {
    if (def.columns) return { ...def, columns: withDateFormat(def.columns, dateFormat) } as Def
    const meta = def.meta
    return isDate(meta?.type) && !meta?.dateFormat ? ({ ...def, meta: { ...meta, dateFormat } } as Def) : def
  })
}
