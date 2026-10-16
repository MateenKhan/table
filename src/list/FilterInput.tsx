import React from 'react'
import type { Column } from '@tanstack/react-table'
import { useDebouncedCommit } from './useDebouncedCommit'

type Props<TData> = {
  column: Column<TData, unknown>
  label: string
  delay: number
}

export function FilterInput<TData>({ column, label, delay }: Props<TData>) {
  const committed = String(column.getFilterValue() ?? '')
  const [text, setText] = React.useState(committed)
  React.useEffect(() => setText(committed), [committed])
  useDebouncedCommit(text, committed, delay, (next) =>
    column.setFilterValue(next || undefined),
  )
  return (
    <input
      type="search"
      value={text}
      onChange={(event) => setText(event.target.value)}
      aria-label={`Filter ${label}`}
      placeholder="Filter…"
      className="h-7 w-full min-w-0 rounded border border-slate-200 bg-white px-2 text-xs font-normal text-slate-700 outline-none focus:border-slate-400"
    />
  )
}
