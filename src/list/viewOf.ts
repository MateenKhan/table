import type { Table } from '@tanstack/react-table'
import type { ListView } from './types'

export const viewOf = <TData,>(table: Table<TData>) =>
  (table.options.meta as { listView?: ListView } | undefined)?.listView
